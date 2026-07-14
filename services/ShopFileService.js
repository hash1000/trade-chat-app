const { uploadMemoryFileToS3 } = require("../utilities/s3Utils");

// Uploads shop images to S3 and generates a thumbnail for each, reusing the
// exact pipeline behind POST /file/short. Passing "image" as the fileType is
// what makes uploadMemoryFileToS3 run the image through sharp and store the
// companion _thumb.jpg.
class ShopFileService {
  async uploadImage(file) {
    const result = await uploadMemoryFileToS3(
      file.buffer,
      file.originalname,
      file.mimetype,
      "image"
    );

    return {
      url: result.url,
      thumbnailUrl: result.thumbnailUrl ?? null,
    };
  }

  async uploadImages(files = []) {
    return Promise.all(files.map((file) => this.uploadImage(file)));
  }
}

module.exports = ShopFileService;
