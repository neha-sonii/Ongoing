import { connectDB } from "../_db.js";
import Task from "../../server/models/Task.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  await connectDB();

  const { id } = req.query;
  const userId = req.headers["x-user-id"] || req.query.userId || (req.body || {}).userId;
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }

  if (req.method === "PATCH") {
    const updates = { ...(req.body || {}) };
    if (Object.prototype.hasOwnProperty.call(updates, "completed")) {
      updates.completedAt = updates.completed ? new Date() : null;
    }
    const task = await Task.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    res.status(200).json(task);
    return;
  }

  if (req.method === "DELETE") {
    const task = await Task.findOneAndDelete({ _id: id, userId });
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
