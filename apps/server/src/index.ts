import cors from "cors";
import express from "express";
import { roomsRouter } from "./routes/rooms.js";

const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN;

const app = express();
app.use(cors({ origin: WEB_ORIGIN || true }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/rooms", roomsRouter);

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
