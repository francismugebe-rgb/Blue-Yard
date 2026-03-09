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

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "blueyad_secret_key_2024";

// Middleware
app.use(cors());
app.use(express.json());

// --- MOCK DATABASE FOR PREVIEW ---
// Since we don't have a live MongoDB, we'll use an in-memory store for the demo
// but structure it so it's easily replaceable with Mongoose.
const users: any[] = [];
const conversations: any[] = [];
const messages: any[] = [];

// --- AUTH ROUTES ---
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: "User already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    email,
    password: hashedPassword,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    about: "Hey there! I am using BLUEYAD.",
    lastSeen: new Date(),
    isOnline: false,
  };
  users.push(newUser);
  const token = jwt.sign({ id: newUser.id }, JWT_SECRET);
  res.json({ token, user: { id: newUser.id, name, email, avatar: newUser.avatar, about: newUser.about } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, about: user.about } });
});

// --- USER ROUTES ---
app.get("/api/users", (req, res) => {
  const query = req.query.search as string;
  if (query) {
    const filtered = users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
    return res.json(filtered);
  }
  res.json(users);
});

// --- CONVERSATION ROUTES ---
app.get("/api/conversations", (req, res) => {
  const userId = req.headers["user-id"] as string;
  const userConvos = conversations.filter(c => c.participants.includes(userId));
  res.json(userConvos);
});

// --- MESSAGE ROUTES ---
app.get("/api/messages/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const convoMessages = messages.filter(m => m.conversationId === conversationId);
  res.json(convoMessages);
});

// --- SOCKET.IO LOGIC ---
const userSockets = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    userSockets.set(userId, socket.id);
    const user = users.find(u => u.id === userId);
    if (user) {
      user.isOnline = true;
      io.emit("user_status", { userId, isOnline: true });
    }
  });

  socket.on("send_message", (data) => {
    const { senderId, receiverId, text, imageUrl, conversationId, isGroup } = data;
    
    const newMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId,
      receiverId,
      text,
      imageUrl,
      conversationId,
      timestamp: new Date(),
      status: "sent",
      reactions: []
    };
    
    messages.push(newMessage);

    // Update or create conversation
    let convo = conversations.find(c => c.id === conversationId);
    if (!convo) {
      convo = {
        id: conversationId,
        participants: [senderId, receiverId],
        lastMessage: text || "Image",
        updatedAt: new Date(),
        isGroup: isGroup || false,
        name: isGroup ? data.groupName : null
      };
      conversations.push(convo);
    } else {
      convo.lastMessage = text || "Image";
      convo.updatedAt = new Date();
    }

    // Emit to receiver if online
    if (isGroup) {
      socket.to(conversationId).emit("receive_message", newMessage);
    } else {
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", newMessage);
      }
    }
    
    // Send back to sender for confirmation
    socket.emit("message_sent", newMessage);
  });

  socket.on("typing", (data) => {
    const { senderId, receiverId, conversationId } = data;
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_typing", { senderId, conversationId });
    }
  });

  socket.on("react", (data) => {
    const { messageId, reaction, userId } = data;
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = [];
      msg.reactions.push({ userId, reaction });
      io.emit("message_reaction", { messageId, reaction, userId });
    }
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        const user = users.find(u => u.id === userId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          io.emit("user_status", { userId, isOnline: false, lastSeen: user.lastSeen });
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

startServer();
