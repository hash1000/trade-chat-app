const Product = require("../models/product");
const { Op } = require("sequelize");
const ProductImage = require("../models/productImage");
const CustomError = require("../errors/CustomError");

class ProductRepository {
  async createProduct(productData) {
    return Product.create(productData);
  }

  async createBulkProductImage(productImage, transaction) {
    return await ProductImage.bulkCreate(productImage, { transaction });
  }

  async bulkDeleteProductImagesById(productImageIds, transaction) {
    // Ensure that productImageIds is an array of integers representing the product image IDs to delete
    return await ProductImage.destroy({
      where: {
        id: productImageIds, // Delete product images with the specified IDs
      },
      transaction, // Pass in the transaction for atomicity
    });
  }
  async bulkDeleteProductImagesByShopProductId(shopProductId, transaction) {
    return await ProductImage.destroy({
      where: {
        shopProductId
      },
      transaction
    });
  }

  // Bulk Update
  async bulkUpdateProductImages(productImageData, transaction) {
    return await ProductImage.update(
      productImageData, // Array of objects with id and updated fields
      {
        where: {
          id: productImageData.map(image => image.id), // Update only matching IDs
        },
        transaction,
      }
    );
  }

  async updateProduct(productId, productData) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    Object.assign(product, productData);
    return product.save();
  }

  async deleteProduct(productId) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new CustomError("Product not found", 400);
    }
    const ProductImages = await ProductImage.findAll({
      where: { productId },
    });
    if (ProductImages && ProductImages.length > 0) {
      throw new CustomError("Product is in use", 400);
    }
    return product.destroy();
  }

  async getProductById(productId) {
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  async getByUserId(userId) {
    // Retrieve the products created by the user from the database
    return await Product.findAll({ where: { userId } });
  }

  async getPaginatedProducts(page, limit, title, category) {
    const offset = (page - 1) * limit;

    const whereCondition = {};
    if (title) {
      whereCondition.title = { [Op.like]: `%${title}%` };
    }
    if (category) {
      whereCondition.category = { [Op.like]: `%${category}%` };
    }

    const products = await Product.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
    });

    return {
      total: products.count,
      totalPages: Math.ceil(products.count / limit),
      currentPage: page,
      products: products.rows,
    };
  }
}

module.exports = ProductRepository;
