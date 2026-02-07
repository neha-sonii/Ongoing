import { connectDB } from "../_db.js";
import Note from "../../server/models/Note.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  await connectDB();

  const { id } = req.query;

  if (req.method === "PATCH") {
    const updates = { ...(req.body || {}) };
    const note = await Note.findByIdAndUpdate(id, updates, { new: true });
    if (!note) {
      res.status(404).json({ error: "Note not found." });
      return;
    }
    res.status(200).json(note);
    return;
  }

  if (req.method === "DELETE") {
    const note = await Note.findByIdAndDelete(id);
    if (!note) {
      res.status(404).json({ error: "Note not found." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
