const Category = require('../models/category');
const { Op } = require('sequelize');
const ListItem = require('../models/listItem');

class CategoryRepository {
  async getCategoriesByUserId(userId) {
    return await Category.findAll({
      where: { userId },
      include: [
        {
          model: ListItem,
          as: "listItems",
        },
      ],
      order: [['sequence', 'ASC']],
    });
  }

  async getCategoryById(userId, categoryId) {
    return await Category.findOne({
      where: { id: categoryId, userId },
    });
  }

  async createCategory(userId, data) {
    console.log('Creating category for userId:', userId, 'with data:', data);
    const lastItem = await Category.findOne({
      where: { userId }
    });
    const nextSequence = lastItem ? lastItem.sequence + 1 : 1;
    return await Category.create({
      userId,
      sequence: nextSequence,
      ...data,
    });
  }

  async updateCategory(userId, categoryId, updateData) {
    const transaction = await Category.sequelize.transaction();

    try {
      const category = await Category.findOne({
        where: { id: categoryId, userId },
        transaction,
      });

      if (!category) {
        await transaction.rollback();
        return null;
      }

      // Extract listItems from payload
      const { listItems, sequence, ...safeData } = updateData;

      // Update category fields (without sequence)
      await category.update(safeData, { transaction });

      /** ------------------------------
       *  HANDLE LIST ITEMS
       * ------------------------------ */

      if (Array.isArray(listItems)) {
        // Delete old list items
        await ListItem.destroy({
          where: { categoryId },
          transaction,
        });

        // Insert new list items
        const newItems = listItems.map((item) => ({
          categoryId,
          title: item.title,
          description: item.description,
        }));

        await ListItem.bulkCreate(newItems, { transaction });
      }

      await transaction.commit();
      return category;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }


  async deleteCategory(userId, categoryId) {
    const transaction = await Category.sequelize.transaction();

    try {
      const category = await Category.findOne({
        where: { id: categoryId, userId },
        transaction,
      });

      if (!category) {
        await transaction.rollback();
        return null;
      }

      const deletedSeq = category.sequence;

      await Category.destroy({
        where: { id: categoryId, userId },
        transaction,
      });

      await Category.update(
        { sequence: Category.sequelize.literal('sequence - 1') },
        {
          where: { userId, sequence: { [Op.gt]: deletedSeq } },
          transaction,
        }
      );

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reorderCategory(userId, categoryId, newPosition) {
    const transaction = await Category.sequelize.transaction();

    try {
      const category = await Category.findOne({
        where: { id: categoryId, userId },
        transaction,
      });

      if (!category) {
        await transaction.rollback();
        return null;
      }

      const currentPos = category.sequence;

      if (currentPos === newPosition) {
        await transaction.commit();
        return this.getCategoriesByUserId(userId);
      }

      if (newPosition < currentPos) {
        await Category.update(
          { sequence: Category.sequelize.literal('sequence + 1') },
          {
            where: {
              userId,
              sequence: { [Op.between]: [newPosition, currentPos - 1] },
            },
            transaction,
          }
        );
      } else {
        await Category.update(
          { sequence: Category.sequelize.literal('sequence - 1') },
          {
            where: {
              userId,
              sequence: { [Op.between]: [currentPos + 1, newPosition] },
            },
            transaction,
          }
        );
      }

      await category.update({ sequence: newPosition }, { transaction });
      await transaction.commit();

      return this.getCategoriesByUserId(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = CategoryRepository;
