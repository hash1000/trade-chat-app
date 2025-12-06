// repositories/ListRepository.js

const List = require("../models/list");

class ListRepository {
  // ➤ CREATE a new list item
  async create(shortListId, data) {
    return await List.create({
      shortListId,
      ...data,
    });
  }

  // ➤ GET all lists for a specific ShortList
  async findAll(shortListId) {
    return await List.findAll({
      where: { shortListId },
      order: [["sequence", "ASC"]], // Optional: Order by sequence
    });
  }

  // ➤ GET a single list by shortListId and listId
  async findOne(id) {
    return await List.findOne({
      where: { id },
    });
  }

  async exist(shortListId, id) {
    return await List.findOne({
      where: { shortListId, id },
    });
  }

  // ➤ UPDATE a list item by id
  async update(shortListId, listId, updateData) {
    const list = await this.exist(shortListId, listId);
    if (!list) return null;

    await list.update(updateData);
    return list;
  }

  // ➤ DELETE a list item by id
  async delete(listId) {
    const list = await this.findOne(listId);

    await list.destroy();
    return true;
  }
}

module.exports = ListRepository;
