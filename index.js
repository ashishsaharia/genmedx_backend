const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Enable CORS for all origins and methods
app.use(cors());

// Use built-in JSON parser instead of body-parser
app.use(express.json({ limit: '100mb' })); // Ensure large payloads are supported

app.post('/upload', (req, res) => {
  console.log('Received request body:', req.body); // Debugging

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const imageBuffer = Buffer.from(image, 'base64');
  const filePath = `uploads/image_${Date.now()}.png`;

  fs.writeFile(filePath, imageBuffer, (err) => {
    if (err) {
      console.error('Error saving image:', err);
      return res.status(500).json({ error: 'Failed to save image' });
    }
    res.json({ message: 'Image uploaded successfully', path: filePath });
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));
