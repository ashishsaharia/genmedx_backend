require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const documentRoutes = require("./routes/documentRoutes");

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));

// Connect to MongoDB
connectDB();

// Routes
app.use("/api", documentRoutes);
app.use("/api", require("./index")); // Integrate chatbot & OCR routes

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong", error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
