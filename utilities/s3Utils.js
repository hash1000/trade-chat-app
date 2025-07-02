const { PassThrough } = require("stream");
const { pipeline } = require("stream/promises");
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
  ["mp4", "mkv", "mov", "avi", "flv", "wmv", "webm", "mpg", "mpeg", "mkv"].includes(
    ext
  );
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
  if (fileType === "video") {
    console.log("start video");
    if (fileSize > 100 * 1024 * 1024) {
      return { crf: 60, preset: "ultrafast", resolution: "256x144" };
    } else if (fileSize > 50 * 1024 * 1024) {
      return { crf: 60, preset: "ultrafast", resolution: "256x144" };
    } else if (fileSize > 20 * 1024 * 1024) {
      return { crf: 60, preset: "ultrafast", resolution: "256x144" };
    }
    return { crf: 60, preset: "fast", resolution: "256x144" };
  } else if (fileType === "image") {
    // Image compression
    if (fileSize > 20 * 1024 * 1024) {
      return { quality: 30, progressive: true, thumbnailSize: 120 };
    } else if (fileSize > 10 * 1024 * 1024) {
      return { quality: 30, progressive: true, thumbnailSize: 120 };
    } else if (fileSize > 5 * 1024 * 1024) {
      return { quality: 30, progressive: true, thumbnailSize: 120 };
    }
    return { quality: 30, progressive: true, thumbnailSize: 120 };
  }

  // Document compression
  if (fileSize > 50 * 1024 * 1024) return { level: 9 };
  if (fileSize > 20 * 1024 * 1024) return { level: 7 };
  if (fileSize > 10 * 1024 * 1024) return { level: 5 };
  return { level: 3 };
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

const generateImageThumbnail = async (inputStream, filename, size) => {
  try {
    const transformer = sharp()
      .resize(size, size, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 70,
        progressive: true,
        mozjpeg: true,
      });

    const buffer = await inputStream.pipe(transformer).toBuffer();

    return {
      buffer,
      name: `${filename.replace(/\.[^/.]+$/, "")}-thumbnail.jpg`,
      mimetype: "image/jpeg",
    };
  } catch (err) {
    console.error("Thumbnail generation error:", err);
    throw new Error(`Thumbnail generation failed: ${err.message}`);
  }
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
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (err) {
      return reject(
        new Error(`Failed to create temp directory: ${err.message}`)
      );
    }

    const tempPath = path.join(
      tempDir,
      `${Date.now()}-${path.basename(filename)}`
    );
    const outputPath = path.join(tempDir, `${Date.now()}-thumb.jpg`);

    const writeStream = fs.createWriteStream(tempPath);
    inputStream.pipe(writeStream);

    writeStream.on("finish", () => {
      // First verify the file is valid
      ffmpeg.ffprobe(tempPath, (err, metadata) => {
        if (err) {
          // Clean up and reject if file is invalid
          [tempPath, outputPath].forEach((file) => {
            try {
              if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (e) {}
          });
          return reject(
            new Error("Invalid video file - could not read metadata")
          );
        }

        // If file is valid, proceed with thumbnail generation
        ffmpeg(tempPath)
          .screenshots({
            count: 1,
            timemarks: ["10%"],
            size: "160x90",
            filename: path.basename(outputPath),
            folder: tempDir,
          })
          .on("end", () => {
            fs.readFile(outputPath, (err, data) => {
              [tempPath, outputPath].forEach((file) => {
                try {
                  if (fs.existsSync(file)) fs.unlinkSync(file);
                } catch (e) {}
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
                if (fs.existsSync(file)) fs.unlinkSync(file);
              } catch (e) {}
            });
            reject(new Error(`Thumbnail generation failed: ${err.message}`));
          });
      });
    });

    writeStream.on("error", (err) => {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {}
      reject(new Error(`Failed to write temp file: ${err.message}`));
    });
  });
};

