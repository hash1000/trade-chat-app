const {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { PassThrough } = require("stream");
const { promisify } = require("util");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

// Configure FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// File type checkers
const isImage = (ext) =>
  [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext.toLowerCase());
const isVideo = (ext) =>
  [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext.toLowerCase());

// Helper functions
const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

const bufferToStream = (buffer) => {
  const stream = new PassThrough();
  stream.end(buffer);
  return stream;
};

const generateUniqueKey = (originalname, ext) => {
  const baseName = path.basename(originalname, ext);
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  return `${timestamp}_${random}_${baseName}`;
};

// S3 Upload Functions
const uploadToS3 = async (body, key, mimetype) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: mimetype,
      ACL: "public-read",
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024, // 5MB chunks
  });

  await upload.done();
  return upload;
};

const uploadStreamToS3 = async (stream, key, mimetype) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: mimetype,
      ACL: "public-read",
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
  });

  return upload; // Return without waiting for completion
};

// FFmpeg Processing Functions
const processWithFFmpeg = (inputStream, outputOptions, outputFormat) => {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    ffmpeg(inputStream)
      .outputOptions(outputOptions)
      .output(outputStream)
      .on("error", reject)
      .on("end", () => outputStream.end())
      .run();
  });
};

const processImage = async (buffer, originalname, fileSize) => {
  const ext = path.extname(originalname).toLowerCase().slice(1);
  const settings = getImageCompressionSettings(fileSize);

  // Process main image
  const processedImage = await sharp(buffer)
    .jpeg({
      quality: settings.quality,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();

  // Generate thumbnail
  const thumbnail = await sharp(buffer)
    .resize(settings.thumbnailSize, settings.thumbnailSize, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    processedImage,
    thumbnail,
    mimeType: "image/jpeg",
    thumbnailMimeType: "image/jpeg",
  };
};
const processVideo = async (buffer, originalname) => {
  const ext = path.extname(originalname).substring(1);
  const inputStream = bufferToStream(buffer);

  const processedVideo = await processWithFFmpeg(inputStream, [
    "-c:v libx264",
    "-preset fast",
    "-crf 28",
    "-c:a aac",
    "-b:a 128k",
    "-movflags faststart",
    "-f mp4",
  ]);

  const thumbnail = await processWithFFmpeg(bufferToStream(buffer), [
    "-ss 00:00:01",
    "-vframes 1",
    "-vf scale=640:-1",
    "-q:v 20",
    "-f image2pipe",
  ]);

  return {
    processedVideo,
    processImage,
    thumbnail,
    mimeType: "video/mp4",
    thumbnailMimeType: "image/jpeg",
  };
};
