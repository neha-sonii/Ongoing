import { connectDB } from "./_db.js";
import Note from "../server/models/Note.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  await connectDB();

  if (req.method === "GET") {
    const notes = await Note.find().sort({ updatedAt: -1, createdAt: -1 });
    res.status(200).json(notes);
    return;
  }

  if (req.method === "POST") {
    const { title, text, color } = req.body || {};
    if (!text) {
      res.status(400).json({ error: "Text is required." });
      return;
    }
    const note = await Note.create({
      title: title || "",
      text,
      color: color || "mist"
    });
    res.status(201).json(note);
    return;
  }

  if (req.method === "PATCH") {
    const id = req.query.id || (req.body || {}).id;
    if (!id) {
      res.status(400).json({ error: "Note id is required." });
      return;
    }
    const updates = { ...(req.body || {}) };
    delete updates.id;
    const note = await Note.findByIdAndUpdate(id, updates, { new: true });
    if (!note) {
      res.status(404).json({ error: "Note not found." });
      return;
    }
    res.status(200).json(note);
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id || (req.body || {}).id;
    if (!id) {
      res.status(400).json({ error: "Note id is required." });
      return;
    }
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
