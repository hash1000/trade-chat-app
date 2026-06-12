// controllers/ServiceController.js
const ServiceService = require("../services/ServiceService");
const ServiceFileService = require("../services/ServiceFileService");
const serviceService = new ServiceService();
const serviceFileService = new ServiceFileService();

function parseTags(raw) {
  let arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(arr) || arr.some((t) => typeof t !== "string")) {
    const err = new Error("tags must be an array of strings.");
    err.name = "ValidationError";
    throw err;
  }
  arr = [...new Set(arr.map((t) => t.trim().toLowerCase()))];
  if (arr.length > 10) {
    const err = new Error("tags may not exceed 10 items.");
    err.name = "ValidationError";
    throw err;
  }
  if (arr.some((t) => t.length > 30)) {
    const err = new Error("Each tag may not exceed 30 characters.");
    err.name = "ValidationError";
    throw err;
  }
  return arr;
}

class ServiceController {
  async list(req, res) {
    try {
      const { id: userId } = req.user;

      const includeTeams = req.query.includeTeams === "true";
      const includeMembers = req.query.includeMembers === "true";
      const includeCategories = req.query.includeCategories === "true";
      const includeDeleted = req.query.includeDeleted === "true";
      const isLiked = req.query.isLiked === "true";
      const services = await serviceService.getAll({
        userId,
        includeTeams,
        includeMembers,
        includeCategories,
        includeDeleted,
        isLiked,
      });

      return res.status(200).json({
        success: true,
        data: services,
      });
    } catch (error) {
      console.error("ServiceController.list error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user;
      const includeTeams = req.query.includeTeams !== "false";
      const includeMembers = req.query.includeMembers === "true";
      const includeCategories = req.query.includeCategories !== "false";
      const isLiked = req.query.isLiked === "true";
      const service = await serviceService.getById(id, {
        userId,
        includeTeams,
        includeMembers,
        includeCategories,
        isLiked,
      });
      if (!service) {
        return res
          .status(404)
          .json({ success: false, error: "Service not found." });
      }
      // fire-and-forget — never throws, never delays response
      serviceService.recordView(userId, id).catch(() => {});
      return res.status(200).json({ success: true, data: service });
    } catch (error) {
      console.error("ServiceController.getById error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async create(req, res) {
    try {
      const { id: userId } = req.user;

      const {
        name,
        profile_image,
        type,
        description,
        location,
        payoutWalletId,
        pricing_type,
        price,
        min_price,
        max_price,
        teamIds,
        categoryId,
        categoryIds,
        images,
        insured,
        moneyBack,
        support247,
        replyTime,
        tags,
      } = req.body;

      // ─── Validation ─────────────────────────────

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: "name is required.",
        });
      }

      if (
        !profile_image ||
        typeof profile_image !== "string" ||
        !profile_image.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: "profile_image is required.",
        });
      }

      if (!pricing_type) {
        return res.status(400).json({
          success: false,
          error: "pricing_type is required.",
        });
      }

      const allowedPricingTypes = ["free", "fixed", "range"];

