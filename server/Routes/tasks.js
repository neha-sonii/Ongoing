import express from "express";
import Task from "../models/Task.js";

const router = express.Router();

// Get tasks
router.get("/:userId", async (req, res) => {
  const tasks = await Task.find({ userId: req.params.userId });
  res.json(tasks);
});

// Add task
router.post("/", async (req, res) => {
  const task = new Task(req.body);
  await task.save();
  res.json(task);
});

// Toggle status
router.patch("/:id", async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(task);
});

// Auto rollover
router.post("/rollover/:userId", async (req, res) => {
  const today = new Date();
  const tasks = await Task.find({ userId: req.params.userId, status: "pending" });
  for (let task of tasks) {
    task.dateCreated = today;
    await task.save();
  }
  res.json({ rolledOver: tasks.length });
});

export default router;
