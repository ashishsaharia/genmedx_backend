const mongoose = require("mongoose");

const activityDataSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  activitydata: [
    {
      steps: { type: String, required: true },
      bloodPressure: { type: String, required: true },
      sleep: { type: String, required: false },
    },
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("activityData", activityDataSchema);