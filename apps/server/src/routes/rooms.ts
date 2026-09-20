import { Router } from "express";
import { createRoom, getRoomByCode } from "../services/roomService.js";

export const roomsRouter = Router();

roomsRouter.post("/", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
  if (!name) {
    res.status(400).json({ error: "Room name is required." });
    return;
  }
  res.status(201).json(createRoom(name));
});

roomsRouter.get("/:code", (req, res) => {
  const room = getRoomByCode(req.params.code);
  if (!room) {
    res.status(404).json({ error: "No room with that code." });
    return;
  }
  res.json(room);
});
