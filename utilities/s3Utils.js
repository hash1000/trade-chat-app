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

const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

const isVideo = (ext) =>
  ["mp4", "mov", "avi", "flv", "wmv", "webm", "mpg", "mpeg", "mkv"].includes(
    ext
  );

const isImage = (ext) =>
  ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"].includes(ext);

const isDocument = (ext) =>
  ["pdf", "doc", "docx", "xls", "xlsx", "txt", "ppt", "pptx"].includes(ext);

const withTimeout = (promise, timeoutMs, errorMsg) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);

const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });

const getCompressionSettings = (fileSize, fileType) => {
  if (fileType === "video") {
    if (fileSize > 100 * 1024 * 1024) {
      return { crf: 26, preset: "veryfast", resolution: "?x480" };
    } else if (fileSize > 50 * 1024 * 1024) {
      return { crf: 23, preset: "veryfast", resolution: "?x720" };
    } else if (fileSize > 20 * 1024 * 1024) {
      return { crf: 21, preset: "faster", resolution: "?x720" };
    }
    return { crf: 20, preset: "faster", resolution: "?x1080" };
  } else if (fileType === "image") {
    if (fileSize > 20 * 1024 * 1024) return { quality: 30, progressive: true };
    if (fileSize > 10 * 1024 * 1024) return { quality: 50, progressive: true };
    if (fileSize > 5 * 1024 * 1024) return { quality: 70, progressive: true };
    return { quality: 80, progressive: true };
  }
  return {
    level:
      fileSize > 50 * 1024 * 1024 ? 9 : fileSize > 10 * 1024 * 1024 ? 5 : 3,
  };
};

const processVideoStreamFile = async (inputStream, filename, fileSize) => {
  const tempDir = path.join(os.tmpdir(), "video-processing");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(
    tempDir,
    `${Date.now()}-${path.basename(filename)}`
  );
  const outputPath = path.join(
    tempDir,
    `processed-${Date.now()}-${path.basename(
      filename,
      path.extname(filename)
    )}.mp4`
  );
  const compression = getCompressionSettings(fileSize, "video");

  try {
    await pipeline(inputStream, fs.createWriteStream(inputPath));

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          `-preset ${compression.preset}`,
          `-crf ${compression.crf}`,
          "-movflags +faststart",
          "-profile:v main",
          "-pix_fmt yuv420p",
        ])
        .size(compression.resolution)
        .fps(30)
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    return await fs.promises.readFile(outputPath);
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
};

const generateVideoThumbnail = async (inputStream, filename) => {
  const tempDir = path.join(os.tmpdir(), "video-thumbs");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, `${Date.now()}-${filename}`);
  const thumbPath = path.join(tempDir, `thumb-${Date.now()}.jpg`);

  try {
    await pipeline(inputStream, fs.createWriteStream(inputPath));

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: 1,
          timemarks: ["10%"],
          filename: path.basename(thumbPath),
          folder: tempDir,
          size: "160x90",
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const buffer = await fs.promises.readFile(thumbPath);
    return {
      buffer,
      name: `${filename.replace(/\.[^/.]+$/, "")}-thumbnail.jpg`,
      mimetype: "image/jpeg",
    };
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    try {
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    } catch {}
  }
};

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
  const buffer = await withTimeout(
    streamToBuffer(fileStream),
    300000,
    "Buffering failed"
  );

  const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
  const thumbKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}-thumb.jpg`;

  const stream1 = new PassThrough();
  stream1.end(Buffer.from(buffer));

  const thumbnail = await withTimeout(
    generateVideoThumbnail(stream1, originalname),
    30000,
    "Thumbnail failed"
  );

  await uploadToS3(thumbnail.buffer, thumbKey, thumbnail.mimetype);

  const stream2 = new PassThrough();
  stream2.end(Buffer.from(buffer));

  const compressed = await withTimeout(
    processVideoStreamFile(stream2, originalname, fileSize),
    900000,
    "Compression failed"
  );

  await uploadToS3(compressed, key, "video/mp4");

  return {
    title: originalname.replace(/\.[^/.]+$/, "") + ".mp4",
    url: `${process.env.IMAGE_END_POINT}/${key}`,
    key,
    thumbnailUrl: `${process.env.IMAGE_END_POINT}/${thumbKey}`,
  };
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
  const thumbKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}-thumb.jpg`;

  const compression = getCompressionSettings(fileSize, "image");

  // Create two buffer copies from original stream
  const fileBuffer = await streamToBuffer(fileStream);

  // Process full image
  const processedImageBuffer = await sharp(fileBuffer)
    .jpeg({
      quality: compression.quality,
      progressive: compression.progressive,
      mozjpeg: true,
    })
    .toBuffer();

  // Generate thumbnail
  const thumbnailResult = await generateImageThumbnail(
    Buffer.from(fileBuffer),
    originalname,
    400
  );

  // Uploads
  await uploadToS3(thumbnailResult.buffer, thumbKey, thumbnailResult.mimetype);
  await uploadToS3(
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
};

const generateImageThumbnail = async (inputBuffer, filename, size) => {
  const buffer = await sharp(inputBuffer)
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70, progressive: true, mozjpeg: true })
    .toBuffer();

  return {
    buffer,
    name: `${filename.replace(/\.[^/.]+$/, "")}-thumbnail.jpg`,
    mimetype: "image/jpeg",
  };
};

const uploadFileToS3 = async (fileStream, originalname, mimetype, fileSize) => {
  const ext = path.extname(originalname).slice(1).toLowerCase();
  const cleanName = path.basename(originalname);

  console.log("Uploading:", { ext, mimetype, size: fileSize });

  if (isVideo(ext)) {
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

  const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  await uploadToS3(fileStream, key, mimetype);

  return {
    title: cleanName,
    url: `${process.env.IMAGE_END_POINT}/${key}`,
    key,
    thumbnailUrl: null,
  };
};

const deleteFileFromS3 = async (key) => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (err) {
    console.error("S3 Deletion Error:", err);
    throw new Error("S3 file deletion failed.");
  }
};

module.exports = {
  s3Client,
  uploadFileToS3,
  deleteFileFromS3,
};
