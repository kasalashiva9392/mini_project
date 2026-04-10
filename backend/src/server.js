require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const app = require("./app");
const prisma = require("./config/prisma");
const env = require("./config/env");
const { userCanAccessRoomById } = require("./lib/chatRoomAccess");

const PORT = Number(env.PORT || 5000);
const server = http.createServer(app);
const { getSocketIoCorsOrigin } = require("./lib/corsConfig");

const io = new Server(server, {
  cors: {
    origin: getSocketIoCorsOrigin(env),
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return next(new Error("Unauthorized"));
    socket.user = user;
    next();
  } catch (e) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("join_room", async ({ roomId }) => {
    const ok = await userCanAccessRoomById(socket.user.id, roomId);
    if (!ok) return;
    socket.join(roomId);
  });

  socket.on("send_message", async ({ roomId, content }) => {
    if (!content || !roomId) return;
    const ok = await userCanAccessRoomById(socket.user.id, roomId);
    if (!ok) return;

    const message = await prisma.message.create({
      data: {
        roomId,
        senderId: socket.user.id,
        content,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    io.to(roomId).emit("new_message", message);
  });
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  const ollama = env.OLLAMA_BASE_URL?.trim();
  if (ollama) {
    console.log(`LLM: Ollama → ${ollama.replace(/\/$/, "")}`);
  } else if (env.OPENAI_API_KEY) {
    console.log("LLM: OpenAI");
  } else {
    console.log("LLM: not configured (set OLLAMA_BASE_URL or OPENAI_API_KEY for /ai features)");
  }
});
