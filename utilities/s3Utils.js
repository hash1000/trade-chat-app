const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const archiver = require('archiver');

const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

// Configure S3 client
const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// === Helper functions ===
const isLargeFile = (size) => size > 500 * 1024 * 1024;

const processVideoStream = (inputStream, ext) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const outputStream = new PassThrough();
    
    ffmpeg(inputStream)
      .outputOptions("-crf 28")
      .format(ext)
      .pipe(outputStream)
      .on('data', chunk => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
};

const processImageStream = (inputStream) => {
  const transformer = sharp().jpeg({ quality: 70 });
  return new Promise((resolve, reject) => {
    const chunks = [];
    inputStream.pipe(transformer)
      .on('data', chunk => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
};

const zipStream = (inputStream, originalname) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    
    archive.append(inputStream, { name: originalname });
    archive.finalize();
  });
};

// === Upload function ===
const uploadFileToS3 = async (fileStream, originalname, mimetype, fileSize) => {
  let ext = originalname.split('.').pop().toLowerCase();
  let processedStream = fileStream;
  let finalName = originalname;
  let finalMime = mimetype;

  try {
    // For large files, process them in memory without disk storage
    if (isLargeFile(fileSize)) {
      console.log(`Large file detected (${fileSize} bytes). Processing: ${originalname}`);

      if (mimetype.startsWith('video/')) {
        processedStream = await processVideoStream(fileStream, ext);
      } else if (mimetype.startsWith('image/')) {
        processedStream = await processImageStream(fileStream);
      } else {
        processedStream = await zipStream(fileStream, originalname);
        finalName += '.zip';
        ext = 'zip';
        finalMime = 'application/zip';
      }
    }

    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: key,
        Body: processedStream,
        ACL: 'public-read',
        ContentType: finalMime,
      },
    });

    const result = await upload.done();
    console.log("Upload successful:", key);

    return {
      title: finalName,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      key,
    };
  } catch (error) {
    console.error('Upload Error:', error);
    throw new Error('File processing failed');
  }
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
  } catch (error) {
    console.error('Delete Error:', error);
    throw new Error('Failed to delete file from S3');
  }
};

module.exports = { 
  s3Client, 
  uploadFileToS3, 
  deleteFileFromS3 
};