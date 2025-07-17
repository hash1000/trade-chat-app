// ✅ FILE: services/fileService.js
const path = require("path");
const tmp = require("tmp-promise");
const fs = require("fs").promises;
const fps = require("fs");
const {
  uploadMemoryFileToS3,
  uploadDiskFileToS3,
  handleVideoStreamUpload,
  deleteFileFromS3,
  getDownloadStreamFromS3,
} = require("../utilities/s3Utils");
const {
  uploadToCloudinaryWithThumbnail,
  MIN_VIDEO_SIZE,
  MAX_VIDEO_SIZE,
} = require("../utilities/cloudinaryUtils");
const {
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError,
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

  async processStreamUpload({
    req,
    fileName,
    contentType,
    contentLength,
    socketId,
    fileType,
  }) {
    const sanitized = this.sanitizeFilename(fileName);
    const { path: tempFilePath, cleanup } = await tmp.file({
      postfix: path.extname(fileName),
    });

    // Set global timeout (30 minutes)
    const globalTimeout = setTimeout(() => {
      throw new Error("Processing timed out after 30 minutes");
    }, 30 * 60 * 1000);

    try {
      // Write stream directly to temp file
      const writeStream = fps.createWriteStream(tempFilePath);
      let bytesReceived = 0;

      req.on("data", (chunk) => {
        bytesReceived += chunk.length;
        writeStream.write(chunk);

        if (socketId && contentLength) {
          emitUploadProgress(socketId, {
            fileId: sanitized.link,
            progress: Math.floor((bytesReceived / contentLength) * 100),
          });
        }
      });

      await new Promise((resolve, reject) => {
        req.on("end", () => {
          writeStream.end(resolve);
        });
        req.on("error", reject);
      });

      // Process the file on disk
      const result = await handleVideoStreamUpload(
        tempFilePath,
        socketId,
        fileName,
        contentLength
      );

      clearTimeout(globalTimeout);
      return {
        name: sanitized.baseName,
        url: result.url,
        key: result.key,
        thumbnailUrl: result.thumbnailUrl,
        size: result.size, // Now using compressed size from handleVideoStreamUpload
        mimeType: contentType,
        fileType,
      };
    } catch (err) {
      clearTimeout(globalTimeout);
      throw err;
    } finally {
      await cleanup().catch(console.error);
    }
  }

  validateVideoSize(fileSize) {
    if (fileSize < MIN_VIDEO_SIZE) {
      throw new Error(
        `Video must be at least ${MIN_VIDEO_SIZE / 1024 / 1024}MB`
      );
    }
    if (fileSize > MAX_VIDEO_SIZE) {
      throw new Error(
        `Video cannot exceed ${MAX_VIDEO_SIZE / 1024 / 1024 / 1024}GB`
      );
    }
    return true;
  }

  async processCloudinaryUpload({ file, type }) {
    try {
      if (type === "video") {
        const fileSize = file.size || (await fs.stat(file.path)).size;
        this.validateVideoSize(fileSize);
      }
      return await uploadToCloudinaryWithThumbnail(file, type);
    } catch (error) {
      console.error("Cloudinary upload error:", error);
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
