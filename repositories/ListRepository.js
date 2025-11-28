// repositories/ListItemRepository.js

const ListItem = require('../models/listItem');

class ListItemRepository {
  
  // ➤ CREATE
  async create(categoryId, data) {
    return await ListItem.create({
      categoryId,
      ...data,
    });
  }

  // ➤ GET ALL ITEMS OF CATEGORY
  async findAll(categoryId) {
    return await ListItem.findAll({
      where: { categoryId },
      order: [["createdAt", "ASC"]],
    });
  }

  // ➤ GET SINGLE ITEM
  async findOne(categoryId, itemId) {
    return await ListItem.findOne({
      where: { id: itemId, categoryId },
    });
  }

  // ➤ UPDATE
  async update(categoryId, itemId, updateData) {
    const item = await this.findOne(categoryId, itemId);
    if (!item) return null;

    await item.update(updateData);
    return item;
  }

  // ➤ DELETE
  async delete(categoryId, itemId) {
    const item = await this.findOne(categoryId, itemId);
    if (!item) return null;

    await item.destroy();
    return true;
  }
}

module.exports = ListItemRepository;
