const cloudinary = require("cloudinary").v2;
const fs = require("fs").promises;
const path = require("path");
const tmp = require("tmp-promise");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const sharp = require("sharp");

ffmpeg.setFfmpegPath(ffmpegPath);

// Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const MIN_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const STREAM_THRESHOLD = 300 * 1024 * 1024; // >300MB use stream

// Generate safe publicId
const generatePublicId = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, ext).replace(/[^a-z0-9]/gi, "_");
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${base}`;
};

// Extract 1 frame from video (for thumbnail)
const extractVideoFrame = async (filePath) => {
  const { path: outputPath, cleanup } = await tmp.file({ postfix: ".jpg" });
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .seekInput(1)
        .outputOptions(["-vframes 1", "-vf scale=180:180", "-q:v 4"])
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });
    return await fs.readFile(outputPath);
  } finally {
    await cleanup();
  }
};

// Compress thumbnail with Sharp
const processThumbnail = async (buffer) => {
  return (
    sharp(buffer)
      .resize(180, 180, { fit: "inside", withoutEnlargement: true })
      // .blur(1)
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
  );
};

// Upload to Cloudinary from buffer or file
const uploadToCloudinary = async (file, options = {}) => {
  return cloudinary.uploader.upload(file, {
    resource_type: "auto",
    ...options,
  });
};

// Upload from stream
const uploadStreamToCloudinary = (stream, options = {}) => {
  return new Promise((resolve, reject) => {
    const cloudinaryStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.pipe(cloudinaryStream);
  });
};

// Upload large video with eager transformations
const uploadVideoWithOptimization = async (filePath, publicId) => {
  const fileSize = (await fs.stat(filePath)).size;

  const uploadOptions = {
    resource_type: "video",
    public_id: publicId,
    eager_async: true,

    eager: [
      // 📺 Mobile-optimized version (smallest size)
      {
        width: 480,
        height: 270,
        crop: "limit",
        quality: "30",
        format: "mp4",
        video_codec: "auto",
        audio_codec: "aac",
        bit_rate: "400k",
      },
      // 📱 SD Version
      {
        width: 640,
        height: 360,
        crop: "limit",
        quality: "50",
        format: "mp4",
        bit_rate: "700k",
        video_codec: "auto",
        audio_codec: "aac",
      },
      // 💻 HD Version
      {
        width: 960,
        height: 540,
        crop: "limit",
        quality: "auto:low",
        format: "mp4",
        video_codec: "auto",
      },
    ],
  };

  if (fileSize > 100 * 1024 * 1024) {
    uploadOptions.chunk_size = 50 * 1024 * 1024;
  }

  if (fileSize > STREAM_THRESHOLD) {
    const readStream = require("fs").createReadStream(filePath);
    return uploadStreamToCloudinary(readStream, uploadOptions);
  }

  return uploadToCloudinary(filePath, uploadOptions);
};

// Main function: Upload video + thumbnail
const uploadToCloudinaryWithThumbnail = async (file, type = "video") => {
  const fileSize = file.size || (await fs.stat(file.path)).size;

  if (type === "video") {
    if (fileSize < MIN_VIDEO_SIZE) {
      throw new Error(
        `Video must be at least ${MIN_VIDEO_SIZE / 1024 / 1024} MB`
      );
    }
    if (fileSize > MAX_VIDEO_SIZE) {
      throw new Error(
        `Video exceeds max allowed size of ${
          MAX_VIDEO_SIZE / 1024 / 1024 / 1024
        } GB`
      );
    }
  }

  const publicId = generatePublicId(file.originalname);
  let result, thumbnailUrl;

  if (type === "video") {
    const thumbnailBuffer = await extractVideoFrame(file.path);
    const processedThumb = await processThumbnail(thumbnailBuffer);

    const thumbnailUpload = await uploadToCloudinary(
      `data:image/jpeg;base64,${processedThumb.toString("base64")}`,
      { public_id: `${publicId}_thumbnail` }
    );
    thumbnailUrl = thumbnailUpload.secure_url;

    result = await uploadVideoWithOptimization(file.path, publicId);
  } else {
    const imageBuffer = await fs.readFile(file.path);
    const processedThumb = await processThumbnail(imageBuffer);

    const thumbnailUpload = await uploadToCloudinary(
      `data:image/jpeg;base64,${processedThumb.toString("base64")}`,
      { public_id: `${publicId}_thumbnail` }
    );
    thumbnailUrl = thumbnailUpload.secure_url;

    result = await uploadToCloudinary(file.path, {
      public_id,
      quality: "auto:good",
    });
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    thumbnailUrl,
    width: result.width,
    height: result.height,
    format: result.format,
    size: result.bytes,
    eagerStatus: type === "video" ? "processing" : "complete",
  };
};

module.exports = {
  uploadToCloudinaryWithThumbnail,
  MIN_VIDEO_SIZE,
  MAX_VIDEO_SIZE,
};
