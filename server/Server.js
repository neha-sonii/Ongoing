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
      { completed: false, day: { $lt: today } },
      { $set: { day: today } }
    );
    const tasks = await Task.find({ day: today }).sort({
      createdAt: -1
    });
    res.json(tasks);
    return;
  }

  if (view === "history") {
    const tasks = await Task.find({ completed: true, day: { $lt: today } }).sort({
      completedAt: -1
    });
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
    day: day || getToday()
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
  const updates = { ...req.body };
  delete updates.id;
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
