// services/ListService.js
const ListRepository = require('../repositories/ListRepository');
const ShortListRepository = require('../repositories/ShortListRepository');  // Add this import to check ShortList existence

class ListService {
  constructor() {
    this.listRepository = new ListRepository();
    this.shortListRepository = new ShortListRepository();  // Add this initialization
  }

  // ➤ CREATE a new list item
  async createListItem(shortListId, data) {
    // Check if the ShortList exists
    const shortList = await this.shortListRepository.findById(shortListId);
    if (!shortList) {
      throw new Error("ShortList not found");
    }

    return await this.listRepository.create(shortListId, data);
  }

  // ➤ GET all list items for a specific shortList
  async getListItems(shortListId) {
    return await this.listRepository.findAll(shortListId);
  }

  async getSingleListItems(id) {
    return await this.listRepository.findOne(id);
  }

  // ➤ Reorder list items
  async reorderListItems(shortListId, orderedListIds) {
    // Check if the ShortList exists
    const shortList = await this.shortListRepository.findById(shortListId);
    if (!shortList) {
      throw new Error("ShortList not found");
    }

    // Update the sequence of each list item based on the new order
    for (let index = 0; index < orderedListIds.length; index++) {
      await this.listRepository.update(shortListId, orderedListIds[index], { sequence: index + 1 });
    }

    return { message: "List items reordered successfully" };
  }

  async updateListItem(shortListId, listId, updateData) {
    // Check if the ShortList exists
    const shortList = await this.shortListRepository.findById(shortListId);
    if (!shortList) {
      throw new Error("ShortList not found");
    }

    // Update the list item
    return await this.listRepository.update(shortListId, listId, updateData);
  }

  async deleteListItem( listId) {
    // Check if the ShortList exists

    // Delete the list item
    return await this.listRepository.delete(listId);
  }
  
}

module.exports = ListService;
