const { PassThrough } = require("stream");
const ffmpeg = require("fluent-ffmpeg");
const sharp = require("sharp");
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

// === S3 Client Configuration ===
const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// === Helper Functions ===
const isVideo = (ext) =>
  ["mp4", "mkv", "mov", "avi", "flv", "wmv", "webm", "mpg"].includes(ext);
const isImage = (ext) =>
  ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"].includes(ext);
const isDocument = (ext) =>
  ["pdf", "doc", "docx", "xls", "xlsx", "txt", "ppt", "pptx"].includes(ext);

// Timeout utility
const withTimeout = (promise, timeoutMs, errorMsg) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    }),
  ]);
};

// === Compression Configuration ===
const getCompressionSettings = (fileSize, fileType) => {
  // Compression tiers based on file size
  if (fileType === "video") {
    if (fileSize > 100 * 1024 * 1024) {
      // >100MB
      return { crf: 32, preset: "fast", resolution: "1280x720" };
    } else if (fileSize > 50 * 1024 * 1024) {
      // 50-100MB
      return { crf: 28, preset: "fast", resolution: "1280x720" };
    } else if (fileSize > 20 * 1024 * 1024) {
      // 20-50MB
      return { crf: 24, preset: "medium", resolution: "1920x1080" };
    }
    return { crf: 22, preset: "slow", resolution: "1920x1080" }; // <20MB
  } else if (fileType === "image") {
    if (fileSize > 20 * 1024 * 1024) {
      // >20MB
      return { quality: 50, progressive: true };
    } else if (fileSize > 10 * 1024 * 1024) {
      // 10-20MB
      return { quality: 65, progressive: true };
    } else if (fileSize > 5 * 1024 * 1024) {
      // 5-10MB
      return { quality: 75, progressive: true };
    }
    return { quality: 85, progressive: true }; // <5MB
  }
  // For documents, we use zip compression level
  if (fileSize > 50 * 1024 * 1024) return { level: 9 }; // max compression
  if (fileSize > 20 * 1024 * 1024) return { level: 7 };
  if (fileSize > 10 * 1024 * 1024) return { level: 5 };
  return { level: 3 }; // minimal compression
};

// === Processors ===
const processImageStream = (inputStream, compressionSettings) => {
  const transformer = sharp()
    .jpeg({
      quality: compressionSettings.quality,
      progressive: compressionSettings.progressive,
      mozjpeg: true,
    })
    .on("error", (err) => {
      console.error("Image processing error:", err);
    });
  return inputStream.pipe(transformer);
};

const zipStream = (inputStream, originalname, compressionLevel) => {
  const outputStream = new PassThrough();
  const archive = archiver("zip", {
    zlib: { level: compressionLevel },
  });

  archive.on("error", (err) => {
    console.error("Zipping error:", err);
    outputStream.emit("error", err);
  });

  archive.pipe(outputStream);
  archive.append(inputStream, { name: path.basename(originalname) });
  archive.finalize();

  return outputStream;
};

const generateVideoThumbnail = (inputStream, filename) => {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(os.tmpdir(), "video-thumbs");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(
      tempDir,
      `${Date.now()}-${path.basename(filename)}`
    );
    const outputPath = path.join(tempDir, `${Date.now()}-thumb.jpg`);

    const writeStream = fs.createWriteStream(tempPath);

    inputStream.pipe(writeStream);

    writeStream.on("finish", () => {
      ffmpeg(tempPath)
        .screenshots({
          count: 1,
          timemarks: ["10%"], // Take thumbnail at 10% of video duration
          size: "320x240",
          filename: path.basename(outputPath),
          folder: tempDir,
        })
        .on("end", () => {
          fs.readFile(outputPath, (err, data) => {
            // Clean up temp files
            [tempPath, outputPath].forEach((file) => {
              try {
                fs.unlinkSync(file);
              } catch (err) {
                console.error("Cleanup error:", err);
              }
            });

            if (err) return reject(err);

            resolve({
              buffer: data,
              name: `${filename.replace(/\.[^/.]+$/, "")}-thumbnail.jpg`,
              mimetype: "image/jpeg",
            });
          });
        })
        .on("error", (err) => {
          [tempPath, outputPath].forEach((file) => {
            try {
              fs.unlinkSync(file);
            } catch (cleanupErr) {
              console.error("Cleanup error:", cleanupErr);
            }
          });
          reject(err);
        });
    });

    writeStream.on("error", (err) => {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
      reject(err);
    });
  });
};

