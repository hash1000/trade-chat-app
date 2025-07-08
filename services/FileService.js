const path = require("path");
const { PassThrough } = require("stream");
const {
  uploadMemoryFileToS3,
  uploadDiskFileToS3,
  uploadStreamFileToS3,
  deleteFileFromS3,
  getDownloadStreamFromS3,
} = require("../utilities/s3Utils");
const {
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError,
} = require("../utilities/socketUtils");

class FileService {
  constructor() {
    this.uploadProgress = {};
  }

  // 🔹 Handle memory-based upload (e.g., from multer memoryStorage)
  async processMemoryUpload({ buffer, originalname, mimetype, size }) {
    const ext = path.extname(originalname).toLowerCase();
    const fileType = this.detectFileType(ext);

    const result = await uploadMemoryFileToS3(buffer, originalname, mimetype, fileType);

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

  // 🔹 Handle disk-based upload (e.g., multer diskStorage)
  async processDiskUpload({ filePath, originalname, mimetype, size }) {
    const ext = path.extname(originalname).toLowerCase();
    const fileType = this.detectFileType(ext);

    const result = await uploadDiskFileToS3(filePath, originalname, mimetype, fileType);

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

  // 🔹 Handle streaming upload (chunked stream + buffer for thumbnail)
  async processStreamUpload({ req, fileName, contentType, contentLength, socketId }) {
    const ext = path.extname(fileName).toLowerCase();
    const fileType = this.detectFileType(ext);
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

    const result = await uploadStreamFileToS3(buffer, fileName, contentType, fileType);

    console.log("Stream upload successful:", result,{
      name: sanitized.baseName,
      url: result.url,
      key: result.key,
      thumbnailUrl: result.thumbnailUrl,
      size: contentLength,
      mimeType: contentType,
      fileType,
    });
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

  // 🔹 Emit event on complete upload
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

  // 🔹 Emit upload error
  emitUploadError(socketId, message) {
    emitUploadError(socketId, message);
  }

  // 🔹 Delete file from S3
  async deleteFile(key) {
    try {
      await deleteFileFromS3(key);
      return { success: true };
    } catch (error) {
      console.error("File deletion error:", error);
      throw error;
    }
  }

  // 🔹 Download stream
  async getDownloadStream(key) {
    try {
      return await getDownloadStreamFromS3(key);
    } catch (error) {
      console.error("File download error:", error);
      throw error;
    }
  }

  // 🔹 Sanitize filename for S3-safe keys
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

  // 🔹 Detect file type from extension
  detectFileType(ext) {
    if (!ext) return "other";
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
    if ([".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext)) return "video";
    if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"].includes(ext)) return "document";
    return "other";
  }
}

module.exports = FileService;
