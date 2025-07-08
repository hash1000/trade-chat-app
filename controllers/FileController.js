const path = require("path");
const fs = require("fs").promises;
const { MEMORY_LIMIT, DISK_LIMIT, STREAM_LIMIT } = require("../utilities/multer-config");
const FileService = require("../services/FileService");

const fileService = new FileService();

class FileController {
  async handleUpload(req, res) {
    try {
      const contentLength = parseInt(req.headers["content-length"]);
      const fileType = req.headers["x-file-type"] || "auto";

      if (!contentLength) {
        return res.status(411).json({ error: "Content-Length header required" });
      }

      if (contentLength <= MEMORY_LIMIT) {
        return this.uploadShort(req, res);
      } else if (contentLength <= DISK_LIMIT) {
        return this.uploadMedium(req, res);
      } else {
        return this.uploadStream(req, res);
      }
    } catch (error) {
      console.error("Upload routing error:", error);
      res.status(500).json({
        error: "Upload failed",
        details: error.message,
      });
    }
  }

  async uploadShort(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { buffer, originalname, mimetype, size } = req.file;
      
      const result = await fileService.processMemoryUpload({
        buffer,
        originalname,
        mimetype,
        size
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

  async uploadMedium(req, res) {
    let filePath;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      filePath = req.file.path;
      const { originalname, mimetype, size } = req.file;

      const result = await fileService.processDiskUpload({
        filePath,
        originalname,
        mimetype,
        size
      });

      res.status(200).json({
        message: "File uploaded successfully",
        data: result,
      });
    } catch (error) {
      console.error("Medium upload error:", error);
      res.status(500).json({
        error: "File upload failed",
        details: error.message,
      });
    } finally {
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.warn("Failed to clean up temp file:", cleanupError);
        }
      }
    }
  }

  async uploadStream(req, res) {
    const socketId = req.headers["x-socket-id"];
    const fileName = req.headers["x-file-name"] || `file_${Date.now()}`;
    const contentLength = parseInt(req.headers["content-length"] || "0");
    const contentType = req.headers["content-type"] || "application/octet-stream";

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
        socketId
      });
      console.log("Stream upload successful:", result);

      res.status(200).json({
        message: "Stream upload successful",
        data: result,
      });
    } catch (error) {
      console.error("Stream upload error:", error);
      res.status(500).json({
        error: "Upload failed",
        details: error.message,
      });
    }
  }


  async uploadStream(req, res, fileType) {
    const socketId = req.headers["x-socket-id"];
    const fileName = req.headers["x-file-name"] || `file_${Date.now()}`;
    const contentLength = parseInt(req.headers["content-length"] || "0");
    const contentType = req.headers["content-type"] || "application/octet-stream";

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
        fileType: 'video',
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
      const filename = key.split("_").slice(2).join("_");
      const fileType = fileService.detectFileType(filename);

      res.status(200).json({
        name: filename,
        url: `${process.env.IMAGE_END_POINT}/${key}`,
        type: fileType,
        size: null,
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