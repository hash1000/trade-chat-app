const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

// Configure S3 client
const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  region: process.env.SPACES_REGION,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

const uploadFileToS3 = async (buffer, originalname, mimetype) => {
  const ext = originalname.split('.').pop().toLowerCase();
  const key = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
  
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: key,
        Body: buffer, // Make sure this is a Buffer
        ACL: "public-read",
        ContentType: mimetype,
      },
    });

    const result = await upload.done();
    console.log('Upload result:', result); // Debug logging

    console.log("resij",{
      title: originalname,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      key
    })
    return {
      title: originalname,
      url: `${process.env.IMAGE_END_POINT}/${key}`,
      key
    };
  } catch (error) {
    console.error('S3 Upload Error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

const deleteFileFromS3 = async (key) => {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.SPACES_BUCKET_NAME,
    Key: key, // Use the key, not the full URL
  }));
  return true;
};

module.exports = { s3Client, uploadFileToS3, deleteFileFromS3 };