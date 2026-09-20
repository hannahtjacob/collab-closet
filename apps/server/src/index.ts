import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { normalizeCode } from "./services/roomService.js";
import { getRoomByCode, updateRoomClosets, upsertRoomUser, usersForRoomCode } from "./services/database.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./types.js";
import { roomsRouter } from "./routes/rooms.js";

const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN;

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: WEB_ORIGIN || true },
});

app.use(cors({ origin: WEB_ORIGIN || true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/rooms", roomsRouter);

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomCode, user }) => {
    const code = normalizeCode(roomCode);
    const room = getRoomByCode(code);
    if (!room || !user?.id || !user.name?.trim()) {
      socket.emit("room:error", "That room or user is not available.");
      return;
    }

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.userId = user.id;
    upsertRoomUser(room.id, { id: user.id, name: user.name.trim().slice(0, 40) }, true);
    io.to(code).emit("presence:update", usersForRoomCode(code));
    socket.emit("room:state", getRoomByCode(code)!);
  });

  socket.on("room:update", ({ roomCode, state, userId }) => {
    const code = normalizeCode(roomCode);
    if (socket.data.roomCode !== code || socket.data.userId !== userId || !getRoomByCode(code)) return;
    updateRoomClosets(code, state.closets);
    socket.to(code).emit("room:state", getRoomByCode(code)!);
  });

  socket.on("room:leave", ({ roomCode, userId }) => {
    const code = normalizeCode(roomCode);
    const room = getRoomByCode(code);
    if (!room || socket.data.roomCode !== code || socket.data.userId !== userId) return;
    upsertRoomUser(room.id, { id: userId, name: room.users.find((candidate) => candidate.id === userId)?.name || "Guest" }, false);
    socket.leave(code);
    io.to(code).emit("presence:update", usersForRoomCode(code));
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode as string | undefined;
    const userId = socket.data.userId as string | undefined;
    if (!code || !userId) return;
    const room = getRoomByCode(code);
    if (!room) return;
    upsertRoomUser(room.id, { id: userId, name: room.users.find((candidate) => candidate.id === userId)?.name || "Guest" }, false);
    io.to(code).emit("presence:update", usersForRoomCode(code));
  });
});

httpServer.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
