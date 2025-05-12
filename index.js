const Groq = require("groq-sdk").default;
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const tesseract = require("tesseract.js");
const OcrText = require("./models/OcrText");
const MedicalInfo = require("./models/medicalInfo");
const path = require("path");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const { log } = require("console");
const Redis = require("ioredis");
// const User = require("./models/User")


dotenv.config();
connectDB();

const redis = new Redis(6380);

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



// app.post("/chat", async (req, res) => {
//   try {
//     const { message, userEmail } = req.body;
//     if (!message || !userEmail) return res.status(400).json({ error: "Message and userEmail are required" });

//     const redisKey = `chat:${userEmail}`;
//     let chatHistory = await redis.get(redisKey);

//     let messages = [];
//     if (chatHistory) {
//       messages = JSON.parse(chatHistory);
//     } else {
//       messages.push({
//         role: "system",
//         content: "You are an AI assistant helping the user based on previous context.",
//       });
//     }

//     messages.push({ role: "user", content: message });

//     const chatCompletion = await getGroqChatCompletion(messages);
//     const aiResponse = chatCompletion.choices[0]?.message?.content || "No response";

//     messages.push({ role: "assistant", content: aiResponse });

//     await redis.setex(redisKey, 3600, JSON.stringify(messages));

//     res.json({ response: aiResponse });
//   } catch (error) {
//     console.error("Error fetching response:", error);
//     res.status(500).json({ error: "Failed to fetch chat response" });
//   }
// });

app.post("/chat", async (req, res) => {
  try {
    const { message, userEmail } = req.body;
    if (!message || !userEmail)
      return res.status(400).json({ error: "Message and userEmail are required" });

    const redisKey = `chat:${userEmail}`;
    let chatHistory = await redis.get(redisKey);

    let messages = [];

    if (!chatHistory) {
      // First-time chat: fetch OCR text and inject into memory
      const ocrResponse = await fetch(`http://localhost:3000/get-ocr/${userEmail}`);
      const ocrData = await ocrResponse.json();
      const ocrText = ocrData.ocrTexts || "No OCR data available.";

      // console.log(ocrText);
      

      messages.push({
        role: "system",
        content: "You are an AI assistant helping the user based on previous OCR data and chat context.",
      });
      messages.push({
        role: "assistant",
        content: `Here is some OCR-extracted context from the user's documents:\n\n${ocrText}`,
      });
    } else {
      messages = JSON.parse(chatHistory);
    }

    // Append user's current message
    messages.push({ role: "user", content: message });

    // Get AI response
    const chatCompletion = await getGroqChatCompletion(messages);
    const aiResponse = chatCompletion.choices[0]?.message?.content || "No response";

    // Append AI's response
    messages.push({ role: "assistant", content: aiResponse });

    // Save updated history
    await redis.setex(redisKey, 3600, JSON.stringify(messages));

    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Error fetching response:", error);
    res.status(500).json({ error: "Failed to fetch chat response" });
  }
});


// // Chat endpoint
// app.post("/chat", async (req, res) => {
//   const { message, userEmail } = req.body;
//   if (!message || !userEmail) return res.status(400).json({ error: "Missing message or email" });

//   const chatHistory = [
//     { role: "system", content: "You are a helpful medical assistant." },
//     { role: "user", content: message },
//   ];

//   const chatCompletion = await getGroqChatCompletion(chatHistory);
//   const aiResponse = chatCompletion?.choices?.[0]?.message?.content || "No response";

//   res.json({ response: aiResponse });
// });



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

        // ⬇️ Redis Update Starts Here
        const redisKey = `chat:${userEmail}`;
        let messages = [];

        const chatHistory = await redis.get(redisKey);
        if (chatHistory) {
          messages = JSON.parse(chatHistory);

          // Optional: Remove previous OCR-injected assistant messages
          messages = messages.filter(msg =>
            !(msg.role === "assistant" && msg.content?.includes("OCR-extracted context"))
          );

          // Re-inject updated OCR
          const systemIndex = messages.findIndex(msg => msg.role === "system");
          const insertIndex = systemIndex >= 0 ? systemIndex + 1 : 0;
          messages.splice(insertIndex, 0, {
            role: "assistant",
            content: `Here is an updated OCR-extracted context from the user's documents:\n\n${text}`,
          });
        } else {
          // If no chat yet, initialize with system + OCR context
          messages = [
            {
              role: "system",
              content: "You are an AI assistant helping the user based on OCR data and chat context.",
            },
            {
              role: "assistant",
              content: `Here is an OCR-extracted context from the user's documents:\n\n${text}`,
            }
          ];
        }

        // Save back to Redis
        await redis.setex(redisKey, 3600, JSON.stringify(messages));

        // Respond
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
      const timestamp = entry.createdAt.toLocaleString(); // Get the creation time from the DB
      combinedText += `this is the new document ocr(remember it)\nand the Time when this text was updtaed is : ${timestamp}\n${entry.text}\n`;
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

