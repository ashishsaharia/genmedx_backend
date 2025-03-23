const Groq = require("groq-sdk").default; 
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const tesseract = require("tesseract.js");

const app = express();
const groq = new Groq({ apiKey: "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" });

// Enable CORS for all origins and methods
app.use(cors());

// Use built-in JSON parser instead of body-parser
app.use(express.json({ limit: "100mb" })); // Ensure large payloads are supported

async function getGroqChatCompletion(message) {
  try {
    return await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });
  } catch (error) {
    console.error("Error making API call:", error);
    return null;
  }
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message; 
    // console.log(userMessage);
    if (!userMessage) return res.status(400).json({ error: "Message is required" });

    const chatCompletion = await getGroqChatCompletion(userMessage);
    const response = chatCompletion.choices[0]?.message?.content || "No response";
    console.log(response);
    res.json({ response });
  } catch (error) {
    console.error("Error fetching response:", error);
    res.status(500).json({ error: "Failed to fetch chat response" });
  }
});


app.post("/upload", async (req, res) => {
  // console.log("Received request body:", req.body); // Debugging

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
      // console.log("OCR result:", text);
      res.json({ message: "Image uploaded successfully", path: filePath, extractedText: text });
    } catch (error) {
      console.error("Error extracting text:", error);
      res.status(500).json({ error: "Failed to extract text from the image." });
    }
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));
