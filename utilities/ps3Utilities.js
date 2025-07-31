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
/**
 * Check if file extension is a video type
 * @param {string} ext - File extension
 * @returns {boolean} True if video type
 */
const isVideo = (ext) =>
  ["mp4", "mov", "avi", "flv", "wmv", "webm", "mpg", "mpeg", "mkv"].includes(
    ext
  );

/**
 * Check if file extension is an image type
 * @param {string} ext - File extension
 * @returns {boolean} True if image type
 */
const isImage = (ext) =>
  ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"].includes(ext);

/**
 * Check if file extension is a document type
 * @param {string} ext - File extension
 * @returns {boolean} True if document type
 */
const isDocument = (ext) =>
  ["pdf", "doc", "docx", "xls", "xlsx", "txt", "ppt", "pptx"].includes(ext);

/**
 * Adds timeout to a promise
 * @param {Promise} promise - Promise to add timeout to
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMsg - Error message if timeout occurs
 * @returns {Promise} Promise with timeout
 */
const withTimeout = (promise, timeoutMs, errorMsg) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    }),
  ]);
};

/**
 * Convert stream to buffer
 * @param {Stream} stream - Input stream
 * @returns {Promise<Buffer>} Buffer containing stream data
 */
const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

// === Compression Configuration ===
/**
 * Get compression settings based on file size and type
 * @param {number} fileSize - File size in bytes
 * @param {string} fileType - File type ('video', 'image', etc.)
 * @returns {Object} Compression settings
 */
const getCompressionSettings = (fileSize, fileType) => {
  if (fileType === "video") {
    if (fileSize > 100 * 1024 * 1024) {
      return { crf: 32, preset: "ultrafast", resolution: "256x180" };
    } else if (fileSize > 50 * 1024 * 1024) {
      return { crf: 28, preset: "superfast", resolution: "426x240" };
    } else if (fileSize > 20 * 1024 * 1024) {
      return { crf: 24, preset: "fast", resolution: "640x360" };
    }
    return { crf: 20, preset: "medium", resolution: "854x480" };
  } else if (fileType === "image") {
    if (fileSize > 20 * 1024 * 1024) {
      return { quality: 30, progressive: true, thumbnailSize: 120 };
    } else if (fileSize > 10 * 1024 * 1024) {
      return { quality: 50, progressive: true, thumbnailSize: 200 };
    } else if (fileSize > 5 * 1024 * 1024) {
      return { quality: 70, progressive: true, thumbnailSize: 300 };
    }
    return { quality: 80, progressive: true, thumbnailSize: 400 };
  }

  if (fileSize > 50 * 1024 * 1024) return { level: 9 };
  if (fileSize > 20 * 1024 * 1024) return { level: 7 };
  if (fileSize > 10 * 1024 * 1024) return { level: 5 };
  return { level: 3 };
};

// === Processors ===
/**
 * Process image stream with compression
 * @param {Stream} inputStream - Input image stream
 * @param {Object} compressionSettings - Compression settings
 * @returns {Stream} Processed image stream
 */
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

/**
 * Generate image thumbnail
 * @param {Stream} inputStream - Input image stream
 * @param {string} filename - Original filename
 * @param {number} size - Thumbnail size
 * @returns {Promise<Object>} Thumbnail data
 */
const generateImageThumbnail = async (inputStream, filename, size) => {
  try {
    const transformer = sharp()
      .resize(size, size, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 80,
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

/**
 * Zip a stream with compression
 * @param {Stream} inputStream - Input stream to zip
 * @param {string} originalname - Original filename
 * @param {number} compressionLevel - Compression level (0-9)
 * @returns {Stream} Zipped output stream
 */
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

/**
 * Generate video thumbnail
 * @param {Stream} inputStream - Input video stream
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Thumbnail data
 */
const generateVideoThumbnail = async (inputStream, filename) => {
  const tempDir = path.join(os.tmpdir(), "video-thumbs");
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  } catch (err) {
    throw new Error(`Failed to create temp directory: ${err.message}`);
  }

  const tempPath = path.join(
    tempDir,
    `${Date.now()}-${path.basename(filename)}`
  );
  const outputPath = path.join(tempDir, `${Date.now()}-thumb.jpg`);

  try {
    // Write the stream to a temp file
    await pipeline(inputStream, fs.createWriteStream(tempPath));

    // Verify the file is valid
    await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tempPath, (err) => {
        if (err) reject(new Error("Invalid video file"));
        else resolve();
      });
    });

    // Generate thumbnail
    await new Promise((resolve, reject) => {
      ffmpeg(tempPath)
        .screenshots({
          count: 1,
          timemarks: ["10%"],
          size: "160x90",
          filename: path.basename(outputPath),
          folder: tempDir,
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // Read the thumbnail
    const data = await fs.promises.readFile(outputPath);

    return {
      buffer: data,
      name: `${filename.replace(/\.[^/.]+$/, "")}-thumbnail.jpg`,
      mimetype: "image/jpeg",
    };
  } catch (error) {
    throw new Error(`Thumbnail generation failed: ${error.message}`);
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
};

/**
 * Process video stream directly (for small files)
 * @param {Stream} inputStream - Input video stream
 * @param {Object} compressionSettings - Compression settings
 * @returns {Promise<Buffer>} Processed video buffer
 */
const processVideoStreamDirect = (inputStream, compressionSettings) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const outputStream = new PassThrough();

    ffmpeg(inputStream)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        `-preset ${compressionSettings.preset}`,
        `-crf ${compressionSettings.crf}`,
        "-movflags +faststart",
        "-threads 4",
        "-profile:v main",
        "-pix_fmt yuv420p",
      ])
      .format("mp4")
      .size(compressionSettings.resolution)
      .fps(24)
      .on("error", reject)
      .pipe(outputStream, { end: true });

    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);
  });
};

