// ✅ FILE: utilities/s3Utils.js
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { PassThrough } = require("stream");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs").promises;
const fps = require("fs");
const tmp = require("tmp-promise");
const sharp = require("sharp");

ffmpeg.setFfmpegPath(ffmpegPath);

const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

const awsS3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const generateKey = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, ext).replace(/[^a-z0-9]/gi, "_");
  return `${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}_${base}${ext}`;
};

const determineCompression = (size) => {
  // Target size is 50MB (50 * 1024 * 1024 bytes)
  const targetSize = 50 * 1024 * 1024;

  // Calculate compression ratio based on original size vs target size
  // We'll use a logarithmic scale to be more aggressive with larger files
  if (size <= 100 * 1024 * 1024) {
    // For files up to 100MB, use moderate compression
    return 0.7; // 30% reduction
  } else if (size <= 300 * 1024 * 1024) {
    // For files 100-300MB, use more aggressive compression
    return 0.5; // 50% reduction
  } else if (size <= 500 * 1024 * 1024) {
    // For files 300-500MB, use very aggressive compression
    return 0.3; // 70% reduction
  } else {
    // For files >500MB, use maximum compression
    return 0.2; // 80% reduction
  }
};

const processImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .resize(180, 180, {
        fit: "inside",
        withoutEnlargement: true,
      })
      // .blur(1)
      .jpeg({
        quality: 80,
        mozjpeg: true,
      })
      .toBuffer();
  } catch (err) {
    console.error("Sharp processing error:", err);
    throw err;
  }
};

const processVideo = async (buffer) => {
  const { path: tmpInputPath, cleanup } = await tmp.file({ postfix: ".mp4" });
  const { path: tmpOutputPath } = await tmp.file({ postfix: ".jpg" });

  try {
    await fs.writeFile(tmpInputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(tmpInputPath)
        .seekInput(1)
        .outputOptions(["-vframes", "1", "-vf", "scale=180:180", "-q:v", "4"])
        .output(tmpOutputPath)
        .on("start", (cmd) => console.log("FFmpeg video command:", cmd))
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Process the extracted frame with sharp for blur and quality
    const frameBuffer = await fs.readFile(tmpOutputPath);
    return await sharp(frameBuffer)
      // .blur(1)
      .jpeg({
        quality: 80,
        mozjpeg: true,
      })
      .toBuffer();
  } finally {
    await cleanup();
  }
};

const processVideoStream = async (buffer) => {
  console.log("Starting video thumbnail generation");
  const { path: tmpInputPath, cleanup: inputCleanup } = await tmp.file({
    postfix: ".mp4",
  });
  const { path: tmpOutputPath, cleanup: outputCleanup } = await tmp.file({
    postfix: ".jpg",
  });

  try {
    await fs.writeFile(tmpInputPath, buffer);
    console.log("Temporary video file written for thumbnail generation");

    await new Promise((resolve, reject) => {
      console.log("Starting FFmpeg thumbnail extraction");
      ffmpeg(tmpInputPath)
        .seekInput(1)
        .outputOptions(["-vframes", "1", "-vf", "scale=180:180", "-q:v", "4"])
        .output(tmpOutputPath)
        .on("start", (cmd) => console.log("FFmpeg command:", cmd))
        .on("end", () => {
          console.log("Thumbnail extraction completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .run();
    });

    const frameBuffer = await fs.readFile(tmpOutputPath);
    console.log("Processing thumbnail with sharp");

    const processedThumbnail = await sharp(frameBuffer)
      // .blur(1)
      .jpeg({
        quality: 80,
        mozjpeg: true,
      })
      .toBuffer();

    console.log("Thumbnail processing complete");
    return processedThumbnail;
  } catch (err) {
    console.error("Video thumbnail generation failed:", err);
    throw err;
  } finally {
    await Promise.all([inputCleanup(), outputCleanup()]);
    console.log("Thumbnail temp files cleaned up");
  }
};

const compressVideoStream = async (inputPath, outputPath, originalSize) => {
  console.log(`Compressing ${inputPath} -> ${outputPath}`);

  // First probe the input
  const metadata = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  // Get duration from metadata or default to 60 seconds
  const duration = metadata.format.duration || 60; // <-- Added this line

  // More aggressive settings for MPG
  const isMpg = path.extname(inputPath).toLowerCase() === ".mpg";
  let crf = isMpg ? 26 : 23;
  let preset = isMpg ? "fast" : "medium";
  const videoStream = metadata.streams.find((s) => s.codec_type === "video");

  if (videoStream) {
    const width = videoStream.width || 1920;
    if (width > 1920) {
      crf = 26; // More compression for 4K+
      preset = "fast"; // Faster preset for large files
    } else if (width > 1280) {
      crf = 24; // Moderate compression for Full HD
    } else {
      crf = 22; // Less compression for smaller videos
    }
  }

  // Adjust based on original size
  if (originalSize > 300 * 1024 * 1024) {
    crf += 2; // More compression for very large files
    preset = "fast";
  } else if (originalSize > 100 * 1024 * 1024) {
    crf += 1;
  }

  console.log(`Compression settings: CRF=${crf}, preset=${preset}`);

  try {
    await new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          `-crf`,
          `${crf}`,
          `-preset`,
          preset,
          "-movflags",
          "+faststart",
          "-profile:v",
          "main",
          "-pix_fmt",
          "yuv420p",
          "-threads",
          "0", // Use all available threads
        ])
        .on("start", (cmd) => console.log("FFmpeg command:", cmd))
        .on("progress", (progress) => {
          console.log(`Compression progress: ${JSON.stringify(progress)}`);
        })
        .on("end", () => {
          console.log("Compression completed successfully");
          resolve();
        })
        .on("error", (err) => {
          console.error("Compression error:", err);
          reject(err);
        });

      // Timeout based on video duration (1 minute per minute of video)
      const timeoutDuration = Math.max(60000, duration * 60000);
      const timeout = setTimeout(() => {
        command.kill("SIGTERM");
        reject(
          new Error(
            `Compression timed out after ${timeoutDuration / 60000} minutes`
          )
        );
      }, timeoutDuration);

      command.on("end", () => clearTimeout(timeout));
      command.save(outputPath);
    });

    // Verify output file exists
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error("Compression failed - output file is empty");
    }

    return true;
  } catch (err) {
    // Clean up potentially corrupted output file
    await fs.unlink(outputPath).catch(() => {});
    throw err;
  }
};

