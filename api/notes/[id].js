import { connectDB } from "../_db.js";
import Note from "../../server/models/Note.js";

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
    const note = await Note.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
    if (!note) {
      res.status(404).json({ error: "Note not found." });
      return;
    }
    res.status(200).json(note);
    return;
  }

  if (req.method === "DELETE") {
    const note = await Note.findOneAndDelete({ _id: id, userId });
    if (!note) {
      res.status(404).json({ error: "Note not found." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