/**
 * Process video stream using temp files (for large files)
 * @param {Stream} inputStream - Input video stream
 * @param {string} filename - Original filename
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<Buffer>} Processed video buffer
 */
const processVideoStreamFile = async (inputStream, filename, fileSize) => {
  const tempDir = path.join(os.tmpdir(), "video-processing");
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  } catch (err) {
    throw new Error(`Failed to create temp directory: ${err.message}`);
  }

  const tempInputPath = path.join(
    tempDir,
    `${Date.now()}-${path.basename(filename)}`
  );
  const basename = path.basename(filename.replace(/\.[^/.]+$/, ""));
  // Create output path
  const tempOutputPath = path.join(
    tempDir,
    `processed-${Date.now()}-${basename}.mp4`
  );

  try {
    await pipeline(inputStream, fs.createWriteStream(tempInputPath));

    const compression = getCompressionSettings(fileSize, "video");

    // Process the video file
    await new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          `-preset ${compression.preset}`,
          `-crf ${compression.crf}`,
          "-movflags +faststart",
          "-threads 4",
          "-profile:v main",
          "-pix_fmt yuv420p",
        ])
        .format("mp4")
        .size(compression.resolution)
        .fps(24)
        .on("progress", (progress) => {
          console.log(`Video processing: ${progress.percent}% done`);
        })
        .on("error", reject)
        .on("end", resolve)
        .save(tempOutputPath);
    });

    // Read the processed file
    return await fs.promises.readFile(tempOutputPath);
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    } catch {}
    try {
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch {}
  }
};

// === Upload Functions ===
/**
 * Upload stream to S3
 * @param {Stream} stream - Data stream to upload
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type
 * @returns {Promise} Upload result
 */
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

/**
 * Process and upload video file
 * @param {Stream} fileStream - Video stream
 * @param {string} originalname - Original filename
 * @param {string} mimetype - MIME type
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<Object>} Upload result
 */
const processAndUploadVideo = async (
  fileStream,
  originalname,
  mimetype,
  fileSize
) => {
  let ext = path.extname(originalname).slice(1).toLowerCase();
  if (!["mp4", "webm", "mov"].includes(ext)) {
    ext = "mp4";
  }

  const videoKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  const thumbKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}-thumb.jpg`;

  try {
    const fileBuffer = await withTimeout(
      streamToBuffer(fileStream),
      300000,
      "File buffering timed out"
    );

    const compression = getCompressionSettings(fileSize, "video");

    // Thumbnail
    const thumbnailStream = new PassThrough();
    thumbnailStream.end(Buffer.from(fileBuffer));
    const thumbnailResult = await withTimeout(
      generateVideoThumbnail(thumbnailStream, originalname),
      30000,
      "Thumbnail generation timed out"
    );
    await uploadToS3(
      thumbnailResult.buffer,
      thumbKey,
      thumbnailResult.mimetype
    );

    let processedVideoBuffer;

    if (fileSize <= 50 * 1024 * 1024) {
      const stream = new PassThrough();
      stream.end(Buffer.from(fileBuffer));

      processedVideoBuffer = await withTimeout(
        processVideoStreamDirect(stream, compression),
        300000,
        "Video processing timed out"
      );
    } else {
      const stream = new PassThrough();
      stream.end(Buffer.from(fileBuffer));

      processedVideoBuffer = await withTimeout(
        processVideoStreamFile(stream, originalname, fileSize),
        900000,
        "Video processing timed out"
      );
    }

    await uploadToS3(processedVideoBuffer, videoKey, "video/mp4");

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

/**
 * Process and upload image file
 * @param {Stream} fileStream - Image stream
 * @param {string} originalname - Original filename
 * @param {string} mimetype - MIME type
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<Object>} Upload result
 */
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

/**
 * Upload file to S3 with appropriate processing
 * @param {Stream} fileStream - File stream
 * @param {string} originalname - Original filename
 * @param {string} mimetype - MIME type
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<Object>} Upload result
 */
const uploadFileToS3 = async (fileStream, originalname, mimetype, fileSize) => {
  const cleanName = path.basename(originalname);
  let ext = cleanName.split(".").pop().toLowerCase();
  let finalMime = mimetype;

  console.log("Processing file:", {
    size: fileSize,
    ext,
    name: cleanName,
    mime: finalMime,
  });

  try {
    if (isVideo(ext)) {
      console.log("Video detected:", ext);
      return await withTimeout(
        processAndUploadVideo(fileStream, cleanName, mimetype, fileSize),
        900000,
        "Video upload timed out"
      );
    }

    if (isImage(ext)) {
      return await withTimeout(
        processAndUploadImage(fileStream, cleanName, mimetype, fileSize),
        120000,
        "Image upload timed out"
      );
    }

    // Documents (no zip)
    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ACL: "public-read",
        ContentType: mimetype,
      },
    });

    await upload.done();

    return {
      title: cleanName,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      key,
      thumbnailUrl: null,
    };
  } catch (error) {
    console.error("Upload Error:", error);
    throw new Error(`File processing failed: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} True if successful
 */
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

// module.exports = {
//   s3Client,
//   uploadFileToS3,
//   deleteFileFromS3,
// };
