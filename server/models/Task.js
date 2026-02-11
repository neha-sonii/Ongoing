import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    color: { type: String, default: "sage" },
    rolloverCount: { type: Number, default: 0 },
    decisionStatus: { type: String, default: null },
    decisionStatusDate: { type: String, default: null },
    killed: { type: Boolean, default: false },
    killedAt: { type: Date, default: null },
    killReason: { type: String, default: "" },
    killNote: { type: String, default: "" },
    day: {
      type: String,
      default: () => new Date().toISOString().split("T")[0]
    }
  },
  { timestamps: true }
);

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);
export default Task;
