const { Upload } = require('@aws-sdk/lib-storage');
const { PassThrough } = require('stream');
const { s3Client } = require('../utilities/s3Utils');
const path = require('path');

class FileService {
  constructor() {
    this.uploadProgress = {};
  }

  async processStreamUpload({
    req,
    fileName,
    contentType,
    contentLength,
    socketId,
    fileType = 'auto'
  }) {
    const sanitized = this.sanitizeFilename(fileName);
    const key = sanitized.link;

    // Create a pass-through stream
    const passThrough = new PassThrough();
    
    // Start the upload immediately
    const uploader = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: key,
        Body: passThrough,
        ContentType: contentType,
        ACL: "public-read",
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024,
    });

    this.setupProgressTracking({
      uploader,
      contentLength,
      socketId,
      fileId: key,
    });

    // Pipe the request directly to S3
    req.pipe(passThrough);

    try {
      const result = await uploader.done();

      this.emitUploadComplete({
        socketId,
        fileId: key,
        fileName: sanitized.baseName,
        contentLength,
        key: result.Key,
        fileType: this.detectFileType(fileName)
      });

      return {
        baseName: sanitized.baseName,
        url: `${process.env.IMAGE_END_POINT}/${result.Key}`,
        size: contentLength,
        mimeType: contentType,
        fileType: this.detectFileType(fileName)
      };
    } catch (error) {
      console.error('Stream upload error:', error);
      this.emitUploadError(socketId, error.message);
      throw error;
    }
  }

  setupProgressTracking({ uploader, contentLength, socketId, fileId }) {
    uploader.on("httpUploadProgress", (progress) => {
      const totalSize = progress.total || contentLength;
      const loaded = progress.loaded || 0;

      if (totalSize > 0) {
        const percent = Math.min(100, Math.floor((loaded / totalSize) * 100));
        
        this.emitUploadProgress(socketId, {
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
    fileType
  }) {
    emitUploadComplete(socketId, {
      fileId,
      name: fileName,
      size: contentLength,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      thumbnailUrl: thumbnailUrl ? `${process.env.IMAGE_END_POINT}/${thumbnailUrl.split('/').pop()}` : null,
      hash: "stream-uploaded",
      fileType
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
    const baseName = path.basename(name, `.${extension}`)
      .replace(/[^a-z0-9-_]/gi, '_')
      .substring(0, 100);
    
    const link = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${baseName}.${extension}`;
    
    return {
      baseName,
      extension,
      link
    };
  }

  /**
   * Detect file type from extension
   */
  detectFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return 'document';
    return 'other';
  }
}

module.exports = FileService;