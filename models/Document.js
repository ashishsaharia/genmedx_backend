const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      default: "65f123456789abcd01234567", // Dummy user ID
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    documentType: {
      type: String,
      enum: ["png", "jpg", "jpeg", "gif", "svg", "pdf", "doc", "docx", "txt", "other"],
      required: true,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    ocrText: {
      type: String,
      required: false, // New field for OCR text
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
