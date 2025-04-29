const mongoose = require("mongoose");

const ocrTextSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  fileName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("OcrText", ocrTextSchema);
