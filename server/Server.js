import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Task from "./models/Task.js";
import Note from "./models/Note.js";
import dotenv from "dotenv";

dotenv.config();



const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

const getToday = () => new Date().toISOString().split("T")[0];

app.get("/tasks", async (req, res) => {
  const view = req.query.view || "today";
  const today = getToday();

  if (view === "today") {
    await Task.updateMany(
      { completed: false, killed: { $ne: true }, day: { $lt: today } },
      { $set: { day: today }, $inc: { rolloverCount: 1 } }
    );
    const tasks = await Task.find({ day: today, killed: { $ne: true } }).sort({
      createdAt: -1
    });
    res.json(tasks);
    return;
  }

  if (view === "history") {
    const tasks = await Task.find({
      $or: [{ completed: true, day: { $lt: today } }, { killed: true }]
    }).sort({ killedAt: -1, completedAt: -1, createdAt: -1 });
    res.json(tasks);
    return;
  }

  const tasks = await Task.find().sort({ createdAt: -1 });
  res.json(tasks);
});

app.post("/tasks", async (req, res) => {
  const { text, color, day } = req.body;
  const task = await Task.create({
    text,
    color: color || "sage",
    day: day || getToday(),
    rolloverCount: 0
  });
  res.status(201).json(task);
});

app.patch("/tasks/:id", async (req, res) => {
  const updates = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(updates, "completed")) {
    updates.completedAt = updates.completed ? new Date() : null;
  }
  const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json(task);
});

app.patch("/tasks", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Task id is required." });
    return;
  }
  const today = getToday();
  const action = req.body?.action;

  if (action === "do_today") {
    const task = await Task.findByIdAndUpdate(
      id,
      { decisionStatus: "do_today", decisionStatusDate: today },
      { new: true }
    );
    res.json(task);
    return;
  }

  if (action === "rescope") {
    const task = await Task.findById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
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
    res.json({ updated: task, created });
    return;
  }

  if (action === "kill") {
    const reason = String(req.body?.reason || "").trim();
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
        killNote: String(req.body?.note || "").trim(),
        decisionStatus: "kill",
        decisionStatusDate: today,
        completed: false,
        completedAt: null
      },
      { new: true }
    );
    res.json(task);
    return;
  }

  const updates = { ...req.body };
  delete updates.id;
  delete updates.action;
  if (Object.prototype.hasOwnProperty.call(updates, "completed")) {
    updates.completedAt = updates.completed ? new Date() : null;
  }
  const task = await Task.findByIdAndUpdate(id, updates, { new: true });
  res.json(task);
});

app.delete("/tasks/:id", async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.delete("/tasks", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Task id is required." });
    return;
  }
  await Task.findByIdAndDelete(id);
  res.json({ ok: true });
});

app.get("/notes", async (req, res) => {
  const notes = await Note.find().sort({ updatedAt: -1, createdAt: -1 });
  res.json(notes);
});

app.post("/notes", async (req, res) => {
  const { title, text, color } = req.body;
  const note = await Note.create({ title: title || "", text, color: color || "mist" });
  res.status(201).json(note);
});

app.patch("/notes/:id", async (req, res) => {
  const note = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(note);
});

app.patch("/notes", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Note id is required." });
    return;
  }
  const updates = { ...req.body };
  delete updates.id;
  const note = await Note.findByIdAndUpdate(id, updates, { new: true });
  res.json(note);
});

app.delete("/notes/:id", async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

app.delete("/notes", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Note id is required." });
    return;
  }
  await Note.findByIdAndDelete(id);
  res.json({ ok: true });
});

app.listen(5000, () => console.log("Server running on port 5000"));