const bufferToStream = (buffer) => {
  const stream = new PassThrough();
  stream.end(buffer);
  return stream;
};

const uploadToS3 = async (body, key, contentType) => {
  console.time(`Upload:${key}`);
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000",
    },
  });
  console.log(`[Upload Success] File uploaded to S3 as ${key}`);
  await upload.done();
  console.timeEnd(`Upload:${key}`);
  return `${process.env.IMAGE_END_POINT}/${key}`;
};

async function handleVideoStreamUpload(
  inputPath,
  socketId,
  fileName,
  contentLength
) {
  console.log(`Processing video from ${inputPath}`);

  const { path: compressedPath, cleanup } = await tmp.file({
    postfix: "_compressed.mp4",
  });

  try {
    if (contentLength > 50 * 1024 * 1024) {
      console.log(`Compressing video...`);
      await compressVideoStream(inputPath, compressedPath, contentLength);
    } else {
      console.log("No compression needed");
      await fs.copyFile(inputPath, compressedPath);
    }

    const key = generateKey(fileName);
    console.log(`Uploading to S3 with key ${key}`);

    // Stream directly from disk
    const fileStream = fps.createReadStream(compressedPath);
    const url = await uploadToS3(fileStream, key, "video/mp4");

    console.log("Generating thumbnail");
    // Read the compressed file for thumbnail generation
    const compressedFileBuffer = await fps.readFile(compressedPath);
    const thumbnailBuffer = await processVideoStream(compressedFileBuffer);
    const thumbKey = `${path.parse(key).name}_thumb.jpg`;
    const thumbnailUrl = await uploadToS3(
      thumbnailBuffer,
      thumbKey,
      "image/jpeg"
    );

    // Get actual compressed size
    const stats = await fs.stat(compressedPath);

    console.log("Video upload complete:", {
      key,
      url,
      size: stats.size, // Use actual compressed size
      thumbnailUrl,
    });

    return {
      key,
      url,
      size: stats.size, // Return compressed size
      mimeType: "video/mp4",
      thumbnailUrl,
    };
  } finally {
    await cleanup();
    console.log("Temporary files cleaned up");
  }
}