// this is the onboarding route 
const User = require("./models/User"); // adjust path as needed

app.post("/onboarding", async (req, res) => {
  const {
    userEmail,
    fullName,
    phoneNumber,
    userAge,
    userGender,
    userHeight,
    userWeight,
    userMedicalCondition,
    userAlergies,
    userEmergencyContact
  } = req.body;

  if (
    !userEmail || !fullName || !phoneNumber || !userAge || !userGender ||
    !userHeight || !userWeight || !userEmergencyContact
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    let user = await User.findOne({ userEmail });

    if (user) {
      // Optional: update existing user
      await User.updateOne({ userEmail }, {
        fullName,
        phoneNumber,
        userAge,
        userGender,
        userHeight,
        userWeight,
        userMedicalCondition,
        userAlergies,
        userEmergencyContact
      });
    } else {
      // Create new user
      user = new User({
        userEmail,
        fullName,
        phoneNumber,
        userAge,
        userGender,
        userHeight,
        userWeight,
        userMedicalCondition,
        userAlergies,
        userEmergencyContact
      });

      await user.save();
    }

    res.status(200).json({ message: "User onboarding saved successfully" });
  } catch (err) {
    console.error("Onboarding save error:", err);
    res.status(500).json({ error: "Server error while saving onboarding data" });
  }
});




app.post("/add-medicine", async (req, res) => {
  const { userEmail, name, cause,repeatperiod } = req.body;

  if (!userEmail || !name || !cause|| !repeatperiod) {
    return res.status(400).json({ error: "userEmail, name, and cause are required" });
  }

  try {
    // Fetch or create the MedicalInfo document
    let medicalInfo = await MedicalInfo.findOne({ userEmail });
    if (!medicalInfo) {
      medicalInfo = new MedicalInfo({ userEmail, medicines: [] });
    }

    // Construct the new medicine object
    const newMedicine = { name, cause ,repeatperiod};

    // Add the new medicine to the medicines array
    medicalInfo.medicines.push(newMedicine);
    await medicalInfo.save();
const timestamp = medicalInfo.createdAt.toLocaleString();
    // Construct the new medicine text to be appended to OCR text
    const newMedicineText = `Medicine name is this(this medicne was added manually not the pdf or any ocr remember it) : ${name}\nand its Cause is this : ${cause}\nthe repeat period for this medicine is ${repeatperiod}\nand this medicine was updated on the date${timestamp}\n`;

    // Update the OCR Text document
    const ocrTextDoc = await OcrText.findOne({ userEmail });
    // console.log("newMedicineText", newMedicineText);
    if (ocrTextDoc) {
      // Append to the existing OCR text
      ocrTextDoc.text += newMedicineText;
      await ocrTextDoc.save();
    } else {
      // Create a new OCR text document if not found
      await OcrText.create({
        userEmail,
        fileName: "medicine_info.txt",
        text: newMedicineText,
      });
    }

    res.status(200).json({ message: "Medicine info added and OCR text updated", medicalInfo });

  } catch (err) {
    console.error("Error adding medicine info:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// to check the user is present in the db
app.get('/check-user/:email', async (req, res) => {
  const email = req.params.email;

  try {
    const user = await User.findOne({ userEmail: email });

    if (user) {
      // User exists
      return res.json({ exists: true });
    } else {
      // User does not exist
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});





// Start the server
app.listen(3000, () => console.log("Backend running on port 3000"));


// http://localhost:3000/get-ocr/rishabh94033@gmail.com