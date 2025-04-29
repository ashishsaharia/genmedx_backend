const Groq = require("groq-sdk").default;
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const tesseract = require("tesseract.js");
const OcrText = require("./models/OcrText");
const path = require("path");
const connectDB = require("./config/db");
const dotenv = require("dotenv");

dotenv.config();
connectDB();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Helper for Groq call
async function getGroqChatCompletion(messages) {
  try {
    return await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
    });
  } catch (error) {
    console.error("Groq API error:", error);
    return null;
  }
}

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message, userEmail } = req.body;
  if (!message || !userEmail) return res.status(400).json({ error: "Missing message or email" });

  const chatHistory = [
    { role: "system", content: "You are a helpful medical assistant." },
    { role: "user", content: message },
  ];

  const chatCompletion = await getGroqChatCompletion(chatHistory);
  const aiResponse = chatCompletion?.choices?.[0]?.message?.content || "No response";

  res.json({ response: aiResponse });
});

// Upload + OCR
app.post("/upload", async (req, res) => {
  const { image, userEmail } = req.body;

  if (!image || !userEmail) return res.status(400).json({ error: "Missing image or email" });

  try {
    const userFolder = path.join(__dirname, "uploads", userEmail);
    if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

    const filePath = path.join(userFolder, `image_${Date.now()}.png`);
    const imageBuffer = Buffer.from(image, "base64");

    fs.writeFile(filePath, imageBuffer, async (err) => {
      if (err) return res.status(500).json({ error: "Error saving image" });

      try {
        // OCR Processing
        const { data: { text } } = await tesseract.recognize(filePath, "eng");

        // Save OCR text to the database
        const fileName = path.basename(filePath);
        const entry = new OcrText({ userEmail, fileName, text });
        await entry.save();

        // Respond with the extracted OCR text and file path
        res.json({ message: "Upload and OCR success", path: filePath, extractedText: text });
      } catch (error) {
        console.error("OCR error:", error);
        res.status(500).json({ error: "OCR processing failed" });
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

// List files
app.get("/uploads/:email", (req, res) => {
  const email = req.params.email;
  const userFolder = path.join(__dirname, "uploads", email);

  if (!fs.existsSync(userFolder)) return res.json([]);

  fs.readdir(userFolder, (err, files) => {
    if (err) return res.status(500).json({ error: "Unable to read folder" });

    const fileUrls = files.map(file => `http://localhost:3000/uploads/${email}/${file}`);
    res.json(fileUrls);
  });
});

// Fetch OCR entries for a user
app.get("/get-ocr/:email", async (req, res) => {
  try {
    const entries = await OcrText.find({ userEmail: req.params.email });

    let combinedText = "";
    entries.forEach(entry => {
      combinedText += `new document\n${entry.text}\n`;
    });

    res.status(200).json({
      email: req.params.email,
      ocrTexts: combinedText.trim()
    });
  } catch (error) {
    console.error("DB fetch error:", error);
    res.status(500).json({ error: "DB fetch failed" });
  }
});





// Start the server
app.listen(3000, () => console.log("Backend running on port 3000"));
