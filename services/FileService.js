const { PassThrough } = require("stream");
const path = require("path");
const {
  uploadFileToS3,
  deleteFileFromS3,
  getDownloadStreamFromS3,
  uploadToSpacesByMemoryStorage,
  uploadToSpacesByDiskStorage,
  streamToBuffer,
  processVideo,
  uploadToS3,
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

  /**
   * Process file upload (memory or disk)
   */
async processUpload({
    fileData,
    originalname,
    mimetype,
    size,
    storageType,
    fileType = 'auto'
  }) {
    try {
      const sanitized = this.sanitizeFilename(originalname);
      
      // Always use memory storage processing for consistent behavior
      const result = await uploadToSpacesByMemoryStorage(
        fileData,
        originalname,
        mimetype,
        fileType,
        size
      );

      return {
        title: sanitized.baseName,
        url: result.url,
        key: result.key,
        thumbnailUrl: result.thumbnailUrl,
        size: size,
        mimeType: mimetype,
        fileType: fileType === 'auto' ? this.detectFileType(originalname) : fileType,
      };
    } catch (error) {
      console.error("File processing error:", error);
      throw error;
    }
  }
  
async processStreamUpload({
  req,
  fileName,
  contentType,
  contentLength,
  socketId,
  fileType = "auto",
}) {
  const sanitized = this.sanitizeFilename(fileName);
  const keyBase = sanitized.link.replace(/\.[^.]+$/, ''); // Remove extension for consistency

  try {
    const buffer = await streamToBuffer(req); // Collect whole buffer

    const trueFileType = fileType === 'auto' ? this.detectFileType(fileName) : fileType;

    let result = {};
    if (trueFileType === 'image') {
      const { processedImage, thumbnail } = await processImage(buffer, fileName);

      const [mainUpload, thumbUpload] = await Promise.all([
        uploadToS3(processedImage, `${keyBase}.jpg`, 'image/jpeg'),
        uploadToS3(thumbnail, `${keyBase}_thumb.jpg`, 'image/jpeg'),
      ]);

      result = {
        url: `${process.env.IMAGE_END_POINT}/${keyBase}.jpg`,
        thumbnailUrl: `${process.env.IMAGE_END_POINT}/${keyBase}_thumb.jpg`,
        mimeType: 'image/jpeg',
        size: buffer.length,
      };
    } else if (trueFileType === 'video') {
      const { processedVideo, thumbnail } = await processVideo(buffer, fileName);

      const [mainUpload, thumbUpload] = await Promise.all([
        uploadToS3(processedVideo, `${keyBase}.mp4`, 'video/mp4'),
        uploadToS3(thumbnail, `${keyBase}_thumb.jpg`, 'image/jpeg'),
      ]);

      result = {
        url: `${process.env.IMAGE_END_POINT}/${keyBase}.mp4`,
        thumbnailUrl: `${process.env.IMAGE_END_POINT}/${keyBase}_thumb.jpg`,
        mimeType: 'video/mp4',
        size: buffer.length,
      };
    } else {
      await uploadToS3(buffer, `${keyBase}${path.extname(fileName)}`, contentType);
      result = {
        url: `${process.env.IMAGE_END_POINT}/${keyBase}${path.extname(fileName)}`,
        thumbnailUrl: null,
        mimeType: contentType,
        size: buffer.length,
      };
    }

    this.emitUploadComplete({
      socketId,
      fileId: keyBase,
      fileName: sanitized.baseName,
      contentLength: result.size,
      key: `${keyBase}${path.extname(fileName)}`,
      thumbnailUrl: result.thumbnailUrl,
      fileType: trueFileType,
    });

    return {
      baseName: sanitized.baseName,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      size: result.size,
      mimeType: result.mimeType,
      fileType: trueFileType,
    };
  } catch (error) {
    this.emitUploadError(socketId, error.message);
    throw error;
  }
}

  /**
   * Setup upload progress tracking
   */
  setupProgressTracking({ uploader, contentLength, socketId, fileId }) {
    uploader.on("httpUploadProgress", (progress) => {
      const totalSize = progress.total || contentLength;
      const loaded = progress.loaded || 0;

      if (totalSize > 0) {
        const percent = Math.min(100, Math.floor((loaded / totalSize) * 100));

        emitUploadProgress(socketId, {
          fileId,
          progress: percent,
          receivedChunks: Math.ceil(loaded / (5 * 1024 * 1024)),
          totalChunks: Math.ceil(totalSize / (5 * 1024 * 1024)),
        });
      }
    });
  }

  /**
   * Emit upload complete event
   */
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

  /**
   * Emit upload error event
   */
  emitUploadError(socketId, message) {
    emitUploadError(socketId, message);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key) {
    try {
      await deleteFileFromS3(key);
      return { success: true };
    } catch (error) {
      console.error("File deletion error:", error);
      throw error;
    }
  }

  /**
   * Get download stream for a file
   */
  async getDownloadStream(key) {
    try {
      return await getDownloadStreamFromS3(key);
    } catch (error) {
      console.error("File download error:", error);
      throw error;
    }
  }

  /**
   * Sanitize filename and generate unique key
   */
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

  /**
   * Detect file type from extension
   */
  detectFileType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext))
      return "image";
    if (["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(ext))
      return "video";
    if (
      ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(ext)
    )
      return "document";
    return "other";
  }
}

module.exports = FileService;