const uploadMemoryFileToS3 = async (
  buffer,
  originalname,
  mimetype,
  fileType
) => {
  const mainKey = generateKey(originalname);
  let thumbnailUrl = null;

  await uploadToS3(buffer, mainKey, mimetype);

  try {
    const thumbKey = `${path.parse(mainKey).name}_thumb.jpg`;

    if (fileType === "image") {
      const thumbnailBuffer = await processImage(buffer);
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, "image/jpeg");
      console.log(`[Image] Thumbnail uploaded: ${thumbnailUrl}`);
    }

    if (fileType === "video") {
      const thumbnailBuffer = await processVideo(buffer);
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, "image/jpeg");
      console.log(`[Video] Thumbnail uploaded: ${thumbnailUrl}`);
    }
  } catch (err) {
    console.error("Thumbnail generation failed:", err.message);
  }

  return {
    url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
    key: mainKey,
    thumbnailUrl,
    size: buffer.length,
    mimeType: mimetype,
    fileType,
  };
};

const uploadDiskFileToS3 = async (
  filePath,
  originalname,
  mimetype,
  fileType
) => {
  const buffer = await fs.readFile(filePath);
  const mainKey = generateKey(originalname);
  let thumbnailUrl = null;
  console.log("Uploading file to S3:", filePath, mimetype, fileType);

  await uploadToS3(buffer, mainKey, mimetype);

  try {
    const thumbKey = `${path.parse(mainKey).name}_thumb.jpg`;

    if (fileType === "image") {
      const thumbnailBuffer = await processImage(buffer);
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, "image/jpeg");
    }

    if (fileType === "video") {
      const thumbnailBuffer = await processVideo(buffer);
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, "image/jpeg");
    }
  } catch (err) {
    console.error("Disk upload thumbnail failed:", err.message);
  }

  return {
    url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
    key: mainKey,
    thumbnailUrl,
  };
};

const uploadLargeFileToS3 = async ({
  fileBuffer,
  fileName,
  mimetype,
  fileType,
}) => {
  const originalSize = fileBuffer.length;
  const key = generateKey(fileName);
  let processedBuffer = fileBuffer;

  // Compress if fileType is video and size > 100MB
  if (fileType === "video" && originalSize > 100 * 1024 * 1024) {
    console.log("Compressing large video before upload...");
    const { path: inputPath, cleanup } = await tmp.file({ postfix: ".mp4" });
    const compressedPath = inputPath.replace(".mp4", "_compressed.mp4");

    try {
      await fs.writeFile(inputPath, fileBuffer);
      const compressionRatio = determineCompression(originalSize);
      await compressVideoStream(inputPath, compressedPath, compressionRatio);
      processedBuffer = await fs.readFile(compressedPath);
      console.log("Video compressed successfully");
    } catch (err) {
      console.error("Video compression failed:", err);
      throw err;
    } finally {
      await cleanup();
    }
  }

  // Upload the main video file to AWS
  const stream = new PassThrough();
  stream.end(processedBuffer);

  const upload = new Upload({
    client: awsS3Client,
    params: {
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: stream,
      ContentType: mimetype,
      CacheControl: "public, max-age=31536000",
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
    leavePartsOnError: false,
  });

  await upload.done();
  console.log("Video uploaded:", key);

  // Generate and upload thumbnail
  let thumbnailUrl = null;
  try {
    const thumbKey = `${path.parse(key).name}_thumb.jpg`;
    let thumbnailBuffer;

    if (fileType === "video") {
      thumbnailBuffer = await processVideo(processedBuffer);
    } else if (fileType === "image") {
      thumbnailBuffer = await processImage(processedBuffer);
    } else {
      throw new Error("Unsupported file type for thumbnail generation");
    }

    const thumbUpload = new Upload({
      client: awsS3Client,
      params: {
        Bucket: process.env.AWS_BUCKET,
        Key: thumbKey,
        Body: thumbnailBuffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000",
      },
    });

    await thumbUpload.done();
    thumbnailUrl = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbKey}`;
  } catch (err) {
    console.warn("Thumbnail generation failed:", err.message);
  }

  return {
    key,
    url: `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    size: processedBuffer.length,
    mimeType: mimetype,
    thumbnailUrl,
  };
};

module.exports = {
  uploadToS3,
  uploadLargeFileToS3,
  handleVideoStreamUpload,
  processImage,
  processVideo,
  bufferToStream,
  uploadMemoryFileToS3,
  uploadDiskFileToS3,
  generateKey,
};
