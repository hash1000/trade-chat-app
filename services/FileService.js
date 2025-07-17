// ✅ FILE: services/fileService.js
const path = require("path");
const { PassThrough } = require("stream");
const fs = require("fs").promises;
const {
  uploadMemoryFileToS3,
  uploadDiskFileToS3,
  handleVideoStreamUpload,
  deleteFileFromS3,
  getDownloadStreamFromS3
} = require("../utilities/s3Utils");
const {
  uploadToCloudinaryWithThumbnail,
  MIN_VIDEO_SIZE,
  MAX_VIDEO_SIZE
} = require("../utilities/cloudinaryUtils");
const {
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError
} = require("../utilities/socketUtils");

class FileService {
  constructor() {
    this.uploadProgress = {};
  }

  async processMemoryUpload({
    buffer,
    originalname,
    mimetype,
    size,
    fileType,
  }) {
    const result = await uploadMemoryFileToS3(
      buffer,
      originalname,
      mimetype,
      fileType
    );
    return {
      name: originalname,
      url: result.url,
      key: result.key,
      thumbnailUrl: result.thumbnailUrl,
      size,
      mimeType: mimetype,
      fileType,
    };
  }

  async processDiskUpload({
    fileType,
    filePath,
    originalname,
    mimetype,
    size,
  }) {
    const result = await uploadDiskFileToS3(
      filePath,
      originalname,
      mimetype,
      fileType
    );

    return {
      name: originalname,
      url: result.url,
      key: result.key,
      thumbnailUrl: result.thumbnailUrl,
      size,
      mimeType: mimetype,
      fileType,
    };
  }

  async processStreamUpload({ req, fileName, contentType, contentLength, socketId, fileType }) {
    const sanitized = this.sanitizeFilename(fileName);

    const passThrough = new PassThrough();
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
      passThrough.write(chunk);

      if (socketId && contentLength) {
        emitUploadProgress(socketId, {
          fileId: sanitized.link,
          progress: Math.floor((Buffer.concat(chunks).length / contentLength) * 100),
        });
      }
    });

    req.on("end", () => passThrough.end());

    const buffer = await new Promise((resolve) => {
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const result = await handleVideoStreamUpload(buffer, socketId, fileName, contentLength);

    return {
      name: sanitized.baseName,
      url: result.url,
      key: result.key,
      thumbnailUrl: result.thumbnailUrl,
      size: contentLength,
      mimeType: contentType,
      fileType,
    };
  }

  validateVideoSize(fileSize) {
    if (fileSize < MIN_VIDEO_SIZE) {
      throw new Error(`Video must be at least ${MIN_VIDEO_SIZE/1024/1024}MB`);
    }
    if (fileSize > MAX_VIDEO_SIZE) {
      throw new Error(`Video cannot exceed ${MAX_VIDEO_SIZE/1024/1024/1024}GB`);
    }
    return true;
  }

  async processCloudinaryUpload({ file, type }) {
    try {
      if (type === 'video') {
        const fileSize = file.size || (await fs.stat(file.path)).size;
        this.validateVideoSize(fileSize);
      }
      return await uploadToCloudinaryWithThumbnail(file, type);
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  emitUploadComplete({
    socketId,
    fileId,
    fileName,
    contentLength,
    key,
    thumbnailUrl,
    fileType,
  }) {
    emitUploadComplete(socketId, {
      fileId,
      name: fileName,
      size: contentLength,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      thumbnailUrl: thumbnailUrl
        ? `${process.env.IMAGE_END_POINT}/${thumbnailUrl.split("/").pop()}`
        : null,
      hash: "stream-uploaded",
      fileType,
    });
  }

  emitUploadError(socketId, message) {
    emitUploadError(socketId, message);
  }

  async deleteFile(key) {
    try {
      await deleteFileFromS3(key);
      return { success: true };
    } catch (error) {
      console.error("File deletion error:", error);
      throw error;
    }
  }

  async getDownloadStream(key) {
    try {
      return await getDownloadStreamFromS3(key);
    } catch (error) {
      console.error("File download error:", error);
      throw error;
    }
  }

  sanitizeFilename(originalName) {
    const name = originalName.toLowerCase();
    const extension = name.split(".").pop();
    const baseName = path
      .basename(name, `.${extension}`)
      .replace(/[^a-z0-9-_]/gi, "_")
      .substring(0, 100);

    const link = `${Date.now()}_${Math.round(
      Math.random() * 1e9
    )}_${baseName}.${extension}`;

    return {
      baseName,
      extension,
      link,
    };
  }
}

module.exports = FileService;