const processVideoStream = async (inputStream, ext, filename, fileSize) => {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(os.tmpdir(), "video-processing");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempInputPath = path.join(
      tempDir,
      `${Date.now()}-${path.basename(filename)}`
    );
    const tempOutputPath = path.join(
      tempDir,
      `processed-${Date.now()}-${path.basename(filename)}`
    );

    // Get compression settings based on file size
    const compression = getCompressionSettings(fileSize, "video");

    // Write the input stream to a temp file
    const writeStream = fs.createWriteStream(tempInputPath);
    inputStream.pipe(writeStream);

    writeStream.on("finish", () => {
      // Process the temp file with FFmpeg
      const command = ffmpeg(tempInputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          `-preset ${compression.preset}`,
          `-crf ${compression.crf}`,
          "-movflags +faststart",
          "-threads 2", // Use multiple threads
          "-profile:v high",
          "-pix_fmt yuv420p", // Ensure wide compatibility
        ])
        .format(ext === "mp4" ? "mp4" : "webm")
        .size(compression.resolution)
        .on("progress", (progress) => {
          console.log(`Video processing: ${progress.percent}% done`);
        })
        .on("error", (err) => {
          // Cleanup temp files
          fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
          reject(err);
        })
        .on("end", () => {
          // Read the processed file
          fs.readFile(tempOutputPath, (err, data) => {
            // Cleanup temp files
            fs.unlinkSync(tempInputPath);
            fs.unlinkSync(tempOutputPath);

            if (err) return reject(err);
            resolve(data);
          });
        });

      // For webm format, use different codecs
      if (ext !== "mp4") {
        command.videoCodec("libvpx-vp9").audioCodec("libopus").outputOptions([
          "-row-mt 1", // Enable row-based multithreading
          "-quality good",
          "-speed 4", // Faster encoding
        ]);
      }

      command.save(tempOutputPath);
    });

    writeStream.on("error", (err) => {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      reject(err);
    });
  });
};

// === Upload Functions ===
const uploadToS3 = async (stream, key, contentType) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: key,
      Body: stream,
      ACL: "public-read",
      ContentType: contentType,
    },
  });

  return upload.done();
};

const processAndUploadVideo = async (
  fileStream,
  originalname,
  mimetype,
  fileSize
) => {
  const ext = path.extname(originalname).slice(1).toLowerCase();
  const videoKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

  try {
    // Create two streams from the input - one for video and one for thumbnail
    const videoProcessingStream = new PassThrough();
    const thumbnailStream = new PassThrough();

    fileStream.pipe(videoProcessingStream);
    fileStream.pipe(thumbnailStream);

    // Process video and thumbnail in parallel
    const [processedVideoBuffer, thumbnailResult] = await Promise.all([
      processVideoStream(videoProcessingStream, ext, originalname, fileSize),
      // withTimeout(
      //   30000, // 30s timeout for thumbnail
      //   'Thumbnail generation timed out'
      // )
      generateVideoThumbnail(thumbnailStream, originalname),
    ]);

    // Upload thumbnail
    const thumbKey = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}-thumb.jpg`;
    await uploadToS3(
      thumbnailResult.buffer,
      thumbKey,
      thumbnailResult.mimetype
    );

    // Upload video
    const videoResult = await uploadToS3(
      Buffer.from(processedVideoBuffer),
      videoKey,
      mimetype
    );

    return {
      title: originalname,
      url: `${process.env.IMAGE_END_POINT}/${videoKey}`,
      key: videoKey,
      thumbnailUrl: `${process.env.IMAGE_END_POINT}/${thumbKey}`,
    };
  } catch (error) {
    console.error("Video processing error:", error);
    throw new Error(`Video processing failed: ${error.message}`);
  }
};

const uploadFileToS3 = async (fileStream, originalname, mimetype, fileSize) => {
  const cleanName = path.basename(originalname);
  const ext = cleanName.split(".").pop().toLowerCase();
  let processedStream = fileStream;
  let finalName = cleanName;
  let finalMime = mimetype;

  console.log("Processing file:", {
    size: fileSize,
    ext,
    name: cleanName,
    mime: finalMime,
  });

  try {
    // Always process videos (for thumbnails and compression)
    if (isVideo(ext)) {
      console.log("hashir uploading");
      return await processAndUploadVideo(
        fileStream,
        cleanName,
        mimetype,
        fileSize
      );
    }

    // For other files, apply compression based on size
    const compressionSettings = getCompressionSettings(
      fileSize,
      isImage(ext) ? "image" : "document"
    );
    console.log("compressionSettings", compressionSettings);
    if (isImage(ext)) {
      processedStream = processImageStream(fileStream, compressionSettings);
    } else if (isDocument(ext) || fileSize > 10 * 1024 * 1024) {
      // Compress documents or any large files (>10MB)
      processedStream = zipStream(
        fileStream,
        cleanName,
        compressionSettings.level
      );
      finalName = cleanName.replace(/\.[^/.]+$/, "") + ".zip";
      finalMime = "application/zip";
    }

    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${
      ext || "bin"
    }`;
    const result = await uploadToS3(processedStream, key, finalMime);

    return {
      title: finalName,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      key,
      thumbnailUrl: null,
    };
  } catch (error) {
    console.error("Upload Error:", error);
    throw new Error(`File processing failed: ${error.message}`);
  }
};

// === Delete from S3 ===
const deleteFileFromS3 = async (key) => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.error("Delete Error:", error);
    throw new Error("Failed to delete file from S3");
  }
};

// === Exports ===
module.exports = {
  s3Client,
  uploadFileToS3,
  deleteFileFromS3,
};
