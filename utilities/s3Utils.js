// ✅ FILE: utilities/s3Utils.js
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { PassThrough } = require("stream");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs").promises;
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
  if (size <= 100 * 1024 * 1024) return 0.8; // 20% reduction
  if (size <= 200 * 1024 * 1024) return 0.7; // 30%
  if (size <= 500 * 1024 * 1024) return 0.5; // 50%
  return 1.0; // no compression for large files
};

const processImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .resize(144, 144, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .blur(1)
      .jpeg({
        quality: 40,
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
        .outputOptions(["-vframes", "1", "-vf", "scale=144:144", "-q:v", "4"])
        .output(tmpOutputPath)
        .on("start", (cmd) => console.log("FFmpeg video command:", cmd))
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Process the extracted frame with sharp for blur and quality
    const frameBuffer = await fs.readFile(tmpOutputPath);
    return await sharp(frameBuffer)
      .blur(1)
      .jpeg({
        quality: 40,
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
        .outputOptions(["-vframes", "1", "-vf", "scale=144:144", "-q:v", "4"])
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
      .blur(1)
      .jpeg({
        quality: 40,
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

const compressVideoStream = (inputPath, outputPath, compressionRatio) => {
  return new Promise((resolve, reject) => {
    console.log(`Starting video compression: ${inputPath} -> ${outputPath}`);

    const command = ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .videoBitrate(compressionRatio * 1000 + "k")
      .on("start", (cmd) => {
        console.log("FFmpeg command:", cmd);
      })
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
      })
      .save(outputPath);
  });
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
  console.log(`[Upload Success] File uploaded to S3 as ${key}`); // Changed this line
  await upload.done();
  console.timeEnd(`Upload:${key}`);
  return `${process.env.IMAGE_END_POINT}/${key}`;
};

// ✅ FILE: utils/s3Utils.js
async function handleVideoStreamUpload(
  buffer,
  socketId,
  fileName,
  contentLength
) {
  console.log(
    `Starting video processing for ${fileName} (${buffer.length} bytes)`
  );

  const { path: inputPath, cleanup } = await tmp.file({ postfix: ".mp4" });
  const compressedPath = inputPath.replace(".mp4", "_compressed.mp4");

  try {
    await fs.writeFile(inputPath, buffer);
    console.log(`Temporary file created at ${inputPath}`);

    const compressionRatio = determineCompression(contentLength);
    console.log(`Determined compression ratio: ${compressionRatio}`);

    if (compressionRatio < 1) {
      console.log(`Compressing video with ratio ${compressionRatio}`);
      await compressVideoStream(inputPath, compressedPath, compressionRatio);
      console.log("Video compression completed");
    } else {
      console.log("No compression needed, copying file");
      await fs.copyFile(inputPath, compressedPath);
    }

    const finalBuffer = await fs.readFile(compressedPath);
    console.log(`Final video size: ${finalBuffer.length} bytes`);

    const key = generateKey(fileName);
    console.log(`Uploading to S3 with key ${key}`);
    const url = await uploadToS3(finalBuffer, key, "video/mp4");

    console.log("Generating thumbnail");
    const thumbnailBuffer = await processVideoStream(finalBuffer);
    const thumbKey = `${path.parse(key).name}_thumb.jpg`;
    const thumbnailUrl = await uploadToS3(
      thumbnailBuffer,
      thumbKey,
      "image/jpeg"
    );

    console.log("Video upload complete:", {
      key,
      url,
      size: finalBuffer.length,
      thumbnailUrl,
    });

    return {
      key,
      url,
      size: finalBuffer.length,
      mimeType: "video/mp4",
      compressionRatio,
      thumbnailUrl,
    };
  } finally {
    await cleanup();
    console.log("Temporary files cleaned up");
  }
}

// const uploadStreamFileToS3 = async (buffer, originalname, mimetype, fileType = 'video') => {
//   const mainKey = generateKey(originalname);
//   let thumbnailUrl = null;

//   await uploadToS3(buffer, mainKey, mimetype);

//   try {
//     const thumbKey = `${path.parse(mainKey).name}_thumb.jpg`;
//     const thumbnailBuffer = fileType === 'image'
//       ? await processImage(buffer)
//       : await processVideo(buffer);

//     thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, 'image/jpeg');
//   } catch (err) {
//     console.error('Thumbnail generation failed:', err);
//   }

//   return {
//     url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
//     key: mainKey,
//     thumbnailUrl,
//   };
// };

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
      thumbnailBuffer = await processVideo(processedBuffer); // ✅ this uses FFmpeg + Sharp
    } else if (fileType === "image") {
      thumbnailBuffer = await processImage(processedBuffer); // ✅ this uses Sharp only
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
  // uploadStreamFileToS3,
  uploadLargeFileToS3,
  handleVideoStreamUpload,
  processImage,
  processVideo,
  bufferToStream,
  uploadMemoryFileToS3,
  uploadDiskFileToS3,
  generateKey,
};
