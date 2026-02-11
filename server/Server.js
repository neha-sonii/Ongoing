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

const getUserId = (req) => req.header("x-user-id") || req.body?.userId || req.query?.userId;

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

const getToday = () => new Date().toISOString().split("T")[0];

app.get("/tasks", async (req, res) => {
  const view = req.query.view || "today";
  const today = getToday();
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }

  if (view === "today") {
    await Task.updateMany(
      { userId, completed: false, killed: { $ne: true }, day: { $lt: today } },
      { $set: { day: today }, $inc: { rolloverCount: 1 } }
    );
    const tasks = await Task.find({ userId, day: today, killed: { $ne: true } }).sort({
      createdAt: -1
    });
    res.json(tasks);
    return;
  }

  if (view === "history") {
    const tasks = await Task.find({
      userId,
      $or: [{ completed: true, day: { $lt: today } }, { killed: true }]
    }).sort({ killedAt: -1, completedAt: -1, createdAt: -1 });
    res.json(tasks);
    return;
  }

  const tasks = await Task.find({ userId }).sort({ createdAt: -1 });
  res.json(tasks);
});

app.post("/tasks", async (req, res) => {
  const { text, color, day } = req.body;
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const task = await Task.create({
    userId,
    text,
    color: color || "sage",
    day: day || getToday(),
    rolloverCount: 0
  });
  res.status(201).json(task);
});

app.patch("/tasks/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const updates = { ...req.body };
  if (Object.prototype.hasOwnProperty.call(updates, "completed")) {
    updates.completedAt = updates.completed ? new Date() : null;
  }
  const task = await Task.findOneAndUpdate({ _id: req.params.id, userId }, updates, { new: true });
  res.json(task);
});

app.patch("/tasks", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Task id is required." });
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const today = getToday();
  const action = req.body?.action;

  if (action === "do_today") {
    const task = await Task.findOneAndUpdate(
      { _id: id, userId },
      { decisionStatus: "do_today", decisionStatusDate: today },
      { new: true }
    );
    res.json(task);
    return;
  }

  if (action === "rescope") {
    const task = await Task.findOne({ _id: id, userId });
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
            userId,
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
    const task = await Task.findOneAndUpdate(
      { _id: id, userId },
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
  const task = await Task.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
  res.json(task);
});

app.delete("/tasks/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  await Task.findOneAndDelete({ _id: req.params.id, userId });
  res.json({ ok: true });
});

app.delete("/tasks", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Task id is required." });
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  await Task.findOneAndDelete({ _id: id, userId });
  res.json({ ok: true });
});

app.get("/notes", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const notes = await Note.find({ userId }).sort({ updatedAt: -1, createdAt: -1 });
  res.json(notes);
});

app.post("/notes", async (req, res) => {
  const { title, text, color } = req.body;
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const note = await Note.create({
    userId,
    title: title || "",
    text,
    color: color || "mist"
  });
  res.status(201).json(note);
});

app.patch("/notes/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const note = await Note.findOneAndUpdate({ _id: req.params.id, userId }, req.body, {
    new: true
  });
  res.json(note);
});

app.patch("/notes", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Note id is required." });
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  const updates = { ...req.body };
  delete updates.id;
  const note = await Note.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
  res.json(note);
});

app.delete("/notes/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  await Note.findOneAndDelete({ _id: req.params.id, userId });
  res.json({ ok: true });
});

app.delete("/notes", async (req, res) => {
  const id = req.query.id || req.body?.id;
  if (!id) {
    res.status(400).json({ error: "Note id is required." });
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    res.status(400).json({ error: "Missing user id." });
    return;
  }
  await Note.findOneAndDelete({ _id: id, userId });
  res.json({ ok: true });
});

app.listen(5000, () => console.log("Server running on port 5000"));
