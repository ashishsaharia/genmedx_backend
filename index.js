const express = require("express");
const fs = require("fs");
const Groq = require("groq-sdk").default;
const tesseract = require("tesseract.js");

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Chatbot Function
async function getGroqChatCompletion(message) {
  try {
    return await groq.chat.completions.create({
      messages: [{ role: "user", content: message }],
      model: "llama-3.3-70b-versatile",
    });
  } catch (error) {
    console.error("Error making API call:", error);
    return null;
  }
}

// Chatbot Route
router.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: "Message is required" });

    const chatCompletion = await getGroqChatCompletion(userMessage);
    const response = chatCompletion.choices[0]?.message?.content || "No response";
    
    res.json({ response });
  } catch (error) {
    console.error("Error fetching response:", error);
    res.status(500).json({ error: "Failed to fetch chat response" });
  }
});

// OCR Route
router.post("/upload", async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const imageBuffer = Buffer.from(image, "base64");
  const filePath = `uploads/image_${Date.now()}.png`;

  fs.writeFile(filePath, imageBuffer, async (err) => {
    if (err) {
      console.error("Error saving image:", err);
      return res.status(500).json({ error: "Failed to save image" });
    }

    try {
      const { data: { text } } = await tesseract.recognize(filePath, "eng");
      res.json({ message: "Image uploaded successfully", path: filePath, extractedText: text });
    } catch (error) {
      console.error("Error extracting text:", error);
      res.status(500).json({ error: "Failed to extract text from the image." });
    }
  });
});

module.exports = router;
