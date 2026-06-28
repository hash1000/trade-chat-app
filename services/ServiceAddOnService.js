const path = require("path");
const fs = require("fs").promises;
const { Service, ServiceAddOn, ServiceAddOnFile } = require("../models");
const { uploadDiskFileToS3, deleteFileFromS3 } = require("../utilities/s3Utils");

const EXT_TO_FILE_TYPE = {
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
  ".gif": "image", ".bmp": "image", ".tiff": "image",
  ".mp4": "video", ".mpeg": "video", ".mov": "video",
  ".avi": "video", ".mkv": "video", ".webm": "video",
  ".pdf": "pdf", ".doc": "doc", ".docx": "docx",
  ".ppt": "ppt", ".pptx": "pptx", ".xls": "xls", ".xlsx": "xlsx", ".txt": "txt",
};

const S3_FILE_TYPE = { image: "image", video: "video" };

class ServiceAddOnService {
  async assertServiceExists(serviceId) {
    console.log("ServiceAddOnService.assertServiceExists serviceId:", serviceId);
    const service = await Service.findByPk(serviceId);
    if (!service) {
      const err = new Error("Service not found.");
      err.statusCode = 404;
      throw err;
    }
    return service;
  }

  assertOwner(service, userId) {
    if (service.userId !== userId) {
      const err = new Error("Forbidden. Only the service owner can perform this action.");
      err.statusCode = 403;
      throw err;
    }
  }

  async getAddOnOrFail(serviceId, addOnId) {
    const addOn = await ServiceAddOn.findOne({
      where: { id: addOnId, serviceId, deletedAt: null },
      include: [{ model: ServiceAddOnFile, as: "files" }],
      order: [[{ model: ServiceAddOnFile, as: "files" }, "sort_order", "ASC"]],
    });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }
    return addOn;
  }

  /**
   * Upload files to S3 and bulk-insert records for an add-on.
   * @param {number} addOnId
   * @param {Express.Multer.File[]} files
   */
  async uploadFiles(addOnId, files) {
    if (!files || !files.length) return [];
    const records = await Promise.all(
      files.map(async (file, idx) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const file_type = EXT_TO_FILE_TYPE[ext] || "other";
        const s3FileType = S3_FILE_TYPE[file_type] ?? null;

        let file_url, s3_key;
        try {
          const result = await uploadDiskFileToS3(file.path, file.originalname, file.mimetype, s3FileType);
          file_url = result.url;
          s3_key = result.key;
        } finally {
          await fs.unlink(file.path).catch(() => {});
        }

        return { addOnId, file_url, s3_key, file_name: file.originalname, file_type, sort_order: idx };
      })
    );

    return ServiceAddOnFile.bulkCreate(records);
  }

  async listAddOns(serviceId, { page = 1, limit = 20 } = {}) {
    await this.assertServiceExists(serviceId);

    const offset = (page - 1) * limit;

    const { count, rows } = await ServiceAddOn.findAndCountAll({
      where: { serviceId, deletedAt: null },
      include: [{ model: ServiceAddOnFile, as: "files", required: false }],
      order: [
        ["createdAt", "DESC"],
        [{ model: ServiceAddOnFile, as: "files" }, "sort_order", "ASC"],
      ],
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    };
  }

  async getAddOn(serviceId, addOnId) {
    await this.assertServiceExists(serviceId);
    return this.getAddOnOrFail(serviceId, addOnId);
  }

  async createAddOn(serviceId, actorId, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const { title, description, amount } = data;

    if (!title || !String(title).trim()) {
      const err = new Error("title is required.");
      err.statusCode = 400;
      throw err;
    }

    if (amount == null || isNaN(Number(amount)) || Number(amount) < 0) {
      const err = new Error("amount must be a non-negative number.");
      err.statusCode = 400;
      throw err;
    }
    console.log("service",service);
    const addOn = await ServiceAddOn.create({
      serviceId,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      amount: Number(amount),
    });

    return this.getAddOnOrFail(serviceId, addOn.id);
  }

  async updateAddOn(serviceId, addOnId, actorId, data) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const addOn = await ServiceAddOn.findOne({ where: { id: addOnId, serviceId, deletedAt: null } });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }

    const updates = {};

    if (data.title !== undefined) {
      if (!String(data.title).trim()) {
        const err = new Error("title cannot be empty.");
        err.statusCode = 400;
        throw err;
      }
      updates.title = String(data.title).trim();
    }

    if (data.description !== undefined) {
      updates.description = data.description ? String(data.description).trim() : null;
    }

    if (data.amount !== undefined) {
      if (isNaN(Number(data.amount)) || Number(data.amount) < 0) {
        const err = new Error("amount must be a non-negative number.");
        err.statusCode = 400;
        throw err;
      }
      updates.amount = Number(data.amount);
    }

    if (Object.keys(updates).length) {
      await addOn.update(updates);
    }

    return this.getAddOnOrFail(serviceId, addOnId);
  }

  /**
   * Soft-delete an add-on.
   */
  async deleteAddOn(serviceId, addOnId, actorId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const addOn = await ServiceAddOn.findOne({ where: { id: addOnId, serviceId, deletedAt: null } });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }

    await addOn.update({ deletedAt: new Date(), deletedBy: actorId });
    return { id: addOn.id, deletedAt: addOn.deletedAt };
  }

  async uploadMedia(serviceId, addOnId, actorId, files) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);
    const addOn = await ServiceAddOn.findOne({ where: { id: addOnId, serviceId, deletedAt: null } });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }
console.log("ServiceAddOnService.uploadMedia files:", files);
    return this.uploadFiles(addOn.id, files);
  }

  async deleteFile(serviceId, addOnId, fileId, actorId) {
    const service = await this.assertServiceExists(serviceId);
    this.assertOwner(service, actorId);

    const addOn = await ServiceAddOn.findOne({ where: { id: addOnId, serviceId, deletedAt: null } });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }

    const file = await ServiceAddOnFile.findOne({ where: { id: fileId, addOnId: addOn.id } });
    if (!file) {
      const err = new Error("File not found.");
      err.statusCode = 404;
      throw err;
    }

    if (file.s3_key) {
      await deleteFileFromS3(file.s3_key);
    }

    await file.destroy();
  }
}

module.exports = ServiceAddOnService;
