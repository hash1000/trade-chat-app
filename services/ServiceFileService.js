const path = require("path");
const fs = require("fs");
const { Service, ServiceFile } = require("../models");

const FILE_TYPE_MAP = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".pdf": "pdf",
  ".doc": "doc",
  ".docx": "docx",
};

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

  async uploadDocuments(serviceId, files) {
    await this.assertServiceExists(serviceId);

    const records = files.map((file, index) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const file_type = FILE_TYPE_MAP[ext] || "other";

      return {
        service_id: serviceId,
        file_url: `/uploads/services/documents/${file.filename}`,
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
    const documents = allFiles.filter((f) => f.file_type !== "image");

    return { ...service.toJSON(), images, documents };
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
