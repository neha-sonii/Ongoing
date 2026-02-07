import { connectDB } from "./_db.js";
import Task from "../server/models/Task.js";

const getToday = () => new Date().toISOString().split("T")[0];

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
    const view = req.query.view || "today";
    const today = getToday();

    if (view === "today") {
      await Task.updateMany(
        { completed: false, day: { $lt: today } },
        { $set: { day: today } }
      );
      const tasks = await Task.find({ day: today }).sort({ createdAt: -1 });
      res.status(200).json(tasks);
      return;
    }

    if (view === "history") {
      const tasks = await Task.find({ completed: true, day: { $lt: today } }).sort({
        completedAt: -1
      });
      res.status(200).json(tasks);
      return;
    }

    const tasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json(tasks);
    return;
  }

  if (req.method === "POST") {
    const { text, color, day } = req.body || {};
    if (!text) {
      res.status(400).json({ error: "Text is required." });
      return;
    }
    const task = await Task.create({
      text,
      color: color || "mist",
      day: day || getToday()
    });
    res.status(201).json(task);
    return;
  }

  if (req.method === "PATCH") {
    const id = req.query.id || (req.body || {}).id;
    if (!id) {
      res.status(400).json({ error: "Task id is required." });
      return;
    }
    const updates = { ...(req.body || {}) };
    delete updates.id;
    if (Object.prototype.hasOwnProperty.call(updates, "completed")) {
      updates.completedAt = updates.completed ? new Date() : null;
    }
    const task = await Task.findByIdAndUpdate(id, updates, { new: true });
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    res.status(200).json(task);
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id || (req.body || {}).id;
    if (!id) {
      res.status(400).json({ error: "Task id is required." });
      return;
    }
    const task = await Task.findByIdAndDelete(id);
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
}
