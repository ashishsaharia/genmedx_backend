const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Document = require('../models/Document');

const router = express.Router();

// Multer setup for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Upload document to Cloudinary and save to MongoDB
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("Uploading to Cloudinary:", req.file.originalname);

        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: "auto" },
                (error, result) => (error ? reject(error) : resolve(result))
            );
            uploadStream.end(req.file.buffer);
        });

        console.log("Cloudinary Response:", result);

        const document = new Document({
            user: req.body.userId || "65f123456789abcd01234567", // Dummy user ID for now
            title: req.file.originalname,
            documentType: req.file.mimetype.split('/')[1],
            cloudinaryUrl: result.secure_url,
            cloudinaryPublicId: result.public_id,
            fileSize: req.file.size
        });

        await document.save();

        res.status(201).json({ message: "File uploaded successfully", document });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
});

// Retrieve all documents
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const documents = await Document.find({ user: userId });

        if (!documents.length) {
            return res.status(404).json({ message: "No documents found for this user" });
        }

        // Extract only Cloudinary URLs
        const documentUrls = documents.map(doc => ({
            documentUrl: doc.cloudinaryUrl
        }));

        res.status(200).json(documentUrls);
    } catch (error) {
        console.error("Fetch Error:", error);
        res.status(500).json({ message: "Server error", error });
    }
});



module.exports = router;