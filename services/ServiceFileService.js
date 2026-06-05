const path = require("path");
const fs = require("fs");
const { Service, ServiceFile } = require("../models");

// Maps file extension → file_type ENUM value
const FILE_TYPE_MAP = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".bmp": "image",
  ".tiff": "image",
  ".mp4": "video",
  ".mpeg": "video",
  ".mov": "video",
  ".avi": "video",
  ".mkv": "video",
  ".webm": "video",
  ".pdf": "pdf",
  ".doc": "doc",
  ".docx": "docx",
};

// file_types that belong in the "media" bucket (everything that is not a pure image)
const MEDIA_TYPES = new Set(["video", "pdf", "doc", "docx", "other"]);

class ServiceFileService {
  async assertServiceExists(serviceId) {
    const service = await Service.findByPk(serviceId);
    if (!service) {
      const err = new Error("Service not found.");
      err.statusCode = 404;
      throw err;
    }
    return service;
  }

  async uploadImages(serviceId, files) {
    await this.assertServiceExists(serviceId);

    const records = files.map((file, index) => ({
      service_id: serviceId,
      file_url: `/uploads/services/images/${file.filename}`,
      file_name: file.originalname,
      file_type: "image",
      sort_order: index,
    }));

    return ServiceFile.bulkCreate(records);
  }

  async uploadMedia(serviceId, files) {
    await this.assertServiceExists(serviceId);

    const records = files.map((file, index) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const file_type = FILE_TYPE_MAP[ext] || "other";

      return {
        service_id: serviceId,
        file_url: `/uploads/services/media/${file.filename}`,
        file_name: file.originalname,
        file_type,
        sort_order: index,
      };
    });

    return ServiceFile.bulkCreate(records);
  }

  async getServiceWithFiles(serviceId) {
    const service = await Service.findByPk(serviceId);
    if (!service) {
      const err = new Error("Service not found.");
      err.statusCode = 404;
      throw err;
    }

    const allFiles = await ServiceFile.findAll({
      where: { service_id: serviceId },
      order: [["sort_order", "ASC"]],
    });

    const images = allFiles.filter((f) => f.file_type === "image");
    const media = allFiles.filter((f) => MEDIA_TYPES.has(f.file_type));

    return { ...service.toJSON(), images, media };
  }

  async deleteFile(fileId) {
    const file = await ServiceFile.findByPk(fileId);
    if (!file) {
      const err = new Error("File not found.");
      err.statusCode = 404;
      throw err;
    }

    const absolutePath = path.join(__dirname, "..", file.file_url);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    await file.destroy();
  }
}

module.exports = ServiceFileService;
