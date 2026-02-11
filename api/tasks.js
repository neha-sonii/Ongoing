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
        { completed: false, killed: { $ne: true }, day: { $lt: today } },
        { $set: { day: today }, $inc: { rolloverCount: 1 } }
      );
      const tasks = await Task.find({ day: today, killed: { $ne: true } }).sort({ createdAt: -1 });
      res.status(200).json(tasks);
      return;
    }

    if (view === "history") {
      const tasks = await Task.find({
        $or: [{ completed: true, day: { $lt: today } }, { killed: true }]
      }).sort({ killedAt: -1, completedAt: -1, createdAt: -1 });
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
    const body = req.body || {};
    const id = req.query.id || body.id;
    if (!id) {
      res.status(400).json({ error: "Task id is required." });
      return;
    }
    const today = getToday();
    const action = body.action;

    if (action === "do_today") {
      const task = await Task.findByIdAndUpdate(
        id,
        { decisionStatus: "do_today", decisionStatusDate: today },
        { new: true }
      );
      if (!task) {
        res.status(404).json({ error: "Task not found." });
        return;
      }
      res.status(200).json(task);
      return;
    }

    if (action === "rescope") {
      const task = await Task.findById(id);
      if (!task) {
        res.status(404).json({ error: "Task not found." });
        return;
      }
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const cleaned = entries.map((item) => String(item || "").trim()).filter(Boolean);
      if (cleaned.length === 0) {
        res.status(400).json({ error: "Rescope entries are required." });
        return;
      }
      const [first, ...rest] = cleaned;
      const now = new Date();
      task.text = first;
      task.createdAt = now;
      task.updatedAt = now;
      task.day = today;
      task.rolloverCount = 0;
      task.completed = false;
      task.completedAt = null;
      task.killed = false;
      task.killedAt = null;
      task.killReason = "";
      task.killNote = "";
      task.decisionStatus = "rescope";
      task.decisionStatusDate = today;
      await task.save();

      const created = rest.length
        ? await Task.insertMany(
            rest.map((text) => ({
              text,
              color: task.color || "mist",
              day: today,
              rolloverCount: 0
            }))
          )
        : [];
      res.status(200).json({ updated: task, created });
      return;
    }

    if (action === "kill") {
      const reason = String(body.reason || "").trim();
      if (!reason) {
        res.status(400).json({ error: "Kill reason is required." });
        return;
      }
      const task = await Task.findByIdAndUpdate(
        id,
        {
          killed: true,
          killedAt: new Date(),
          killReason: reason,
          killNote: String(body.note || "").trim(),
          decisionStatus: "kill",
          decisionStatusDate: today,
          completed: false,
          completedAt: null
        },
        { new: true }
      );
      if (!task) {
        res.status(404).json({ error: "Task not found." });
        return;
      }
      res.status(200).json(task);
      return;
    }

    const updates = { ...body };
    delete updates.id;
    delete updates.action;
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
