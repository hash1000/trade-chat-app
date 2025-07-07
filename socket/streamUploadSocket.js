const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);

// Define UPLOAD_DIR and uploadMeta at the top level
const UPLOAD_DIR = path.join(__dirname, "../../public/uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Initialize uploadMeta as a Map to track upload sessions
const uploadMeta = new Map();

function initUploadSocket(io) {
  const uploadNamespace = io.of('/upload');
  
  uploadNamespace.on('connection', (socket) => {
    console.log('Client connected to upload namespace:', socket.id);

    socket.on("upload-start", ({ fileId, fileName, fileSize, fileHash, totalChunks }, callback) => {
      try {
        const tempDir = path.join(UPLOAD_DIR, fileId);
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        uploadMeta.set(fileId, {
          fileName,
          fileSize,
          fileHash,
          totalChunks,
          uploadedSize: 0,
          tempDir,
          chunks: new Set(),
          startTime: Date.now(),
          socketId: socket.id
        });
        
        console.log(`Upload started for ${fileName} (${fileId}), ${totalChunks} chunks expected`);
        callback({ success: true });
      } catch (err) {
        console.error("Upload start error:", err);
        callback({ error: "Failed to initialize upload: " + err.message });
      }
    });

    socket.on("upload-chunk", async ({ fileId, chunkIndex, chunkData, totalChunks }, callback) => {
      try {
        const meta = uploadMeta.get(fileId);
        if (!meta) throw new Error("Upload session not found");
        if (chunkIndex >= totalChunks) throw new Error(`Invalid chunk index ${chunkIndex}`);

        const chunkBuffer = Buffer.from(chunkData, "base64");
        const decompressed = await zlib.gunzipSync(chunkBuffer);
        const chunkPath = path.join(meta.tempDir, `${chunkIndex}.chunk`);
        
        await fs.promises.writeFile(chunkPath, decompressed);
        meta.chunks.add(chunkIndex);
        meta.uploadedSize += decompressed.length;

        // Progress update
        const progress = Math.floor((meta.uploadedSize / meta.fileSize) * 100);
        socket.emit("upload-progress", { 
          fileId, 
          progress,
          receivedChunks: meta.chunks.size,
          totalChunks: meta.totalChunks
        });

        callback({ received: true });
      } catch (err) {
        console.error("Chunk processing error:", err);
        callback({ error: err.message });
      }
    });

    socket.on("upload-complete", async ({ fileId }, callback) => {
      try {
        const meta = uploadMeta.get(fileId);
        if (!meta) throw new Error("Upload session not found");

        // Validate all chunks
        const missingChunks = [];
        for (let i = 0; i < meta.totalChunks; i++) {
          if (!meta.chunks.has(i)) missingChunks.push(i);
        }

        if (missingChunks.length > 0) {
          throw new Error(`Missing ${missingChunks.length} chunks (${missingChunks.join(', ')})`);
        }

        // Finalize file
        const finalPath = path.join(UPLOAD_DIR, `${Date.now()}_${meta.fileName}`);
        const writeStream = fs.createWriteStream(finalPath);

        // Concatenate chunks
        const chunks = Array.from(meta.chunks)
          .sort((a, b) => a - b)
          .map(chunk => path.join(meta.tempDir, `${chunk}.chunk`));

        for (const chunkFile of chunks) {
          const readStream = fs.createReadStream(chunkFile);
          await pipeline(readStream, writeStream, { end: false });
        }

        writeStream.end();

        await new Promise((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });

        // Cleanup and respond
        await fs.promises.rm(meta.tempDir, { recursive: true });
        const hash = await calculateFileHash(finalPath);
        
        callback({ 
          success: true,
          url: `/uploads/${path.basename(finalPath)}`,
          hash
        });

        uploadMeta.delete(fileId);
      } catch (err) {
        console.error("Upload completion error:", err);
        callback({ error: err.message });
      }
    });

    socket.on("cancel-upload", async ({ fileId }) => {
      try {
        const meta = uploadMeta.get(fileId);
        if (meta) {
          await fs.promises.rm(meta.tempDir, { recursive: true });
          uploadMeta.delete(fileId);
          console.log(`Upload cancelled: ${fileId}`);
        }
      } catch (err) {
        console.error("Cancel cleanup error:", err);
      }
    });

    socket.on("disconnect", () => {
      // Clean up any incomplete uploads for this socket
      for (const [fileId, meta] of uploadMeta) {
        if (meta.socketId === socket.id) {
          fs.promises.rm(meta.tempDir, { recursive: true })
            .catch(err => console.error("Cleanup error:", err));
          uploadMeta.delete(fileId);
        }
      }
      console.log("Socket disconnected:", socket.id);
    });
  });
}

async function calculateFileHash(filePath) {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

module.exports = initUploadSocket;