const express = require("express");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const tesseract = require("tesseract.js");
const Document = require("../models/Document");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload and process document
router.post("/uploads", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("Uploading to Cloudinary:", req.file.originalname);

    // Upload file to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "auto" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      uploadStream.end(req.file.buffer);
    });

    console.log("Cloudinary Response:", result);

    // Perform OCR
    const { data: { text } } = await tesseract.recognize(result.secure_url, "eng");

    // Store document details in MongoDB
    const document = new Document({
      user: "65f123456789abcd01234567", // Dummy user ID
      title: req.file.originalname,
      documentType: req.file.mimetype.split("/")[1],
      cloudinaryUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      fileSize: req.file.size,
      ocrText: text, // Store OCR extracted text
    });

    await document.save();

    res.status(201).json({ message: "File uploaded successfully", document });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Retrieve documents for a specific user
router.get("/documents/:userId", async (req, res) => {
    console.log("✅ API Hit: /api/documents/:userId");
    console.log("Request Params:", req.params);

    try {
        const { userId } = req.params;
        console.log("Fetching documents for user:", userId);

        const documents = await Document.find({ user: userId });

        console.log("Documents found:", documents.length);

        if (!documents.length) {
            return res.status(404).json({ message: "No documents found for this user" });
        }

        res.status(200).json(documents);
    } catch (error) {
        console.error("❌ Fetch Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});




module.exports = router;
