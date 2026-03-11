import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "blueyad_secret_key_2024";

// --- DATABASE CONNECTION ---
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

// --- MODELS ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: String,
  about: { type: String, default: "Hey there! I am using BLUEYAD." },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);

const MessageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  text: String,
  imageUrl: String,
  conversationId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: "sent" },
  reactions: [{ userId: String, reaction: String }]
});

const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

const ConversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  participants: [String],
  lastMessage: String,
  updatedAt: { type: Date, default: Date.now },
  isGroup: { type: Boolean, default: false },
  name: String
});

const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- SEED ADMIN USER ---
const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@blueyad.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  try {
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        name: "Admin User",
        email: adminEmail,
        password: hashedPassword,
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
        about: "System Administrator",
      });
      console.log("✅ Admin user seeded");
    }
  } catch (err) {
    console.error("Error seeding admin:", err);
  }
};

if (MONGODB_URI) seedAdmin();

// --- AUTH ROUTES ---
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    });
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET);
    res.json({ token, user: { id: newUser._id, name, email, avatar: newUser.avatar, about: newUser.about } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, about: user.about } });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

// --- USER ROUTES ---
app.get("/api/users", authenticateToken, async (req, res) => {
  const query = req.query.search as string;
  try {
    let filter = {};
    if (query) {
      filter = { name: { $regex: query, $options: "i" } };
    }
    const users = await User.find(filter, "-password");
    res.json(users.map((u: any) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      about: u.about,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen
    })));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// --- CONVERSATION ROUTES ---
app.get("/api/conversations", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const userConvos = await Conversation.find({ participants: userId });
    res.json(userConvos);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// --- MESSAGE ROUTES ---
app.get("/api/messages/:conversationId", authenticateToken, async (req, res) => {
  const { conversationId } = req.params;
  try {
    const convoMessages = await Message.find({ conversationId });
    res.json(convoMessages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// --- SOCKET.IO LOGIC ---
const userSockets = new Map();

io.on("connection", (socket) => {
  socket.on("join", async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.warn(`Invalid userId received in join: ${userId}`);
      return;
    }
    userSockets.set(userId, socket.id);
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit("user_status", { userId, isOnline: true });
    } catch (err) {
      console.error("Error in join socket handler:", err);
    }
  });

  socket.on("send_message", async (data) => {
    const { senderId, receiverId, text, imageUrl, conversationId, isGroup } = data;
    
    if (!mongoose.Types.ObjectId.isValid(senderId) || (!isGroup && !mongoose.Types.ObjectId.isValid(receiverId))) {
      console.warn("Invalid senderId or receiverId in send_message");
      return;
    }

    try {
      const newMessage = await Message.create({
        senderId,
        receiverId,
        text,
        imageUrl,
        conversationId,
        status: "sent",
        reactions: []
      });
      
      await Conversation.findOneAndUpdate(
        { id: conversationId },
        { 
          participants: [senderId, receiverId],
          lastMessage: text || "Image",
          updatedAt: new Date(),
          isGroup: isGroup || false,
          name: isGroup ? data.groupName : null
        },
        { upsert: true, new: true }
      );

      if (isGroup) {
        socket.to(conversationId).emit("receive_message", newMessage);
      } else {
        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", newMessage);
        }
      }
      socket.emit("message_sent", newMessage);
    } catch (err) {
      console.error("Socket send_message error:", err);
    }
  });

  socket.on("typing", (data) => {
    const { senderId, receiverId, conversationId } = data;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) return;
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_typing", { senderId, conversationId });
    }
  });

  socket.on("react", async (data) => {
    const { messageId, reaction, userId } = data;
    if (!mongoose.Types.ObjectId.isValid(messageId)) return;
    try {
      await Message.findByIdAndUpdate(messageId, {
        $push: { reactions: { userId, reaction } }
      });
      io.emit("message_reaction", { messageId, reaction, userId });
    } catch (err) {
      console.error("Socket react error:", err);
    }
  });

  socket.on("disconnect", async () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          io.emit("user_status", { userId, isOnline: false, lastSeen });
        }
        break;
      }
    }
  });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Global Error Handler for Mongoose CastErrors
app.use((err: any, req: any, res: any, next: any) => {
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      message: 'Invalid ID format',
      error: err.message
    });
  }
  next(err);
});

startServer();
