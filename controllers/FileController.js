const path = require("path");
const fs = require("fs").promises;
const FileService = require("../services/FileService");
const { MEMORY_LIMIT, DISK_LIMIT } = require("../utilities/multer-config");

const fileService = new FileService();

class FileController {
  async handleUpload(req, res) {
    try {
      const contentLength = parseInt(req.headers["content-length"]);
      const fileType = req.headers["x-file-type"] || "auto";

      if (!contentLength) {
        return res
          .status(411)
          .json({ error: "Content-Length header required" });
      }

      if (contentLength <= MEMORY_LIMIT) {
        return this.uploadShort(req, res, fileType);
      } else if (contentLength <= DISK_LIMIT) {
        return this.uploadMedium(req, res, fileType);
      } else {
        return this.uploadStream(req, res, fileType);
      }
    } catch (error) {
      console.error("Upload routing error:", error);
      res.status(500).json({
        error: "Upload failed",
        details: error.message,
      });
    }
  }

  // Small files (≤25MB): memory storage
  async uploadShort(req, res, fileType) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { buffer, originalname, mimetype, size } = req.file;

      const result = await fileService.processUpload({
        fileData: buffer,
        originalname,
        mimetype,
        size,
        type: "memory",
        fileType,
      });

      res.status(200).json({
        message: "File uploaded successfully",
        data: result,
      });
    } catch (error) {
      console.error("Short upload error:", error);
      res.status(500).json({
        error: "File upload failed",
        details: error.message,
      });
    }
  }

  // Medium files (≤50MB): disk storage
  async uploadMedium(req, res, fileType) {
    let filePath;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      filePath = req.file.path;
      const { originalname, mimetype, size } = req.file;

      const result = await fileService.processUpload({
        fileData: filePath,
        originalname,
        mimetype,
        size,
        type: "disk",
        fileType,
      });

      // Clean up temp file after upload
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn("Failed to clean up temp file:", cleanupError);
      }

      res.status(200).json({
        message: "File uploaded successfully (disk)",
        data: result,
      });
    } catch (error) {
      // Clean up temp file on error
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.warn("Failed to clean up temp file on error:", cleanupError);
        }
      }

      console.error("Disk upload error:", error);
      res.status(500).json({
        error: "File upload failed",
        details: error.message,
      });
    }
  }

  async uploadStream(req, res, fileType) {
    const socketId = req.headers["x-socket-id"];
    const fileName = req.headers["x-file-name"] || `file_${Date.now()}`;
    const contentLength = parseInt(req.headers["content-length"] || "0");
    const contentType =
      req.headers["content-type"] || "application/octet-stream";

    if (!contentLength || !fileName || !socketId) {
      return res.status(400).json({
        error: "Missing headers: file-name, content-length, socket-id required",
      });
    }

    try {
      const result = await fileService.processStreamUpload({
        req,
        fileName,
        contentType,
        contentLength,
        socketId,
        fileType,
      });

      res.status(200).json({
        message: "Stream upload successful",
        data: result,
      });
    } catch (error) {
      console.error("Stream upload error:", error);
      if (socketId) {
        fileService.emitUploadError(socketId, error.message);
      }
      res.status(500).json({
        error: "Upload failed",
        details: error.message,
      });
    }
  }

  async deleteFile(req, res) {
    try {
      const { key } = req.params;
      const result = await fileService.deleteFile(key);
      res.status(200).json({
        message: "File deleted successfully",
        data: result,
      });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({
        error: "File deletion failed",
        details: error.message,
      });
    }
  }

  async downloadFile(req, res) {
    try {
      const { key } = req.params;
      const downloadStream = await fileService.getDownloadStream(key);

      downloadStream.on("error", (error) => {
        console.error("Download stream error:", error);
        res.status(500).json({
          error: "File download failed",
          details: error.message,
        });
      });

      // Set appropriate headers
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${key.split("_").slice(2).join("_")}"`
      );

      downloadStream.pipe(res);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({
        error: "File download failed",
        details: error.message,
      });
    }
  }

  async getFileInfo(req, res) {
    try {
      const { key } = req.params;
      // In a real implementation, you might get metadata from S3
      const filename = key.split("_").slice(2).join("_");
      const fileType = fileService.detectFileType(filename);

      res.status(200).json({
        name: filename,
        url: `${process.env.IMAGE_END_POINT}/${key}`,
        type: fileType,
        size: null, // You would get this from S3 metadata in a real implementation
        uploadedAt: new Date(parseInt(key.split("_")[0])).toISOString(),
      });
    } catch (error) {
      console.error("File info error:", error);
      res.status(500).json({
        error: "Failed to get file info",
        details: error.message,
      });
    }
  }
}

module.exports = FileController;
