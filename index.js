const Groq = require("groq-sdk").default; 
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const tesseract = require("tesseract.js");
const path = require("path");
const Redis = require("ioredis");


const app = express();
const redis = new Redis(6380);
const groq = new Groq({ apiKey: "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" });

// Enable CORS for all origins and methods
app.use(cors());

// Use built-in JSON parser instead of body-parser
app.use(express.json({ limit: "100mb" })); // Ensure large payloads are supported
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

async function getGroqChatCompletion(messages) {
  try {
    return await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
    });
  } catch (error) {
    console.error("Error making API call:", error);
    return null;
  }
}



app.post("/chat", async (req, res) => {
  try {
    const { message, userEmail } = req.body;
    if (!message || !userEmail) return res.status(400).json({ error: "Message and userEmail are required" });

    const redisKey = `chat:${userEmail}`;
    let chatHistory = await redis.get(redisKey);

    let messages = [];
    if (chatHistory) {
      messages = JSON.parse(chatHistory);
    } else {
      messages.push({
        role: "system",
        content: "You are an AI assistant helping the user based on previous context.",
      });
    }

    messages.push({ role: "user", content: message });

    const chatCompletion = await getGroqChatCompletion(messages);
    const aiResponse = chatCompletion.choices[0]?.message?.content || "No response";

    messages.push({ role: "assistant", content: aiResponse });

    await redis.setex(redisKey, 3600, JSON.stringify(messages));

    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Error fetching response:", error);
    res.status(500).json({ error: "Failed to fetch chat response" });
  }
});



app.post("/logout", async (req, res) => {
  const { userEmail } = req.body;
  if (!userEmail) return res.status(400).json({ error: "userEmail required" });

  await redis.del(`chat:${userEmail}`);
  res.json({ message: "Chat memory cleared." });
});

app.post("/upload", async (req, res) => {
  const { image, userEmail } = req.body;

  if (!image) return res.status(400).json({ error: "No image provided" });
  if (!userEmail) return res.status(400).json({ error: "No user email provided" });

  try {
    // Create folder path: uploads/user@example.com/
    const userFolder = path.join(__dirname, "uploads", userEmail);

    // Create the folder if it doesn't exist
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    // Generate unique file path inside user folder
    const filePath = path.join(userFolder, `image_${Date.now()}.png`);

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(image, "base64");

    // Save image to file
    fs.writeFile(filePath, imageBuffer, async (err) => {
      if (err) {
        console.error("Error saving image:", err);
        return res.status(500).json({ error: "Failed to save image" });
      }

      try {
        const { data: { text } } = await tesseract.recognize(filePath, "eng");
        res.json({
          message: "Image uploaded successfully",
          path: filePath,
          extractedText: text,
        });
      } catch (error) {
        console.error("Error extracting text:", error);
        res.status(500).json({ error: "Failed to extract text from the image." });
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});


app.get("/uploads/:email", (req, res) => {
  const email = req.params.email;
  // const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_"); // sanitize
  // console.log(email)
  const userFolder = path.join(__dirname, "uploads", email);

  if (!fs.existsSync(userFolder)) {
    return res.json([]);
  }

  fs.readdir(userFolder, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error reading user folder" });
    }

    const fileUrls = files.map((file) => {
      return `http://localhost:3000/uploads/${email}/${file}`;
    });

    res.json(fileUrls);
  });
});




app.listen(3000, () => console.log("Server running on port 3000"));
