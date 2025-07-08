// ✅ FILE: utilities/s3Utils.js
const {
  S3Client
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { PassThrough } = require("stream");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs").promises;
const tmp = require("tmp-promise");

ffmpeg.setFfmpegPath(ffmpegPath);

const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

const generateKey = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, ext).replace(/[^a-z0-9]/gi, "_");
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${base}${ext}`;
};

const processImage = async (buffer) => {
  const { path: tmpInputPath, cleanup } = await tmp.file({ postfix: ".jpg" });
  const { path: tmpOutputPath } = await tmp.file({ postfix: ".jpg" });

  try {
    await fs.writeFile(tmpInputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(tmpInputPath)
        .outputOptions(["-vf", "scale=300:-1", "-q:v", "7"])
        .output(tmpOutputPath)
        .on("start", (cmd) => console.log("FFmpeg command:", cmd))
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    return await fs.readFile(tmpOutputPath);
  } finally {
    await cleanup();
  }
};

const processVideo = async (buffer) => {
  const { path: tmpInputPath, cleanup } = await tmp.file({ postfix: '.mp4' });
  const { path: tmpOutputPath } = await tmp.file({ postfix: '.jpg' });

  try {
    // Save buffer to temp file
    await fs.writeFile(tmpInputPath, buffer);

    // Use FFmpeg to extract thumbnail from temp file
    await new Promise((resolve, reject) => {
      ffmpeg(tmpInputPath)
        .seekInput(1) // 1 second into video
        .outputOptions(["-vframes", "1", "-vf", "scale=300:-1", "-q:v", "4"])
        .output(tmpOutputPath)
        .on("start", (cmd) => console.log("FFmpeg video command:", cmd))
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    return await fs.readFile(tmpOutputPath);
  } finally {
    await cleanup();
  }
};


const bufferToStream = (buffer) => {
  const stream = new PassThrough();
  stream.end(buffer);
  return stream;
};

const uploadToS3 = async (body, key, contentType) => {
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
  await upload.done();
  return `${process.env.IMAGE_END_POINT}/${key}`;
};

const uploadStreamToS3 = async (stream, key, contentType, contentLength, progressCallback) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: contentType,
      ACL: "public-read",
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
  });
  upload.on("httpUploadProgress", (progress) => {
    if (progressCallback) progressCallback(progress);
  });
  return upload;
};

const uploadStreamFileToS3 = async (buffer, originalname, mimetype, fileType = 'video') => {
  const mainKey = generateKey(originalname);
  let thumbnailUrl = null;

  await uploadToS3(buffer, mainKey, mimetype);

  try {
    const thumbKey = `${path.parse(mainKey).name}_thumb.jpg`;
    const thumbnailBuffer = fileType === 'image'
      ? await processImage(buffer)
      : await processVideo(buffer);

    thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, 'image/jpeg');
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
  }

  return {
    url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
    key: mainKey,
    thumbnailUrl,
  };
  
};

const uploadMemoryFileToS3 = async (buffer, originalname, mimetype, fileType) => {
  const mainKey = generateKey(originalname);
  let thumbnailUrl = null;

  // Upload original file to S3
  await uploadToS3(buffer, mainKey, mimetype);

  try {
    const thumbKey = `${path.parse(mainKey).name}_thumb.jpg`;

    if (fileType === 'image') {
      const thumbnailBuffer = await processImage(buffer);
      // await fs.writeFile('debug_image_thumb.jpg', thumbnailBuffer); // Optional debug
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, 'image/jpeg');

      console.log(`[Image] Thumbnail uploaded: ${thumbnailUrl}`);
    }

    if (fileType === 'video') {
      const thumbnailBuffer = await processVideo(buffer);
      // await fs.writeFile('debug_video_thumb.jpg', thumbnailBuffer); // Optional debug
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, 'image/jpeg');

      console.log(`[Video] Thumbnail uploaded: ${thumbnailUrl}`);
    }

  } catch (err) {
    console.error('Thumbnail generation failed:', err.message);
  }

  return {
    url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
    key: mainKey,
    thumbnailUrl,
    size: buffer.length,
    mimeType: mimetype,
    fileType
  };
};

const uploadDiskFileToS3 = async (filePath, originalname, mimetype, fileType) => {
  const buffer = await fs.readFile(filePath);
  const mainKey = generateKey(originalname);
  let thumbnailUrl = null;

  // Upload original file
  await uploadToS3(buffer, mainKey, mimetype);

  try {
    const thumbKey = `${path.parse(mainKey).name}_thumb.jpg`;

    if (fileType === 'image') {
      const thumbnailBuffer = await processImage(buffer);
      // await fs.writeFile('debug_image_thumb_from_disk.jpg', thumbnailBuffer); // Optional debug
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, 'image/jpeg');
    }

    if (fileType === 'video') {
      const thumbnailBuffer = await processVideo(buffer);
      // await fs.writeFile('debug_video_thumb_from_disk.jpg', thumbnailBuffer); // Optional debug
      thumbnailUrl = await uploadToS3(thumbnailBuffer, thumbKey, 'image/jpeg');
    }

  } catch (err) {
    console.error('Disk upload thumbnail failed:', err.message);
  }

  return {
    url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
    key: mainKey,
    thumbnailUrl,
  };
};


module.exports = {
  uploadToS3,
  uploadStreamToS3,
  uploadStreamFileToS3,
  processImage,
  processVideo,
  bufferToStream,
  uploadMemoryFileToS3,
  uploadDiskFileToS3,
  generateKey
};