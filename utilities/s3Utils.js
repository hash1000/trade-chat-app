const { S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { PassThrough } = require("stream");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const os = require('os');

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
const isImage = (ext) => [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext.toLowerCase());
const isVideo = (ext) => [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext.toLowerCase());

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

const generateUniqueKey = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const baseName = path.basename(originalname, ext);
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  return {
    mainKey: `${timestamp}_${random}_${baseName}${ext}`,
    thumbKey: `${timestamp}_${random}_${baseName}_thumb.jpg`
  };
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
  return key;
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

  return upload;
};

// FFmpeg Processing Functions
const processWithFFmpeg = (inputStream, outputOptions) => {
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

const processImage = async (buffer, originalname) => {
  const [processedImage, thumbnail] = await Promise.all([
    processWithFFmpeg(bufferToStream(buffer), [
      "-vf scale=1200:-1",
      "-q:v 20",
      "-f image2pipe"
    ]),
    processWithFFmpeg(bufferToStream(buffer), [
      "-vf scale=300:-1",
      "-q:v 30",
      "-f image2pipe"
    ])
  ]);

  return {
    processedImage,
    thumbnail,
    mimeType: "image/jpeg",
    thumbnailMimeType: "image/jpeg"
  };
};

const processVideo = async (buffer, originalname) => {
  const [processedVideo, thumbnail] = await Promise.all([
    processWithFFmpeg(bufferToStream(buffer), [
      "-c:v libx264",
      "-preset fast",
      "-crf 28",
      "-c:a aac",
      "-b:a 128k",
      "-movflags faststart",
      "-f mp4"
    ]),
    processWithFFmpeg(bufferToStream(buffer), [
      "-ss 00:00:01",
      "-vframes 1",
      "-vf scale=640:-1",
      "-q:v 20",
      "-f image2pipe"
    ])
  ]);

  return {
    processedVideo,
    thumbnail,
    mimeType: "video/mp4",
    thumbnailMimeType: "image/jpeg"
  };
};

// Main Upload Functions
const uploadFileToS3 = async (input, originalname, mimetype, fileSize, fileType) => {
  const ext = path.extname(originalname).toLowerCase();
  const { mainKey, thumbKey } = generateUniqueKey(originalname);
  const baseName = path.basename(originalname, ext);

  try {
    // Handle buffer input (memory storage)
    if (Buffer.isBuffer(input)) {
      let result;

      if (fileType === 'image' || isImage(ext)) {
        result = await processImage(input, originalname);
        await Promise.all([
          uploadToS3(result.processedImage, mainKey, result.mimeType),
          uploadToS3(result.thumbnail, thumbKey, result.thumbnailMimeType)
        ]);
      } 
      else if (fileType === 'video' || isVideo(ext)) {
        result = await processVideo(input, originalname);
        await Promise.all([
          uploadToS3(result.processedVideo, mainKey, result.mimeType),
          uploadToS3(result.thumbnail, thumbKey, result.thumbnailMimeType)
        ]);
      } 
      else {
        await uploadToS3(input, mainKey, mimetype);
      }

      return {
        url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
        key: mainKey,
        thumbnailUrl: (fileType === 'image' || fileType === 'video') 
          ? `${process.env.IMAGE_END_POINT}/${thumbKey}`
          : null
      };
    }

    // Handle stream input (disk storage)
    if (typeof input.pipe === 'function') {
      const uploader = await uploadStreamToS3(input, mainKey, mimetype);
      return {
        uploader,
        url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
        key: mainKey,
        thumbnailUrl: null // Can't generate thumbnail from stream
      };
    }

    throw new Error('Invalid input type for upload');
  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  }
};

// Storage-specific upload functions
const uploadToSpacesByMemoryStorage = async (buffer, originalname, mimetype, fileType, fileSize) => {
  return uploadFileToS3(buffer, originalname, mimetype, fileSize, fileType);
};

const uploadToSpacesByDiskStorage = async (stream, originalname, mimetype, fileType, fileSize) => {
  return uploadFileToS3(stream, originalname, mimetype, fileSize, fileType);
};

// Download and Delete Functions
async function getDownloadStreamFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.SPACES_BUCKET_NAME,
    Key: key,
  });

  const { Body } = await s3Client.send(command);
  return Body;
}

async function deleteFileFromS3(key) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.SPACES_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

module.exports = {
  s3Client,
  uploadFileToS3,
  streamToBuffer,
  uploadToSpacesByMemoryStorage,
  uploadToSpacesByDiskStorage,
  getDownloadStreamFromS3,
  deleteFileFromS3,
  uploadStreamToS3,
  processVideo,
  processImage,
  uploadToS3,
  isImage,
  isVideo
};