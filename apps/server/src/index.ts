import cors from "cors";
import express from "express";
import { roomsRouter } from "./routes/rooms.js";

const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const app = express();
app.use(cors({ origin: WEB_ORIGIN ? WEB_ORIGIN : LOCAL_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/rooms", roomsRouter);

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
