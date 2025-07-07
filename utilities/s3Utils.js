const { S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const fs = require('fs');
const { PassThrough, pipeline } = require("stream");
const { promisify } = require('util');
const { isVideo, isImage, processImage, processVideo } = require('./fileProcessors');
const path = require('path');

const pipelineAsync = promisify(pipeline);

const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// Direct stream upload without processing
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

  await upload.done();
  return upload;
};

// Process and upload (for smaller files that can be buffered)
const uploadProcessedFileToS3 = async (buffer, originalname, mimetype, fileSize, fileType) => {
  const ext = path.extname(originalname).toLowerCase().slice(1);
  const baseName = path.basename(originalname, `.${ext}`);
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  
  let mainKey, thumbKey;

  if (fileType === 'image' || isImage(ext)) {
    // Process image
    const result = await processImage(buffer, originalname, fileSize);
    mainKey = `${timestamp}_${random}_${baseName}.jpg`;
    thumbKey = `${timestamp}_${random}_${baseName}_thumb.jpg`;
    
    await Promise.all([
      uploadToS3(result.processedImage, mainKey, result.mimeType),
      uploadToS3(result.thumbnail, thumbKey, result.thumbnailMimeType)
    ]);
  } 
  else if (fileType === 'video' || isVideo(ext)) {
    // Process video
    const result = await processVideo(buffer, originalname, fileSize);
    mainKey = `${timestamp}_${random}_${baseName}.mp4`;
    thumbKey = `${timestamp}_${random}_${baseName}_thumb.jpg`;
    
    await Promise.all([
      uploadToS3(result.processedVideo, mainKey, result.mimeType),
      uploadToS3(result.thumbnail, thumbKey, result.thumbnailMimeType)
    ]);
  } 
  else {
    // Document or other file type
    mainKey = `${timestamp}_${random}_${originalname}`;
    await uploadToS3(buffer, mainKey, mimetype);
  }

  return {
    title: baseName,
    url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
    key: mainKey,
    thumbnailUrl: thumbKey ? `${process.env.IMAGE_END_POINT}/${thumbKey}` : null
  };
};

// Unified upload function that routes based on input type
const uploadFileToS3 = async (input, originalname, mimetype, fileSize, fileType) => {
  // If input is a buffer, use processed upload
  if (Buffer.isBuffer(input)) {
    return uploadProcessedFileToS3(input, originalname, mimetype, fileSize, fileType);
  }
  
  // If input is a file path, create read stream
  if (typeof input === 'string') {
    const stream = fs.createReadStream(input);
    return uploadStreamToS3(stream, originalname, mimetype);
  }
  
  // If input is a stream, upload directly
  if (typeof input.pipe === 'function') {
    const ext = path.extname(originalname).toLowerCase().slice(1);
    const baseName = path.basename(originalname, `.${ext}`);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const mainKey = `${timestamp}_${random}_${originalname}`;
    
    await uploadStreamToS3(input, mainKey, mimetype);
    
    return {
      title: baseName,
      url: `${process.env.IMAGE_END_POINT}/${mainKey}`,
      key: mainKey,
      thumbnailUrl: null // Can't generate thumbnail from stream
    };
  }
  
  throw new Error('Invalid input type for upload');
};

// Memory storage upload (buffers)
const uploadToSpacesByMemoryStorage = async (buffer, key, mimetype, fileType) => {
  return uploadFileToS3(
    buffer, 
    key, 
    mimetype, 
    buffer.length,
    fileType
  );
};

// Disk storage upload (streams)
const uploadToSpacesByDiskStorage = async (filePath, key, mimetype, fileType) => {
  const { size } = await fs.promises.stat(filePath);
  const result = await uploadFileToS3(
    filePath, 
    key, 
    mimetype, 
    size,
    fileType
  );

  // Clean up temp file
  await fs.promises.unlink(filePath).catch(console.error);
  return result;
};

// Helper to convert buffer to stream
const bufferToStream = (buffer) => {
  const stream = new PassThrough();
  stream.end(buffer);
  return stream;
};

// Download stream
async function getDownloadStreamFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.SPACES_BUCKET_NAME,
    Key: key,
  });

  const { Body } = await s3Client.send(command);
  return Body;
}

// Delete file
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
  uploadToSpacesByMemoryStorage,
  uploadToSpacesByDiskStorage,
  getDownloadStreamFromS3,
  deleteFileFromS3,
  uploadStreamToS3,
};