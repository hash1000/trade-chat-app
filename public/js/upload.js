document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const progressBar = document.getElementById("progressBar");
  const progressContainer = document.getElementById("progressContainer");
  const statusMessage = document.getElementById("statusMessage");
  const uploadResult = document.getElementById("uploadResult");
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunk size

  // Upload state
  let currentFileId = null;
  let abortUpload = false;
  let uploadStats = {
    startTime: null,
    lastUpdate: null,
    lastBytes: 0,
  };

  // Initialize Socket.IO connection
  const socket = io("/upload", {
    path: "/socket.io",
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    transports: ["websocket"], // Force WebSocket transport
    upgrade: false,
  });

  // Connection handlers
  socket.on("connect", () => {
    console.log("Connected to upload namespace with ID:", socket.id);
    showStatus("Connected to upload server", "success");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
    showStatus("Connection error: " + err.message, "danger");
  });

  socket.on("disconnect", (reason) => {
    console.log("Disconnected:", reason);
    if (reason !== "io client disconnect") {
      showStatus("Disconnected from server", "warning");
    }
  });

 // Update the progress handler in upload.js
socket.on("upload-progress", (data) => {
  console.log("Received progress update:", data);
  if (data.fileId !== currentFileId) {
    console.log("Progress for different file, ignoring");
    return;
  }

  progressBar.style.width = `${data.progress}%`;
  progressBar.textContent = `${data.progress}%`;
});


  // Upload complete handler
  socket.on("upload-complete", ({ fileId, name, size, url, hash }) => {
    if (fileId !== currentFileId) return;

    const uploadTime = (Date.now() - uploadStats.startTime) / 1000;
    const avgSpeed = size / (1024 * 1024) / uploadTime;

    showStatus("Upload complete!", "success");
    uploadResult.innerHTML = `
      <div class="alert alert-success">
        <strong>${name}</strong><br>
        Size: ${formatSize(size)}<br>
        Time: ${uploadTime.toFixed(1)}s (${avgSpeed.toFixed(2)} MB/s)<br>
        SHA-256: <code>${hash}</code><br>
        <a href="${url}" target="_blank" class="btn btn-sm btn-success mt-2">Download</a>
      </div>
    `;
    resetUI();
  });

  // Error handler
  socket.on("upload-error", ({ fileId, error, details }) => {
    if (fileId !== currentFileId) return;
    console.error("Upload error:", error, details);
    showStatus(`Error: ${error}${details ? ` (${details})` : ""}`, "danger");
    resetUI();
  });

  // Form submission handler
  document
    .getElementById("uploadForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const file = fileInput.files[0];
      if (!file) return showStatus("Please select a file first", "warning");

      prepareUI();
      showStatus(
        `Starting upload of ${file.name} (${formatSize(file.size)})`,
        "info"
      );

      try {
        await attemptUpload(file, 3); // 3 retry attempts
      } catch (err) {
        console.error("Final upload failure:", err);
        showStatus("Upload failed after retries: " + err.message, "danger");
        resetUI();
      }
    });

  // Cancel button handler
  cancelBtn.addEventListener("click", () => {
    abortUpload = true;
    showStatus("Upload cancelled by user", "warning");
    if (currentFileId) {
      socket.emit("cancel-upload", { fileId: currentFileId });
    }
    resetUI();
  });

  // Core upload function with retry logic
  async function attemptUpload(file, maxRetries = 3) {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        currentFileId =
          "file_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        abortUpload = false;
        uploadStats = {
          startTime: Date.now(),
          lastUpdate: Date.now(),
          lastBytes: 0,
        };

        const fileHash = await calculateFileHash(file); // Optional but already implemented

        showStatus(`Uploading ${file.name} (${formatSize(file.size)})`, "info");

        const response = await fetch("/api/file/large", {
          method: "POST",
          headers: {
            "x-socket-id": socket.id,
            "x-file-name": file.name,
            "Content-Type": file.type || "application/octet-stream",
            "Content-Length": file.size,
            "type": "video", // 👈 Custom header
          },
          body: file,
        });

        // const response = await fetch(
        //   "http://157.230.84.217:5000/api/file/large",
        //   {
        //     method: "POST",
        //     headers: {
        //       "x-socket-id": socket.id,
        //       "x-file-name": file.name,
        //       "Content-Type": file.type || "application/octet-stream",
        //       "Content-Length": file.size,
        //       "x-file-type": "video",
        //     },
        //     body: file,
        //   }
        // );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Upload failed");
        }

        const result = await response.json();
        showStatus("Upload complete!", "success");

        uploadResult.innerHTML = `
        <div class="alert alert-success">
          <strong>${file.name}</strong><br>
          Size: ${formatSize(file.size)}<br>
          <a href="${
            result?.data?.url
          }" target="_blank" class="btn btn-sm btn-success mt-2">Download</a>
        </div>
      `;

        resetUI();
        return;
      } catch (err) {
        console.error(`Upload attempt ${retryCount + 1} failed:`, err);
        if (retryCount >= maxRetries) {
          showStatus("Upload failed after retries: " + err.message, "danger");
          resetUI();
          return;
        }

        retryCount++;
        showStatus(`Retrying upload (attempt ${retryCount})...`, "warning");
        await new Promise((res) => setTimeout(res, 2000 * retryCount)); // exponential backoff
      }
    }
  }

  // Process individual chunk
  async function processChunk(chunk, chunkIndex, totalSize, totalChunks) {
    try {
      // Compress before sending
      const compressedChunk = await compressChunk(chunk);
      if (compressedChunk.size > 1e6) {
        // If over 1MB after compression
        console.warn(`Large chunk detected: ${compressedChunk.size} bytes`);
      }

      const base64 = await blobToBase64(compressedChunk);

      await new Promise((resolve, reject) => {
        socket.emit(
          "upload-chunk",
          {
            fileId: currentFileId,
            chunkIndex,
            chunkData: base64,
            totalChunks,
          },
          (ack) => {
            if (ack && ack.received) {
              uploadStats.lastBytes += chunk.size;
              uploadStats.lastUpdate = Date.now();
              resolve();
            } else {
              reject(new Error(ack?.error || "Chunk not acknowledged"));
            }
          }
        );
      });
    } catch (err) {
      console.error(`Chunk ${chunkIndex} failed:`, err);
      throw err;
    }
  }

  // Helper functions
function prepareUI() {
  uploadBtn.disabled = true;
  fileInput.disabled = true;
  cancelBtn.classList.remove("d-none");
  progressContainer.classList.remove("d-none"); // <-- SHOW this
  progressBar.style.width = "0%";
  progressBar.textContent = "0%";
  uploadResult.innerHTML = "";
}

  function resetUI() {
    uploadBtn.disabled = false;
    fileInput.disabled = false;
    cancelBtn.classList.add("d-none");
    progressContainer.classList.add("d-none");
    currentFileId = null;
  }

  function showStatus(msg, type) {
    statusMessage.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  }

  async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function compressChunk(blob) {
    if (
      /^(image|video|audio|application\/(zip|gzip|x-compressed))/.test(
        blob.type
      )
    ) {
      return blob; // Skip compression for already compressed formats
    }
    try {
      const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
      return await new Response(stream).blob();
    } catch (err) {
      console.warn("Compression failed, sending uncompressed:", err);
      return blob;
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function formatSize(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }
});
