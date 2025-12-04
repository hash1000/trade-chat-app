// repositories/ShortListRepository.js
const Category = require("../models/category");
const List = require("../models/list");
const ShortList = require("../models/shortList");

class ShortListRepository {

  // ➤ CREATE - Create a new shortlist item
  async create(userId, data) {

    console.log("userId", userId, data);
    return await ShortList.create({
      userId,  // Add userId to the data
      ...data,
    });
  }

  // ➤ GET ALL ITEMS OF A USER
  async findAll(userId) {
    return await ShortList.findAll({
      where: { userId },  // Filter by userId
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: Category,
          as: "category", // The alias defined in the ShortList model
        },
        {
          model: List,
          as: "lists", // The alias defined in the List model
        }
      ]
    });
  }

  // ➤ GET SINGLE ITEM
  async findOne(userId, id) {
    console.log("userId, itemId", userId, id);

    return await ShortList.findOne({
      where: { id, userId },  // Ensure that the item belongs to the user
      include: [
        {
          model: Category,
          as: "category", // The alias defined in the ShortList model
        },
        {
          model: List,
          as: "lists", // The alias defined in the List model
        }
      ]
    });
  }

  async findById(id) {
    console.log("userId, itemId", id);
    return await ShortList.findOne({
      where: { id },  // Ensure that the item belongs to the user
    });
  }

  // ➤ UPDATE - Update a shortlist item
  async update(userId, id, updateData) {
    const item = await this.findOne(userId, id);
    if (!item) return null;

    await item.update(updateData);
    return item;
  }

  // ➤ DELETE - Delete a shortlist item
  async delete(userId, id) {
    const item = await this.findOne(userId, id);
    if (!item) return null;

    await item.destroy();
    return true;
  }
}

module.exports = ShortListRepository;
