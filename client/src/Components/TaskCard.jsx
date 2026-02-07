export default function TaskCard({ task, onToggle }) {
  return (
    <div className="backdrop-glass p-4 flex justify-between items-center shadow-xl">
      <span
        className={`${
          task.status === "done"
            ? "line-through text-gray-400"
            : "text-white font-medium"
        }`}
      >
        {task.title}
      </span>

      <button
        onClick={() => onToggle(task._id)}
        className="px-3 py-1 rounded-lg bg-purple-500/80 text-white"
      >
        {task.status === "done" ? "Undo" : "Done"}
      </button>
    </div>
  );
}
