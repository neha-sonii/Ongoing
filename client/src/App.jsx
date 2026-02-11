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

const DECISION_THRESHOLD = 5;

const Tooltip = ({ text, children, className = "" }) => (
  <span className={`tooltip ${className}`} tabIndex={0}>
    {children}
    <span className="tooltip-bubble" role="tooltip">{text}</span>
  </span>
);

const getToday = () => new Date().toISOString().split("T")[0];

const getUtcStart = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const diffDaysUtc = (from, to) => Math.floor((getUtcStart(to) - getUtcStart(from)) / 86400000);

const getAgeDays = (createdAt, asOf = new Date()) => {
  if (!createdAt) return 1;
  const days = diffDaysUtc(new Date(createdAt), asOf) + 1;
  return Math.max(1, days);
};

const getEffectiveRollover = (task, ageDays) =>
  Math.max(task?.rolloverCount || 0, Math.max(0, ageDays - 1));

const getRelativeKey = (offsetDays) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().split("T")[0];
};

const formatDayLabel = (ageDays) => `Day ${ageDays}`;

const getDelayDays = (task) => {
  if (!task?.createdAt) return 0;
  const end = task.completedAt || task.killedAt;
  if (!end) return 0;
  return Math.max(0, diffDaysUtc(new Date(task.createdAt), new Date(end)));
};

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

  const [decisionMode, setDecisionMode] = useState(null);
  const [rescopeInput, setRescopeInput] = useState("");

  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [introOpen, setIntroOpen] = useState(false);

  const todayKey = getRelativeKey(0);
  const yesterdayKey = getRelativeKey(-1);

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
    return tasks.filter((task) => !task.completed && !task.killed).length;
  }, [tasks]);

  const isTaskDecisionRequired = (task) => {
    if (!task || task.completed || task.killed) return false;
    const ageDays = getAgeDays(task.createdAt);
    if (ageDays < DECISION_THRESHOLD) return false;
    if (task.decisionStatus === "do_today" && task.decisionStatusDate === todayKey) {
      return false;
    }
    return true;
  };

  const decisionTasks = useMemo(() => {
    if (!isToday) return [];
    return tasks
      .filter(isTaskDecisionRequired)
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  }, [tasks, isToday, todayKey]);

  const decisionTask = decisionTasks[0] || null;
  const decisionLocked = Boolean(decisionTask);
  const decisionAgeDays = decisionTask ? getAgeDays(decisionTask.createdAt) : 1;
  const decisionRollover = decisionTask
    ? getEffectiveRollover(decisionTask, decisionAgeDays)
    : 0;

  const taskDebt = useMemo(() => {
    if (!isToday) return 0;
    let total = 0;
    tasks.forEach((task) => {
      if (task.completed || task.killed) return;
      const ageDays = getAgeDays(task.createdAt);
      if (ageDays >= 5) total += 1;
    });
    return total;
  }, [tasks, isToday]);

  const historyStats = useMemo(() => {
    if (!isHistory) return null;
    const completed = tasks.filter((task) => task.completed);
    const killed = tasks.filter((task) => task.killed);
    const finished = [...completed, ...killed];
    const completedLate = finished.filter((task) => getDelayDays(task) > 0);
    const writingTasks = finished.filter((task) =>
      /write|writing|draft|journal|blog/i.test(task.text || "")
    );
    const writingDelay =
      writingTasks.length === 0
        ? null
        : writingTasks.reduce((sum, task) => sum + getDelayDays(task), 0) / writingTasks.length;
    return {
      completedLateCount: completedLate.length,
      killedCount: killed.length,
      writingDelay
    };
  }, [tasks, isHistory]);

  const displayTasks = useMemo(() => {
    if (!isHistory) return tasks;
    return [...tasks].sort((a, b) => {
      const aDate = new Date(a.killedAt || a.completedAt || a.updatedAt || a.createdAt || 0);
      const bDate = new Date(b.killedAt || b.completedAt || b.updatedAt || b.createdAt || 0);
      return bDate - aDate;
    });
  }, [tasks, isHistory]);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("ongoing_intro_seen");
      if (!seen) setIntroOpen(true);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    setEditingTaskId(null);
    setEditingNoteId(null);
    if (tab === "notes") {
      fetchNotes();
      return;
    }
    fetchTasks(tab);
  }, [tab]);

  useEffect(() => {
    if (!decisionTask) return;
    setDecisionMode(null);
    setRescopeInput(decisionTask.text || "");
  }, [decisionTask?._id]);

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
    if (decisionLocked) return;
    const tempId = createTempId();
    const now = new Date().toISOString();
    const optimisticTask = {
      _id: tempId,
      text,
      color: taskColor,
      day: getToday(),
      createdAt: now,
      rolloverCount: 0,
      decisionStatus: null,
      decisionStatusDate: null,
      killed: false,
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
    if (decisionLocked) return;
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
    if (decisionLocked) return;
    setEditingTaskId(task._id);
    setEditingTaskText(task.text);
    setEditingTaskColor(task.color || "mist");
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditingTaskText("");
  };

  const saveTaskEdit = async () => {
    if (decisionLocked) return;
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

  const openConfirmDialog = (dialog) => {
    setConfirmReason("");
    setConfirmNote("");
    setConfirmDialog(dialog);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const performDeleteTask = async (taskId) => {
    try {
      await api.delete("/tasks", { params: { id: taskId } });
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    } catch (err) {
      console.error(err);
    }
  };

  const performKillTask = async ({ taskId, reason, note }) => {
    try {
      await api.patch("/tasks", {
        id: taskId,
        action: "kill",
        reason,
        note: note || ""
      });
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    } catch (err) {
      console.error(err);
    }
  };

  const requestDeleteTask = (task) => {
    if (decisionLocked) return;
    const ageDays = getAgeDays(task.createdAt);
    if (ageDays >= DECISION_THRESHOLD) {
      openConfirmDialog({ type: "kill-task", task });
      return;
    }
    openConfirmDialog({ type: "remove-task", task });
  };


  const handleDoToday = async () => {
    if (!decisionTask) return;
    try {
      const res = await api.patch("/tasks", {
        id: decisionTask._id,
        action: "do_today"
      });
      applyTaskUpdate(res.data);
      setDecisionMode(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRescope = async () => {
    if (!decisionTask) return;
    const entries = rescopeInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (entries.length === 0) return;
    try {
      const res = await api.patch("/tasks", {
        id: decisionTask._id,
        action: "rescope",
        entries
      });
      const created = Array.isArray(res.data?.created) ? res.data.created : [];
      const updated = res.data?.updated || res.data;
      setTasks((prev) => {
        const rest = prev.filter((task) => task._id !== decisionTask._id);
        const next = [];
        if (updated) next.push(updated);
        if (created.length) next.push(...created);
        next.push(...rest);
        return next;
      });
      setDecisionMode(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleKillTask = async () => {
    if (!decisionTask) return;
    openConfirmDialog({ type: "decision-kill", task: decisionTask });
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

  const performDeleteNote = async (noteId) => {
    try {
      await api.delete("/notes", { params: { id: noteId } });
      setNotes((prev) => prev.filter((note) => note._id !== noteId));
    } catch (err) {
      console.error(err);
    }
  };

  const requestDeleteNote = (note) => {
    openConfirmDialog({ type: "delete-note", note });
  };


  return (
    <div className={`page ${decisionLocked ? "decision-lock" : ""}`}>
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
              <Tooltip
                text={`Task Debt is the count of tasks older than 5 days.
Each task adds +1 once.`}
                className="debt-tip"
              >
                <span className="debt-pill">
                  Task Debt <strong>{taskDebt}</strong>
                </span>
              </Tooltip>
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
                ? "Completed late, killed tasks, and delay patterns."
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
                              onClick={() => requestDeleteNote(note)}
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
                      disabled={decisionLocked}
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
                    disabled={decisionLocked}
                  />
                  <button className="primary-btn" type="button" onClick={addTask} disabled={decisionLocked}>
                    Add
                  </button>
                </div>
                <div className="meta-line">
                  <span className="meta-dot" />{" "}
                  {decisionLocked
                    ? "Decision required before adding new tasks."
                    : `${unfinishedCount} unfinished tasks in Today.`}
                </div>
              </div>
            )}

            {isToday && decisionTask && (
              <div className="decision-card">
                <div className="decision-head">
                  <div>
                    <div className="decision-label">Decision Required</div>
                    <div className="decision-title">{decisionTask.text}</div>
                    <div className="decision-meta">
                      <Tooltip text={`This task has existed for ${decisionAgeDays} days without being finished.`}>
                        <span className="pill-meta warn">
                          {formatDayLabel(decisionAgeDays)}
                          <span className="info-icon">i</span>
                        </span>
                      </Tooltip>
                      {decisionRollover > 0 && (
                        <Tooltip
                          text={`This task has carried over to the next day ${decisionRollover} times.`}
                        >
                          <span className="pill-meta warn">Rolled {decisionRollover} times</span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <div className="decision-lock-note">Decide before adding new tasks.</div>
                </div>
                <div className="decision-actions">
                  <button className="pill-action" type="button" onClick={handleDoToday}>
                    Do Today
                  </button>
                  <button className="pill-action" type="button" onClick={() => setDecisionMode("rescope")}>
                    Rescope
                  </button>
                  <button
                    className="pill-action pill-action--danger"
                    type="button"
                    onClick={handleKillTask}
                  >
                    Kill Task
                  </button>
                </div>

                {decisionMode === "rescope" && (
                  <div className="decision-form">
                    <div className="decision-form-label">Rescope (one task per line)</div>
                    <textarea
                      className="input-field decision-textarea"
                      value={rescopeInput}
                      onChange={(event) => setRescopeInput(event.target.value)}
                      placeholder="Rewrite the task or split into multiple lines..."
                    />
                    <div className="decision-form-actions">
                      <button className="primary-btn" type="button" onClick={handleRescope}>
                        Apply Rescope
                      </button>
                      <button className="pill-action" type="button" onClick={() => setDecisionMode(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {isHistory && historyStats && (
              <div className="glass-card history-summary">
                <div className="summary-grid">
                  <div className="summary-item">
                    <Tooltip text="Finished after multiple days of delay."><span className="summary-label">Completed late</span></Tooltip>
                    <div className="summary-value">{historyStats.completedLateCount}</div>
                  </div>
                  <div className="summary-item">
                    <Tooltip text="Killed means the task was consciously removed with a reason."><span className="summary-label">Killed tasks</span></Tooltip>
                    <div className="summary-value">{historyStats.killedCount}</div>
                  </div>
                </div>
                {historyStats.writingDelay !== null && (
                  <div className="summary-note">
                    You usually delay writing-related tasks by{" "}
                    {historyStats.writingDelay.toFixed(1)} days.
                  </div>
                )}
              </div>
            )}

            <div className="list-card">
              {loading && <div className="empty-center">Loading tasks...</div>}
              {!loading && tasks.length === 0 && isToday && (
                <div className="empty-card">
                  <div className="empty-icon">
                    <img src="/note.png" alt="" width={24} height={24} />
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
              {!loading && displayTasks.length > 0 && (
                <div className="task-list">
                  {displayTasks.map((task) => {
                    const endDate = task.completedAt || task.killedAt || new Date();
                    const ageDays = getAgeDays(task.createdAt, isHistory ? endDate : new Date());
                    const rolloverCount = getEffectiveRollover(task, ageDays);
                    const isAged = ageDays >= 5;
                    const isDoToday =
                      task.decisionStatus === "do_today" && task.decisionStatusDate === todayKey;
                    const delayDays = getDelayDays(task);
                    const completedLate = delayDays > 0;

                    return (
                      <div
                        className={`task-row ${task.completed ? "done" : ""} ${isAged ? "aged" : ""} ${
                          isDoToday ? "highlight" : ""
                        }`}
                        key={task._id}
                        data-color={task.color || "mist"}
                      >
                        {isHistory ? (
                          <div className="task-left">
                            <div className="task-info">
                              <span className="task-text">{task.text}</span>
                              <div className="task-meta">
                                <Tooltip text={`This task has existed for ${ageDays} days without being finished.`}><span className="pill-meta task-age">{formatDayLabel(ageDays)}<span className="info-icon">i</span></span></Tooltip>
                                {rolloverCount > 0 && (
                                  <Tooltip text={`This task has carried over to the next day ${rolloverCount} times.`}><span className="pill-meta">Rolled {rolloverCount} times</span></Tooltip>
                                )}
                                {task.completedAt && (
                                  <span className="pill-meta">
                                    Completed {formatShortDate(task.completedAt)}
                                  </span>
                                )}
                                {completedLate && <Tooltip text="Finished after multiple days of delay."><span className="pill-meta warn">Completed late</span></Tooltip>}
                                {task.killed && <Tooltip text="Killed means the task was consciously removed with a reason."><span className="pill-meta warn">Killed</span></Tooltip>}
                              </div>
                              {task.killed && (
                                <div className="task-sub">
                                  Killed - {task.killReason || "No reason"}
                                  {task.killNote ? ` - ${task.killNote}` : ""}
                                </div>
                              )}
                            </div>
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
                                  disabled={decisionLocked}
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
                                disabled={decisionLocked}
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
                              <div className="task-info">
                                {decisionTask && task._id === decisionTask._id && (
                                  <div className="decision-inline">
                                    This task has been delayed too long and needs a decision.
                                  </div>
                                )}
                                <span className="task-text">{task.text}</span>
                                <div className="task-meta">
                                  <Tooltip text={`This task has existed for ${ageDays} days without being finished.`}><span className="pill-meta task-age">{formatDayLabel(ageDays)}<span className="info-icon">i</span></span></Tooltip>
                                  {rolloverCount > 0 && (
                                    <Tooltip text={`This task has carried over to the next day ${rolloverCount} times.`}><span className="pill-meta">Rolled {rolloverCount} times</span></Tooltip>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="task-actions">
                              <button
                                className="icon-btn edit"
                                type="button"
                                aria-label="Edit task"
                                onClick={() => startTaskEdit(task)}
                                disabled={decisionLocked}
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
                                onClick={() => requestDeleteTask(task)}
                                disabled={decisionLocked}
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
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {introOpen && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-title">Ongoing does not reset your day.</div>
              <div className="modal-text">
                Unfinished tasks stay visible until you deal with them.
              </div>
              <div className="modal-actions">
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem("ongoing_intro_seen", "true");
                    } catch (err) {
                      console.error(err);
                    }
                    setIntroOpen(false);
                  }}
                >
                  I understand
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDialog && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-title">
                {confirmDialog.type === "remove-task"
                  ? "Remove this task?"
                  : confirmDialog.type === "delete-note"
                  ? "Delete this note?"
                  : "Kill this task?"}
              </div>
              <div className="modal-text">
                {confirmDialog.type === "remove-task"
                  ? "This task will be removed from your ongoing work."
                  : confirmDialog.type === "delete-note"
                  ? "Notes are part of your thinking history."
                  : "Killing a task means intentionally letting it go, not ignoring it."}
              </div>

              {(confirmDialog.type === "kill-task" || confirmDialog.type === "decision-kill") && (
                <div className="modal-form">
                  <div className="decision-form-label">Reason (required)</div>
                  <select
                    className="input-field decision-select"
                    value={confirmReason}
                    onChange={(event) => setConfirmReason(event.target.value)}
                  >
                    <option value="">Select a reason</option>
                    <option value="No longer aligned">No longer aligned</option>
                    <option value="Scope changed">Scope changed</option>
                    <option value="Blocked without path">Blocked without path</option>
                    <option value="Handled elsewhere">Handled elsewhere</option>
                    <option value="Low impact">Low impact</option>
                    <option value="Waiting on external">Waiting on external</option>
                    <option value="Other">Other</option>
                  </select>
                  <textarea
                    className="input-field decision-textarea"
                    value={confirmNote}
                    onChange={(event) => setConfirmNote(event.target.value)}
                    placeholder="Optional note..."
                  />
                </div>
              )}

              <div className="modal-actions">
                <button
                  className={`primary-btn ${
                    confirmDialog.type === "kill-task" || confirmDialog.type === "decision-kill"
                      ? "danger"
                      : ""
                  }`}
                  type="button"
                  disabled={
                    (confirmDialog.type === "kill-task" || confirmDialog.type === "decision-kill") && !confirmReason
                  }
                  onClick={async () => {
                    const dialog = confirmDialog;
                    if (!dialog) return;
                    if (dialog.type === "remove-task") {
                      await performDeleteTask(dialog.task._id);
                    } else if (dialog.type === "delete-note") {
                      await performDeleteNote(dialog.note._id);
                    } else {
                      await performKillTask({
                        taskId: dialog.task._id,
                        reason: confirmReason,
                        note: confirmNote
                      });
                    }
                    closeConfirmDialog();
                    setDecisionMode(null);
                  }}
                >
                  {confirmDialog.type === "delete-note"
                    ? "Delete"
                    : confirmDialog.type === "remove-task"
                    ? "Remove"
                    : "Confirm Kill"}
                </button>
                <button className="pill-action" type="button" onClick={closeConfirmDialog}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="footer-row">
          <span>Built for calm follow-through.</span>
          <span className="footer-label">Ongoing. - {tabLabel}</span>
        </div>
      </main>
    </div>
  );
}