      if (!allowedPricingTypes.includes(pricing_type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid pricing_type.",
        });
      }

      if (pricing_type === "fixed") {
        if (!price || Number(price) <= 0) {
          return res.status(400).json({
            success: false,
            error: "price is required for fixed pricing.",
          });
        }
      }

      if (pricing_type === "range") {
        if (
          min_price == null ||
          max_price == null ||
          Number(min_price) < 0 ||
          Number(max_price) <= 0
        ) {
          return res.status(400).json({
            success: false,
            error: "min_price and max_price are required.",
          });
        }

        if (Number(min_price) > Number(max_price)) {
          return res.status(400).json({
            success: false,
            error: "min_price cannot be greater than max_price.",
          });
        }
      }

      // ─── Create service ─────────────────────────

      // ─── Validate images ────────────────────────
      let parsedImages = [];
      if (images !== undefined && images !== null) {
        parsedImages = typeof images === "string" ? JSON.parse(images) : images;
        if (
          !Array.isArray(parsedImages) ||
          parsedImages.some((v) => typeof v !== "string")
        ) {
          return res.status(400).json({
            success: false,
            error: "images must be an array of URL strings.",
          });
        }
      }

      // ─── Validate + parse tags ───────────────────
      let parsedTags = [];
      if (tags !== undefined && tags !== null) {
        try {
          parsedTags = parseTags(tags);
        } catch (e) {
          return res.status(400).json({ success: false, error: e.message });
        }
      }

      const service = await serviceService.create({
        userId,

        name: name.trim(),
        profile_image: profile_image.trim(),
        type: type ? type.trim() : undefined,
        location: location.trim(),
        description: description ? description.trim() : undefined,

        pricing_type,

        price: pricing_type === "fixed" ? price : 0,

        min_price: pricing_type === "range" ? min_price : null,

        max_price: pricing_type === "range" ? max_price : null,
        payoutWalletId: payoutWalletId ? Number(payoutWalletId) : null,

        images: parsedImages,

        insured: insured === true || insured === "true",
        moneyBack: moneyBack === true || moneyBack === "true",
        support247: support247 === true || support247 === "true",
        tags: parsedTags,
        replyTime: replyTime ? replyTime.trim() : undefined,
      });

      // ─── Teams ──────────────────────────────────

      if (Array.isArray(teamIds) && teamIds.length > 0) {
        await serviceService.addTeams(service.id, teamIds);
      }

      // ─── Categories ─────────────────────────────

      const categoriesToAssign = Array.isArray(categoryIds)
        ? categoryIds
        : categoryId != null
          ? [categoryId]
          : [];

      if (categoriesToAssign.length > 0) {
        await serviceService.addCategories(service.id, categoriesToAssign);
      }

      // ─── Media uploads (optional) ───────────────
      const mediaFiles = req.files?.media ?? req.files;
      if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
        await serviceFileService.uploadMedia(service.id, mediaFiles);
      }

      const data = await serviceService.getById(service.id, {
        includeTeams: true,
        includeMembers: true,
        includeCategories: true,
      });

      return res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("ServiceController.create error:", error);

      if (
        error.name === "InvalidTeamIdError" ||
        error.name === "InvalidCategoryIdError"
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;

      const service = await serviceService.getById(id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found.",
        });
      }

      const {
        name,
        profile_image,
        type,
        description,
        location,
        pricing_type,
        price,
        min_price,
        max_price,
        payoutWalletId,
        teamIds,
        categoryId,
        categoryIds,
        images,
        insured,
        moneyBack,
        support247,
        tags,
        replyTime,
      } = req.body;

      // =========================================
      // Determine final pricing type
      // =========================================

      const finalPricingType = pricing_type || service.pricing_type;

      // =========================================
      // Validation
      // =========================================

      const allowedPricingTypes = ["free", "fixed", "range"];

      if (pricing_type && !allowedPricingTypes.includes(pricing_type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid pricing_type.",
        });
      }

      // Fixed Pricing Validation
      if (finalPricingType === "fixed") {
        const finalPrice = price !== undefined ? price : service.price;

        if (!finalPrice || Number(finalPrice) <= 0) {
          return res.status(400).json({
            success: false,
            error: "price is required for fixed pricing.",
          });
        }
      }

      // Range Pricing Validation
      if (finalPricingType === "range") {
        const finalMinPrice =
          min_price !== undefined ? min_price : service.min_price;

        const finalMaxPrice =
          max_price !== undefined ? max_price : service.max_price;

        if (finalMinPrice == null || finalMaxPrice == null) {
          return res.status(400).json({
            success: false,
            error: "min_price and max_price are required.",
          });
        }

        if (Number(finalMinPrice) > Number(finalMaxPrice)) {
          return res.status(400).json({
            success: false,
            error: "min_price cannot be greater than max_price.",
          });
        }
      }

      // =========================================
      // Build Update Payload
      // =========================================

      const updateData = {};

      if (name !== undefined) {
        updateData.name = typeof name === "string" ? name.trim() : name;
      }

      if (profile_image !== undefined) {
        updateData.profile_image =
          typeof profile_image === "string"
            ? profile_image.trim()
            : profile_image;
      }

      if (type !== undefined) {
        updateData.type = typeof type === "string" ? type.trim() : type;
      }

      if (description !== undefined) {
        updateData.description =
          typeof description === "string" ? description.trim() : description;
      }

      if (location !== undefined) {
        updateData.location =
          typeof location === "string" ? location.trim() : location;
      }

      if (replyTime !== undefined) {
        updateData.replyTime = typeof replyTime === "string" ? replyTime.trim() : replyTime;
      }

      if (pricing_type !== undefined) {
        updateData.pricing_type = pricing_type;
      }

      if (payoutWalletId !== undefined) {
        updateData.payoutWalletId = payoutWalletId
          ? Number(payoutWalletId)
          : null;
      }

      if (images !== undefined) {
        const parsedImages =
          typeof images === "string" ? JSON.parse(images) : images;
        if (
          !Array.isArray(parsedImages) ||
          parsedImages.some((v) => typeof v !== "string")
        ) {
          return res.status(400).json({
            success: false,
            error: "images must be an array of URL strings.",
          });
        }
        updateData.images = parsedImages;
      }

      if (insured !== undefined) {
        updateData.insured = insured === true || insured === "true";
      }

      if (moneyBack !== undefined) {
        updateData.moneyBack = moneyBack === true || moneyBack === "true";
      }

      if (support247 !== undefined) {
        updateData.support247 = support247 === true || support247 === "true";
      }

      if (tags !== undefined) {
        try {
          updateData.tags = parseTags(tags);
        } catch (e) {
          return res.status(400).json({ success: false, error: e.message });
        }
      }

      // =========================================
      // Normalize pricing fields
      // =========================================

      if (finalPricingType === "free") {
        updateData.price = 0;
        updateData.min_price = null;
        updateData.max_price = null;
      }

      if (finalPricingType === "fixed") {
        updateData.price = price !== undefined ? price : service.price;

        updateData.min_price = null;
        updateData.max_price = null;
      }

      if (finalPricingType === "range") {
        updateData.price = 0;

        updateData.min_price =
          min_price !== undefined ? min_price : service.min_price;

        updateData.max_price =
          max_price !== undefined ? max_price : service.max_price;
      }

      // =========================================
      // Update Service
      // =========================================

      await serviceService.update(id, updateData);

      // =========================================
      // Teams
      // =========================================

      if (teamIds !== undefined) {
        await serviceService.setTeams(
          id,
          Array.isArray(teamIds) ? teamIds : [],
        );
      }

      // =========================================
      // Categories
      // =========================================

      if (categoryIds !== undefined || categoryId !== undefined) {
        const categoriesToAssign = Array.isArray(categoryIds)
          ? categoryIds
          : categoryId != null
            ? [categoryId]
            : [];

        await serviceService.setCategories(id, categoriesToAssign);
      }

      // =========================================
      // Media uploads (optional — appends new files)
      // =========================================

      const mediaFiles = req.files?.media ?? req.files;
      if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
        await serviceFileService.uploadMedia(Number(id), mediaFiles);
      }

      const data = await serviceService.getById(id, {
        includeTeams: true,
        includeMembers: true,
        includeCategories: true,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("ServiceController.update error:", error);

      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  // controllers/ServiceController.js

  async delete(req, res) {
    try {
      const { id } = req.params;
      const { id: userId } = req.user; // 👈 important

      const service = await serviceService.getById(id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found.",
        });
      }

      await serviceService.delete(id, userId);

      return res.status(200).json({
        success: true,
        message: "Service deleted successfully (soft delete).",
      });
    } catch (error) {
      console.error("ServiceController.delete error:", error);

      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async restore(req, res) {
    try {
      const { id } = req.params;

      const service = await serviceService.getByIdWithDeleted(id);

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found.",
        });
      }

      if (!service.deletedAt) {
        return res.status(400).json({
          success: false,
          error: "Service is not deleted.",
        });
      }

      const restored = await serviceService.restore(id);

      return res.status(200).json({
        success: true,
        message: "Service restored successfully.",
        data: restored,
      });
    } catch (error) {
      console.error("ServiceController.restore error:", error);

      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async addTeam(req, res) {
    try {
      const { id: serviceId } = req.params;
      const { teamId: singleTeamId, teamIds } = req.body;
      const service = await serviceService.getById(serviceId);
      if (!service) {
        return res
          .status(404)
          .json({ success: false, error: "Service not found." });
      }
      if (Array.isArray(teamIds) && teamIds.length > 0) {
        await serviceService.addTeams(Number(serviceId), teamIds);
      } else if (singleTeamId != null) {
        await serviceService.addTeam(Number(serviceId), Number(singleTeamId));
      } else {
        return res.status(400).json({
          success: false,
          error: "teamId or teamIds (array) is required.",
        });
      }

      const updated = await serviceService.getById(serviceId, {
        includeTeams: true,
        includeMembers: true,
      });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.addTeam error:", error);
      if (error.name === "InvalidTeamIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async removeTeam(req, res) {
    try {
      const { id: serviceId, teamId } = req.params;
      const removed = await serviceService.removeTeam(
        Number(serviceId),
        Number(teamId),
      );
      if (!removed) {
        return res
          .status(404)
          .json({ success: false, error: "Team not found in service." });
      }
      const updated = await serviceService.getById(serviceId, {
        includeTeams: true,
        includeMembers: true,
      });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.removeTeam error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async addCategory(req, res) {
    try {
      const { id: serviceId } = req.params;
      const { categoryId: singleCategoryId, categoryIds } = req.body;
      const service = await serviceService.getById(serviceId);
      if (!service) {
        return res
          .status(404)
          .json({ success: false, error: "Service not found." });
      }
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        await serviceService.addCategories(Number(serviceId), categoryIds);
      } else if (singleCategoryId != null) {
        await serviceService.addCategory(
          Number(serviceId),
          Number(singleCategoryId),
        );
      } else {
        return res.status(400).json({
          success: false,
          error: "categoryId or categoryIds (array) is required.",
        });
      }

      const updated = await serviceService.getById(serviceId, {
        includeTeams: true,
        includeMembers: true,
        includeCategories: true,
      });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.addCategory error:", error);
      if (error.name === "InvalidCategoryIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async removeCategory(req, res) {
    try {
      const { id: serviceId, categoryId } = req.params;
      const removed = await serviceService.removeCategory(
        Number(serviceId),
        Number(categoryId),
      );
      if (!removed) {
        return res
          .status(404)
          .json({ success: false, error: "Category not found in service." });
      }
      const updated = await serviceService.getById(serviceId, {
        includeTeams: true,
        includeMembers: true,
        includeCategories: true,
      });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.removeCategory error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async likeService(req, res) {
    try {
      const { id: userId } = req.user;
      const serviceId = Number(req.params.id);

      const { created } = await serviceService.likeService(userId, serviceId);
      if (!created) {
        return res
          .status(409)
          .json({
            success: false,
            error: "You have already liked this service.",
          });
      }

      const likesCount = await serviceService.getLikesCount(serviceId);
      return res
        .status(200)
        .json({ success: true, data: { liked: true, likesCount } });
    } catch (error) {
      console.error("ServiceController.likeService error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Server error. Please try again later.",
        });
    }
  }

  async unlikeService(req, res) {
    try {
      const { id: userId } = req.user;
      const serviceId = Number(req.params.id);

      const removed = await serviceService.unlikeService(userId, serviceId);
      if (!removed) {
        return res
          .status(404)
          .json({ success: false, error: "You have not liked this service." });
      }

      const likesCount = await serviceService.getLikesCount(serviceId);
      return res
        .status(200)
        .json({ success: true, data: { liked: false, likesCount } });
    } catch (error) {
      console.error("ServiceController.unlikeService error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Server error. Please try again later.",
        });
    }
  }

  async getServiceLikesCount(req, res) {
    try {
      const serviceId = Number(req.params.id);
      const likesCount = await serviceService.getLikesCount(serviceId);
      return res.status(200).json({ success: true, data: { likesCount } });
    } catch (error) {
      console.error("ServiceController.getServiceLikesCount error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Server error. Please try again later.",
        });
    }
  }

  async checkUserLikedService(req, res) {
    try {
      const { id: userId } = req.user;
      const serviceId = Number(req.params.id);
      const liked = await serviceService.hasUserLiked(userId, serviceId);
      return res.status(200).json({ success: true, data: { liked } });
    } catch (error) {
      console.error("ServiceController.checkUserLikedService error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Server error. Please try again later.",
        });
    }
  }

  async recordView(req, res) {
    try {
      const { id: userId } = req.user;
      const serviceId = Number(req.params.id);
      await serviceService.recordView(userId, serviceId);
      const viewCount = await serviceService.getViewsCount(serviceId);
      return res.status(200).json({ success: true, data: { viewCount } });
    } catch (error) {
      console.error("ServiceController.recordView error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async rateService(req, res) {
    try {
      const { id: userId } = req.user;
      const serviceId = Number(req.params.id);
      const { rating, comment } = req.body;

      if (!rating || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
        return res.status(400).json({ success: false, error: "rating must be an integer between 1 and 5." });
      }

      await serviceService.rateService(userId, serviceId, Number(rating), comment ?? null);

      const service = await serviceService.getById(serviceId, { userId });
      return res.status(200).json({ success: true, data: { ratingAvg: service.ratingAvg, ratingCount: service.ratingCount, myRating: service.myRating } });
    } catch (error) {
      console.error("ServiceController.rateService error:", error);
      if (error.name === "NotPurchasedError") {
        return res.status(403).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async deleteRating(req, res) {
    try {
      const { id: userId } = req.user;
      const serviceId = Number(req.params.id);

      const removed = await serviceService.deleteRating(userId, serviceId);
      if (!removed) {
        return res.status(404).json({ success: false, error: "You have not rated this service." });
      }

      const service = await serviceService.getById(serviceId, { userId });
      return res.status(200).json({ success: true, data: { ratingAvg: service.ratingAvg, ratingCount: service.ratingCount, myRating: null } });
    } catch (error) {
      console.error("ServiceController.deleteRating error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async updateBadges(req, res) {
    try {
      const { id } = req.params;
      const { isTopChoice, isQRMVerified } = req.body;

      const service = await serviceService.getById(id);
      if (!service) {
        return res.status(404).json({ success: false, error: "Service not found." });
      }

      const badgeData = {};
      if (isTopChoice !== undefined) badgeData.isTopChoice = isTopChoice === true || isTopChoice === "true";
      if (isQRMVerified !== undefined) badgeData.isQRMVerified = isQRMVerified === true || isQRMVerified === "true";

      if (Object.keys(badgeData).length === 0) {
        return res.status(400).json({ success: false, error: "Provide at least one of: isTopChoice, isQRMVerified." });
      }

      await serviceService.updateBadges(id, badgeData);

      const updated = await serviceService.getById(id);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.updateBadges error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = ServiceController;
