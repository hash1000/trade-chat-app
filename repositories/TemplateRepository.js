// repositories/TemplateRepository.js
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Template = require("../models/template");

const ATTRIBUTES = ["id", "userId", "title", "subTitle", "sequence", "createdAt", "updatedAt"];

class TemplateRepository {
  async findAllForUser(userId, { search } = {}) {
    const where = { userId };
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { subTitle: { [Op.like]: `%${search}%` } },
      ];
    }
    return Template.findAll({
      where,
      attributes: ATTRIBUTES,
      order: [
        ["sequence", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async findForUser(userId, id) {
    return Template.findOne({ where: { id, userId }, attributes: ATTRIBUTES });
  }

  async nextSequence(userId) {
    const max = await Template.max("sequence", { where: { userId } });
    return Number.isFinite(max) ? max + 1 : 0;
  }

  async create(data) {
    return Template.create(data);
  }

  async countOwned(userId, ids) {
    return Template.count({ where: { userId, id: { [Op.in]: ids } } });
  }

  // orderedIds[i] gets sequence i, in one transaction so a half-applied
  // reorder never shows up in the list.
  async reorder(userId, orderedIds) {
    await sequelize.transaction(async (t) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await Template.update(
          { sequence: i },
          { where: { id: orderedIds[i], userId }, transaction: t }
        );
      }
    });
  }
}

module.exports = TemplateRepository;