const processVideoStream = async (
  inputStream,
  originalExt,
  filename,
  fileSize
) => {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(os.tmpdir(), "video-processing");
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (err) {
      return reject(
        new Error(`Failed to create temp directory: ${err.message}`)
      );
    }

    const tempInputPath = path.join(
      tempDir,
      `${Date.now()}-${path.basename(filename)}`
    );
    // Always output as MP4 for better compatibility
    const tempOutputPath = path.join(
      tempDir,
      `processed-${Date.now()}-${path.basename(
        filename.replace(/\.[^/.]+$/, "")
      )}.mp4`
    );

    // Get compression settings based on file size
    const compression = getCompressionSettings(fileSize, "video");

    // Write the input stream to a temp file
    const writeStream = fs.createWriteStream(tempInputPath);
    inputStream.pipe(writeStream);

    writeStream.on("finish", () => {
      // Faster video processing with optimized settings
      const command = ffmpeg(tempInputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          `-preset ${compression.preset}`,
          `-crf ${compression.crf}`, // Higher CRF for smaller files
          "-movflags +faststart",
          "-threads 4", // Use more threads
          "-profile:v main", // Simpler profile
          "-pix_fmt yuv420p",
          "-vsync 1", // Simpler frame timing
          "-async 1", // Simpler audio sync
        ])
        .format("mp4")
        .size(compression.resolution) // Lower resolution
        .fps(24) // Standard frame rate
        .on("progress", (progress) => {
          console.log(`Video processing: ${progress.percent}% done`);
        })
        .on("error", (err) => {
          console.error("FFmpeg processing error:", err);
          // Cleanup temp files
          try {
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
          } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
          }
          reject(new Error(`Video processing failed: ${err.message}`));
        })
        .on("end", () => {
          // Read the processed file
          fs.readFile(tempOutputPath, (err, data) => {
            // Cleanup temp files
            try {
              if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
              if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            } catch (cleanupErr) {
              console.error("Cleanup error:", cleanupErr);
            }

            if (err)
              return reject(
                new Error(`Failed to read output file: ${err.message}`)
              );
            resolve(data);
          });
        });

      command.save(tempOutputPath);
    });

    writeStream.on("error", (err) => {
      try {
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
      reject(new Error(`Failed to write input file: ${err.message}`));
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
  let ext = path.extname(originalname).slice(1).toLowerCase();
  // Convert unsupported formats to MP4
  if (!["mp4", "webm", "mov"].includes(ext)) {
    ext = "mp4";
  }
  console.log("start >>> video");
  const videoKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

  try {
    // Create two streams from the input - one for video and one for thumbnail
    const videoProcessingStream = new PassThrough();
    const thumbnailStream = new PassThrough();

    fileStream.pipe(videoProcessingStream);
    fileStream.pipe(thumbnailStream);

    console.log(
      "videoProcessingStream, ext, originalname, fileSize",
      videoProcessingStream,
      ext,
      originalname,
      fileSize
    );
    console.log(
      "generateVideoThumbnail(thumbnailStream, originalname",
      thumbnailStream,
      originalname
    );
    // Process video and thumbnail in parallel with timeout
    const [processedVideoBuffer, thumbnailResult] = await Promise.all([
      withTimeout(
        processVideoStream(videoProcessingStream, ext, originalname, fileSize),
        800000, // 5 minute timeout
        "Video processing timed out"
      ),
      withTimeout(
        generateVideoThumbnail(thumbnailStream, originalname),
        15000, // 15s timeout for thumbnail (reduced from 30s)
        "Thumbnail generation timed out"
      ),
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
      "video/mp4"
    );

    return {
      title: originalname.replace(/\.[^/.]+$/, "") + ".mp4",
      url: `${process.env.IMAGE_END_POINT}/${videoKey}`,
      key: videoKey,
      thumbnailUrl: `${process.env.IMAGE_END_POINT}/${thumbKey}`,
    };
  } catch (error) {
    console.error("Video processing error:", error);
    throw new Error(`Video processing failed: ${error.message}`);
  }
};

const processAndUploadImage = async (
  fileStream,
  originalname,
  mimetype,
  fileSize
) => {
  const ext = path.extname(originalname).slice(1).toLowerCase();
  const imageKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${
    ext === "png" ? "png" : "jpg"
  }`;

  try {
    // Create two streams from the input - one for image and one for thumbnail
    const imageProcessingStream = new PassThrough();
    const thumbnailStream = new PassThrough();

    fileStream.pipe(imageProcessingStream);
    fileStream.pipe(thumbnailStream);

    // Get compression settings
    const compressionSettings = getCompressionSettings(fileSize, "image");

    // Process image and thumbnail in parallel
    const [processedImageBuffer, thumbnailResult] = await Promise.all([
      withTimeout(
        processImageStream(
          imageProcessingStream,
          compressionSettings
        ).toBuffer(),
        60000, // 1 minute timeout
        "Image processing timed out"
      ),
      withTimeout(
        generateImageThumbnail(thumbnailStream, originalname, 400), // 400px thumbnail
        30000, // 30s timeout
        "Thumbnail generation timed out"
      ),
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

    // Upload image
    const imageResult = await uploadToS3(
      processedImageBuffer,
      imageKey,
      ext === "png" ? "image/png" : "image/jpeg"
    );

    return {
      title: originalname,
      url: `${process.env.IMAGE_END_POINT}/${imageKey}`,
      key: imageKey,
      thumbnailUrl: `${process.env.IMAGE_END_POINT}/${thumbKey}`,
    };
  } catch (error) {
    console.error("Image processing error:", error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

const uploadFileToS3 = async (fileStream, originalname, mimetype, fileSize) => {
  const cleanName = path.basename(originalname);
  let ext = cleanName.split(".").pop().toLowerCase();
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
    // Process videos
    if (isVideo(ext)) {
      console.log("video start ext",ext);
      return await withTimeout(
        processAndUploadVideo(fileStream, cleanName, mimetype, fileSize),
        900000, // 10 minute timeout for video uploads
        "Video upload timed out"
      );
    }

    // Process images with thumbnails
    if (isImage(ext)) {
      return await withTimeout(
        processAndUploadImage(fileStream, cleanName, mimetype, fileSize),
        120000, // 2 minute timeout for image uploads
        "Image upload timed out"
      );
    }

    // For documents, apply compression
    const compressionSettings = getCompressionSettings(fileSize, "document");
    if (isDocument(ext) || fileSize > 10 * 1024 * 1024) {
      processedStream = zipStream(
        fileStream,
        cleanName,
        compressionSettings.level
      );
      finalName = cleanName.replace(/\.[^/.]+$/, "") + ".zip";
      finalMime = "application/zip";
    }

    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${
      finalName.split(".").pop() || "bin"
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
