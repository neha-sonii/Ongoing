import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "./api";

const COLORS = [
  { id: "mist", label: "Mist", className: "dot-mist" },
  { id: "sage", label: "Sage", className: "dot-sage" },
  { id: "blush", label: "Blush", className: "dot-blush" },
  { id: "sand", label: "Sand", className: "dot-sand" },
  { id: "sky", label: "Sky", className: "dot-sky" }
];

const getToday = () => new Date().toISOString().split("T")[0];

const formatShortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatDisplayDate = () => {
  const date = new Date();
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  return `${weekday}, ${month} ${day}`;
};

const createTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(() => {
    if (location.pathname === "/notes") return "notes";
    if (location.pathname === "/history") return "history";
    return "today";
  }, [location.pathname]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [taskInput, setTaskInput] = useState("");
  const [noteTitleInput, setNoteTitleInput] = useState("");
  const [noteBodyInput, setNoteBodyInput] = useState("");
  const [taskColor, setTaskColor] = useState("mist");
  const [noteColor, setNoteColor] = useState("mist");

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [editingTaskColor, setEditingTaskColor] = useState("mist");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState("");
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [editingNoteColor, setEditingNoteColor] = useState("mist");

  const isToday = tab === "today";
  const isNotes = tab === "notes";
  const isHistory = tab === "history";

  const tabLabel = useMemo(() => {
    if (isNotes) return "Notes";
    if (isHistory) return "History";
    return "Today";
  }, [isNotes, isHistory]);

  const displayDate = useMemo(() => formatDisplayDate(), []);
  const unfinishedCount = useMemo(() => {
    if (!Array.isArray(tasks)) {
      return 0;
    }
    return tasks.filter((task) => !task.completed).length;
  }, [tasks]);

  useEffect(() => {
    setEditingTaskId(null);
    setEditingNoteId(null);
    if (tab === "notes") {
      fetchNotes();
      return;
    }
    fetchTasks(tab);
  }, [tab]);

  const fetchTasks = async (view) => {
    setLoading(true);
    try {
      const res = await api.get("/tasks", { params: { view } });
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notes");
      setNotes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    const text = taskInput.trim();
    if (!text) return;
    const tempId = createTempId();
    const optimisticTask = {
      _id: tempId,
      text,
      color: taskColor,
      day: getToday(),
      completed: false,
      completedAt: null
    };
    if (isToday) {
      setTasks((prev) => [optimisticTask, ...prev]);
    }
    try {
      const res = await api.post("/tasks", {
        text,
        color: taskColor,
        day: getToday()
      });
      if (isToday) {
        setTasks((prev) =>
          prev.map((task) => (task._id === tempId ? res.data : task))
        );
      }
      setTaskInput("");
    } catch (err) {
      console.error(err);
      if (isToday) {
        setTasks((prev) => prev.filter((task) => task._id !== tempId));
      }
      setTaskInput(text);
    }
  };

  const addNote = async () => {
    const title = noteTitleInput.trim();
    const text = noteBodyInput.trim();
    if (!text) return;
    const tempId = createTempId();
    const optimisticNote = {
      _id: tempId,
      title,
      text,
      color: noteColor
    };
    if (isNotes) {
      setNotes((prev) => [optimisticNote, ...prev]);
    }
    try {
      const res = await api.post("/notes", {
        title,
        text,
        color: noteColor
      });
      if (isNotes) {
        setNotes((prev) =>
          prev.map((note) => (note._id === tempId ? res.data : note))
        );
      }
      setNoteTitleInput("");
      setNoteBodyInput("");
    } catch (err) {
      console.error(err);
      if (isNotes) {
        setNotes((prev) => prev.filter((note) => note._id !== tempId));
      }
      setNoteTitleInput(title);
      setNoteBodyInput(text);
    }
  };

  const applyTaskUpdate = (updated) => {
    setTasks((prev) => {
      const exists = prev.some((task) => task._id === updated._id);
      if (!exists) {
        return [...prev, updated];
      }
      return prev.map((task) => (task._id === updated._id ? updated : task));
    });
  };

  const toggleTask = async (task) => {
    try {
      const res = await api.patch("/tasks", {
        id: task._id,
        completed: !task.completed,
        day: task.completed ? getToday() : task.day
      });
      applyTaskUpdate(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const startTaskEdit = (task) => {
    setEditingTaskId(task._id);
    setEditingTaskText(task.text);
    setEditingTaskColor(task.color || "mist");
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditingTaskText("");
  };

  const saveTaskEdit = async () => {
    const text = editingTaskText.trim();
    if (!text) return;
    try {
      const res = await api.patch("/tasks", {
        id: editingTaskId,
        text,
        color: editingTaskColor
      });
      applyTaskUpdate(res.data);
      cancelTaskEdit();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete("/tasks", { params: { id: taskId } });
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    } catch (err) {
      console.error(err);
    }
  };

  const startNoteEdit = (note) => {
    setEditingNoteId(note._id);
    setEditingNoteTitle(note.title || "");
    setEditingNoteBody(note.text || "");
    setEditingNoteColor(note.color || "mist");
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setEditingNoteTitle("");
    setEditingNoteBody("");
  };

  const saveNoteEdit = async () => {
    const title = editingNoteTitle.trim();
    const text = editingNoteBody.trim();
    if (!text) return;
    try {
      const res = await api.patch("/notes", {
        id: editingNoteId,
        title,
        text,
        color: editingNoteColor
      });
      setNotes((prev) => prev.map((note) => (note._id === res.data._id ? res.data : note)));
      cancelNoteEdit();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await api.delete("/notes", { params: { id: noteId } });
      setNotes((prev) => prev.filter((note) => note._id !== noteId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page">
      <main className="hero">
        {isToday && (
          <header className="top">
            <div className="brand-block">
              <div className="brand-icon" aria-hidden="true">
                <img src="/logo1.png" alt="" />
              </div>
              <div>
                <div className="brand-name">Ongoing.</div>
                <div className="brand-tagline">Tasks roll forward. Notes stay timeless.</div>
              </div>
            </div>
            <div className="top-actions">
              <button className="pill-action" type="button" onClick={() => navigate("/notes")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="4" width="14" height="16" rx="2" />
                  <path d="M8 8h8M8 12h6" />
                </svg>
                Notes
                <svg className="pill-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <button className="pill-action" type="button" onClick={() => navigate("/history")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 8v5l3 2" />
                  <circle cx="12" cy="12" r="8" />
                </svg>
                History
              </button>
            </div>
          </header>
        )}

        <div className="today-row">
          <div>
            <h2 className="today-title">{tabLabel}</h2>
            <p className="today-subtitle">
              {isNotes
                ? "Notes live on their own timeline."
                : isHistory
                ? "Review what you have completed."
                : "Unfinished tasks automatically carry over to the next day."}
            </p>
          </div>
          {isToday ? (
            <div className="date-text">{displayDate}</div>
          ) : (
            <button className="pill-action" type="button" onClick={() => navigate("/")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 6l-6 6 6 6" />
              </svg>
              Today
            </button>
          )}
        </div>

        {isNotes ? (
          <>
            <div className="glass-card">
              <div className="card-label">Card Color</div>
              <div className="color-pill-row">
                {COLORS.map((color) => (
                  <button
                    key={color.id}
                    className={`color-pill ${noteColor === color.id ? "active" : ""}`}
                    type="button"
                    aria-pressed={noteColor === color.id}
                    onClick={() => setNoteColor(color.id)}
                  >
                    <span className={`color-pill-dot ${color.className}`} />
                    {color.label}
                  </button>
                ))}
              </div>
              <div className="input-stack">
                <input
                  className="input-field note-title-input"
                  placeholder="Title (optional)"
                  value={noteTitleInput}
                  onChange={(event) => setNoteTitleInput(event.target.value)}
                />
                <textarea
                  className="input-field note-body-input"
                  placeholder="Write a note..."
                  value={noteBodyInput}
                  onChange={(event) => setNoteBodyInput(event.target.value)}
                />
              </div>
              <div className="note-footer">
                <div className="meta-line">
                  <span className="meta-dot" /> Notes never show up in Today.
                </div>
                <button className="primary-btn" type="button" onClick={addNote}>
                  Add
                </button>
              </div>
            </div>

            <div className="list-card">
              {loading && <div className="empty-center">Loading notes...</div>}
              {!loading && notes.length === 0 && (
                <div className="empty-card empty-card--center">
                  <div>
                    <div className="empty-title">Nothing here yet.</div>
                    <div className="empty-subtitle">Add a note when something is worth keeping.</div>
                  </div>
                </div>
              )}
              {!loading &&
                notes.map((note) => (
                  <div className="note-card" key={note._id} data-color={note.color || "mist"}>
                    {editingNoteId === note._id ? (
                      <div className="edit-row">
                        <input
                          className="input-field note-title-input"
                          value={editingNoteTitle}
                          onChange={(event) => setEditingNoteTitle(event.target.value)}
                          placeholder="Title (optional)"
                        />
                        <textarea
                          className="input-field note-body-input"
                          value={editingNoteBody}
                          onChange={(event) => setEditingNoteBody(event.target.value)}
                          placeholder="Write a note..."
                        />
                        <div className="edit-actions">
                          <button className="pill-action" type="button" onClick={saveNoteEdit}>
                            Save
                          </button>
                          <button className="pill-action" type="button" onClick={cancelNoteEdit}>
                            Cancel
                          </button>
                        </div>
                        <div className="color-pill-row small" aria-label="Note color">
                          {COLORS.map((color) => (
                            <button
                              key={color.id}
                              className={`color-pill ${editingNoteColor === color.id ? "active" : ""}`}
                              type="button"
                              aria-pressed={editingNoteColor === color.id}
                              onClick={() => setEditingNoteColor(color.id)}
                            >
                              <span className={`color-pill-dot ${color.className}`} />
                              {color.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="note-header">
                          <div className="note-title">{note.title?.trim() || "Untitled"}</div>
                          <div className="task-actions">
                            <button
                              className="icon-btn edit"
                              type="button"
                              aria-label="Edit note"
                              onClick={() => startNoteEdit(note)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z" />
                              </svg>
                            </button>
                            <button
                              className="icon-btn delete"
                              type="button"
                              aria-label="Delete note"
                              onClick={() => deleteNote(note._id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M6 6l1 14h10l1-14" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="note-body">{note.text}</div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </>
        ) : (
          <>
            {!isHistory && (
              <div className="glass-card">
                <div className="card-label">Card Color</div>
                <div className="color-pill-row">
                  {COLORS.map((color) => (
                    <button
                      key={color.id}
                      className={`color-pill ${taskColor === color.id ? "active" : ""}`}
                      type="button"
                      aria-pressed={taskColor === color.id}
                      onClick={() => setTaskColor(color.id)}
                    >
                      <span className={`color-pill-dot ${color.className}`} />
                      {color.label}
                    </button>
                  ))}
                </div>
                <div className="input-row">
                  <input
                    className="input-field"
                    placeholder="Add a task..."
                    value={taskInput}
                    onChange={(event) => setTaskInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addTask();
                      }
                    }}
                  />
                  <button className="primary-btn" type="button" onClick={addTask}>
                    Add
                  </button>
                </div>
                <div className="meta-line">
                  <span className="meta-dot" /> {unfinishedCount} unfinished tasks in Today.
                </div>
              </div>
            )}

            <div className="list-card">
              {loading && <div className="empty-center">Loading tasks...</div>}
              {!loading && tasks.length === 0 && isToday && (
                <div className="empty-card">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="5" y="4" width="10" height="14" rx="2" />
                      <path d="M8 8h4M8 11h4" />
                      <path d="M15.5 7.5l4 4" />
                      <path d="M14 9l-3.5 3.5V15h2.5L16.5 11.5" />
                    </svg>
                  </div>
                  <div>
                    <div className="empty-title">A clean start.</div>
                    <div className="empty-subtitle">Add a task, pick a soft card color, and keep moving.</div>
                  </div>
                </div>
              )}
              {!loading && tasks.length === 0 && isHistory && (
                <div className="empty-center">
                  <div className="empty-title">Nothing here yet.</div>
                  <div className="empty-subtitle">Completed tasks will appear here tomorrow.</div>
                </div>
              )}
              {!loading && tasks.length > 0 && (
                <div className="task-list">
                  {tasks.map((task) => (
                    <div
                      className={`task-row ${task.completed ? "done" : ""}`}
                      key={task._id}
                      data-color={task.color || "mist"}
                    >
                      {isHistory ? (
                        <div className="task-left">
                          <span className="task-text">{task.text}</span>
                          {task.completedAt && (
                            <span className="pill-meta">Completed {formatShortDate(task.completedAt)}</span>
                          )}
                        </div>
                      ) : editingTaskId === task._id ? (
                        <div className="edit-row">
                          <input
                            className="input-field"
                            value={editingTaskText}
                            onChange={(event) => setEditingTaskText(event.target.value)}
                          />
                          <div className="edit-actions">
                            <button className="pill-action" type="button" onClick={saveTaskEdit}>
                              Save
                            </button>
                            <button className="pill-action" type="button" onClick={cancelTaskEdit}>
                              Cancel
                            </button>
                          </div>
                          <div className="color-pill-row small" aria-label="Task color">
                            {COLORS.map((color) => (
                              <button
                                key={color.id}
                                className={`color-pill ${editingTaskColor === color.id ? "active" : ""}`}
                                type="button"
                                aria-pressed={editingTaskColor === color.id}
                                onClick={() => setEditingTaskColor(color.id)}
                              >
                                <span className={`color-pill-dot ${color.className}`} />
                                {color.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="task-left">
                            <button
                              className={`task-check ${task.completed ? "active" : ""}`}
                              type="button"
                              aria-label={task.completed ? "Restore task" : "Complete task"}
                              onClick={() => toggleTask(task)}
                            >
                              {task.completed && (
                                <svg
                                  viewBox="0 0 24 24"
                                  width="12"
                                  height="12"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                >
                                  <path d="M5 12l4 4 10-10" />
                                </svg>
                              )}
                            </button>
                            <span className="task-text">{task.text}</span>
                          </div>
                          <div className="task-actions">
                            <button
                              className="icon-btn edit"
                              type="button"
                              aria-label="Edit task"
                              onClick={() => startTaskEdit(task)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z" />
                              </svg>
                            </button>
                            <button
                              className="icon-btn delete"
                              type="button"
                              aria-label="Delete task"
                              onClick={() => deleteTask(task._id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M6 6l1 14h10l1-14" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="footer-row">
          <span>Built for calm follow-through.</span>
          <span className="footer-label">Ongoing. — {tabLabel}</span>
        </div>
      </main>
    </div>
  );
}
