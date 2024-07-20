const express = require('express')
const router = express.Router()
const multer = require('multer')
// Configure multer storage
const storage = multer.memoryStorage()
const upload = multer({ storage })
const path = require('path')
const authMiddleware = require('../middlewares/authenticate')
const { PutObjectCommand, S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT, // Find your endpoint in the control panel, under Settings. Prepend "https://".
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  region: process.env.SPACES_REGION, // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (for example, nyc3).
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY, // Access key pair. You can create access key pairs using the control panel or API.
    secretAccessKey: process.env.SPACES_SECRET // Secret access key defined through an environment variable.
  }
});


// Express route for file upload
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    const { id } = req.user

    // Check if file is present
    if (!file) {
      return res.status(400).json({ error: 'No file was uploaded' })
    }
    // Create a new file name with the user id, timestamp and the original file extension
    const fileName = `${id}-${Date.now()}${path.extname(file.originalname)}`

    const params = {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer
    }
    const data = await s3Client.send(new PutObjectCommand(params));

    res.status(200).json({ message: 'File uploaded successfully', fileUrl: params.Key })
    
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'An error occurred while uploading the file' })
  }
})

router.delete('/delete', (req, res) => {
  try {
    const fileName = req.body.url // Get the URL from the request body

    const params = {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: fileName
    }
    s3Client.send(new DeleteObjectCommand(params));
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'An error occurred while deleting the file' })
  }
})

router.get('/download', async (req, res) => {
  try {
    const fileName = req.query.filename // Get
    const params = {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: fileName
    }
    const object = await s3Client.send(new GetObjectCommand(params));
    // const fileStream = object.createReadStream()
    // Set the response headers
    res.attachment(fileName)
    
    // Set the 'Content-Length' header to the total file size
    res.setHeader('Content-Length', object.ContentLength);

    // Pipe the file stream to the response
    object.Body.pipe(res)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'An error occurred while downloading the file' })
  }
})

module.exports = router
