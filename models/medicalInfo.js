const mongoose = require("mongoose");

const medicalInfoSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  medicines: [
    {
      name: { type: String, required: true },
      cause: { type: String, required: true },
      repeatperiod: { type: String, required: false },
    },
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MedicalInfo", medicalInfoSchema);
