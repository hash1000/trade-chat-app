const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { PassThrough } = require('stream');

// === Helper Functions ===
const isVideo = (ext) => ['mp4', 'mov', 'avi', 'flv', 'wmv', 'webm', 'mpg', 'mpeg', 'mkv'].includes(ext);
const isImage = (ext) => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'].includes(ext);

// === Compression Settings ===
const getVideoCompressionSettings = (fileSize) => {
  if (fileSize > 100 * 1024 * 1024) return { crf: 32, preset: 'ultrafast', resolution: '256x144' };
  if (fileSize > 50 * 1024 * 1024) return { crf: 28, preset: 'superfast', resolution: '426x240' };
  if (fileSize > 20 * 1024 * 1024) return { crf: 24, preset: 'fast', resolution: '640x360' };
  return { crf: 20, preset: 'medium', resolution: '854x480' };
};

const getImageCompressionSettings = (fileSize) => {
  if (fileSize > 20 * 1024 * 1024) return { quality: 30, thumbnailSize: 120 };
  if (fileSize > 10 * 1024 * 1024) return { quality: 50, thumbnailSize: 200 };
  if (fileSize > 5 * 1024 * 1024) return { quality: 70, thumbnailSize: 300 };
  return { quality: 80, thumbnailSize: 400 };
};

// === Processors ===
const processImage = async (buffer, originalname, fileSize) => {
  const ext = path.extname(originalname).toLowerCase().slice(1);
  const settings = getImageCompressionSettings(fileSize);
  
  // Process main image
  const processedImage = await sharp(buffer)
    .jpeg({ 
      quality: settings.quality,
      progressive: true,
      mozjpeg: true 
    })
    .toBuffer();

  // Generate thumbnail
  const thumbnail = await sharp(buffer)
    .resize(settings.thumbnailSize, settings.thumbnailSize, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 70 })
    .toBuffer();

  return {
    processedImage,
    thumbnail,
    mimeType: 'image/jpeg',
    thumbnailMimeType: 'image/jpeg'
  };
};

const processVideo = async (buffer, originalname, fileSize) => {
  const tempDir = path.join(require('os').tmpdir(), 'video-processing');
  await fs.mkdir(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, `input-${Date.now()}${path.extname(originalname)}`);
  const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`);
  const thumbnailPath = path.join(tempDir, `thumb-${Date.now()}.jpg`);

  try {
    // Write buffer to temp file
    await fs.writeFile(inputPath, buffer);

    // Process video
    const settings = getVideoCompressionSettings(fileSize);
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-preset ${settings.preset}`,
          `-crf ${settings.crf}`,
          '-movflags +faststart',
          '-threads 4',
          '-profile:v main',
          '-pix_fmt yuv420p'
        ])
        .size(settings.resolution)
        .fps(24)
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    // Generate thumbnail
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: 1,
          timemarks: ['10%'],
          size: '160x90',
          filename: path.basename(thumbnailPath),
          folder: tempDir
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const [processedVideo, thumbnail] = await Promise.all([
      fs.readFile(outputPath),
      fs.readFile(thumbnailPath)
    ]);

    return {
      processedVideo,
      thumbnail,
      mimeType: 'video/mp4',
      thumbnailMimeType: 'image/jpeg'
    };
  } finally {
    // Cleanup temp files
    await Promise.all([
      fs.unlink(inputPath).catch(() => {}),
      fs.unlink(outputPath).catch(() => {}),
      fs.unlink(thumbnailPath).catch(() => {})
    ]);
  }
};

module.exports = {
  isVideo,
  isImage,
  processImage,
  processVideo
};