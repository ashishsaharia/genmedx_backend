const mongoose = require("mongoose");

const medicalInfoSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  medicines: [
    {
      name: { type: String, required: true },
      cause: { type: String, required: true },
    },
  ],
});

module.exports = mongoose.model("MedicalInfo", medicalInfoSchema);
