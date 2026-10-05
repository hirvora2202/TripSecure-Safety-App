require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const dns = require("dns");

const app = express();

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

// ================= DB CONNECT =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Atlas Connected"))
  .catch((err) => console.log("DB Error:", err));

// ================= MODELS =================
const User = mongoose.model("User", {
  email: {
    type: String,
    lowercase: true,
    trim: true,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const Contact = mongoose.model("Contact", {
  userId: String,
  name: String,
  phone: String,
  tag: String,
});

const SOS = mongoose.model("SOS", {
  userId: String,
  lat: Number,
  lon: Number,
  time: {
    type: Date,
    default: Date.now,
  },
});

const Report = mongoose.model("Report", {
  userId: String,
  type: String,
  description: String,
  date: String,
  time: String,
  location: {
    lat: Number,
    lon: Number,
    name: String,
  },
  evidence: [
    {
      name: String,
      size: Number,
      type: String,
      dataUrl: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ================= JWT =================
const SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "❌ No token provided" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ message: "❌ Invalid token" });
  }
}

// ================= SMS FUNCTION =================
async function sendSMS(message, phone) {
  try {
    // Clean phone number
    phone = phone.replace(/\D/g, "");

    // Fast2SMS expects comma-separated numbers
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q",
        message: message,
        language: "english",
        numbers: phone,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("SMS RESPONSE:", response.data);

    return response.data.return === true;
  } catch (err) {
    console.log(
      "❌ SMS ERROR:",
      err.response?.data || err.message
    );
    return false;
  }
}

function generateWhatsAppLink(phone, lat, lon) {
  // Remove everything except digits
  phone = phone.replace(/\D/g, "");

  // Ensure Indian number format
  if (phone.length === 10) {
    phone = "91" + phone;
  }

  const message = encodeURIComponent(
    `🚨 SOS ALERT!
I need help!
https://maps.google.com/?q=${lat},${lon}`
  );

  return `https://wa.me/${phone}?text=${message}`;
}

// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = (email || "").trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashed,
    });

    await newUser.save();

    res.json({
      message: "✅ User created successfully",
    });
  } catch {
    res.status(500).json({
      message: "Server error",
    });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    let { identifier, email, password } = req.body;

    const loginId = (identifier || email || "")
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: loginId,
    });

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {
      return res.status(400).json({
        message: "Wrong password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "✅ Login successful",
      token,
    });
  } catch {
    res.status(500).json({
      message: "Server error",
    });
  }
});

// ================= CONTACTS =================
app.post("/contacts", auth, async (req, res) => {
  try {
    const contact = new Contact({
      userId: req.user.id,
      name: req.body.name,
      phone: req.body.phone,
      tag: req.body.tag,
    });

    await contact.save();

    res.json({
      message: "✅ Contact saved",
    });
  } catch {
    res.status(500).json({
      message: "Error saving contact",
    });
  }
});

app.get("/contacts", auth, async (req, res) => {
  try {
    const { all } = req.query;

    let contacts;

    if (all === "true") {
      contacts = await Contact.find();
    } else {
      contacts = await Contact.find({
        userId: req.user.id,
      });
    }

    res.json(contacts);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Error fetching contacts",
    });
  }
});

app.delete("/contacts/:id", auth, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);

    res.json({
      message: "✅ Contact deleted",
    });
  } catch {
    res.status(500).json({
      message: "Error deleting contact",
    });
  }
});

// ================= SOS =================
app.post("/sos", auth, async (req, res) => {
  try {
    const { lat, lon } = req.body;

    const sos = new SOS({
      userId: req.user.id,
      lat,
      lon,
    });

    await sos.save();

    const contacts = await Contact.find({
      userId: req.user.id,
      tag: "emergency",
    });

    if (contacts.length === 0) {
      return res.json({
        message: "No emergency contacts found",
      });
    }

    const message = `SOS ALERT!
I need help!
https://maps.google.com/?q=${lat},${lon}`;

    const results = [];

    for (const c of contacts) {
      const smsSent = await sendSMS(
        message,
        c.phone
      );

      if (smsSent) {
        results.push({
          phone: c.phone,
          status: "SMS Sent",
        });
      } else {
        // Fallback to WhatsApp
        const waLink = generateWhatsAppLink(
          c.phone,
          lat,
          lon
        );

        results.push({
          phone: c.phone,
          status: "SMS Failed → WhatsApp",
          whatsapp: waLink,
        });
      }
    }

    res.json({
      message: "SOS processed",
      results,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Error sending SOS",
    });
  }
});

// ================= HISTORY =================
app.get("/history", auth, async (req, res) => {
  try {
    const history = await SOS.find({
      userId: req.user.id,
    }).sort({
      time: -1,
    });

    res.json(history);
  } catch {
    res.status(500).json({
      message: "Error fetching history",
    });
  }
});

// ================= TEST =================
app.get("/", (req, res) => {
  res.send("🚀 Backend is running");
});

// ================= REPORT =================
app.post("/report", auth, async (req, res) => {
  try {
    const report = new Report({
      ...req.body,
      userId: req.user.id,
      createdAt: new Date(),
    });

    await report.save();

    res.json({
      message: "Report submitted successfully",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Error saving report",
    });
  }
});

// ================= START SERVER =================
app.listen(5000, () => {
  console.log(
    "🚀 Server running on http://localhost:5000"
  );
});