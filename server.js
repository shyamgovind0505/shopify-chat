const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let sessions = {};

const SMTP_USER = process.env.SMTP_USER || "YOUR_GMAIL@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "YOUR_APP_PASSWORD";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "admin1@gmail.com,admin2@gmail.com,admin3@gmail.com").split(",");
const BASE_URL = process.env.BASE_URL || "https://YOUR-RENDER-URL.onrender.com";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

app.post("/new-chat", async (req, res) => {
  const { firstName, lastName, email, phone } = req.body || {};
  const sessionId = Math.random().toString(36).substring(2, 10);
  sessions[sessionId] = { messages: [], startedAt: Date.now(), visitor: { firstName, lastName, email, phone } };

  const adminLink = `${BASE_URL}/admin.html?session=${sessionId}`;

  const mail = {
    from: `"Shop Chat" <${SMTP_USER}>`,
    to: ADMIN_EMAILS,
    subject: `💬 New Chat Started`,
    html: `<p><strong>Visitor Info:</strong></p>
           <ul>
             <li>First Name: ${firstName || '-'}</li>
             <li>Last Name: ${lastName || '-'}</li>
             <li>Email: ${email || '-'}</li>
             <li>Phone: ${phone || '-'}</li>
           </ul>
           <p><a href="${adminLink}" target="_blank">👉 Open Chat Dashboard</a></p>`
  };

  try {
    await transporter.sendMail(mail);
    console.log("✅ Email sent for", sessionId, "to", ADMIN_EMAILS);
  } catch (err) {
    console.error("❌ Mail error:", err);
  }

  res.json({ sessionId, allowed: true });
});

io.on("connection", (socket) => {
  socket.on("join", ({ sessionId, role }) => {
    socket.join(sessionId);
    if (sessions[sessionId]?.messages) {
      socket.emit("history", sessions[sessionId].messages);
    }
  });

  socket.on("message", ({ sessionId, sender, text }) => {
    const msg = { sender, text, time: new Date().toISOString() };
    if (!sessions[sessionId]) sessions[sessionId] = { messages: [] };
    sessions[sessionId].messages.push(msg);
    io.to(sessionId).emit("message", msg);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
