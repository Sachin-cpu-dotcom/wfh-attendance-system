import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import IdleWarningModal from "../components/IdleWarningModal";
import useIdleTimer from "../hooks/useIdleTimer";
import { getOrgSettings, syncOrgSettings } from "../utils/appSettings";
import { getShiftConfig } from "../utils/attendanceUtils";
import {
  checkIn,
  checkOut,
  startBreakRemote,
  endBreakRemote,
  startIdleRemote,
  endIdleRemote,
  fetchTasks,
  addTaskRemote,
  updateTaskStatusRemote,
  deleteTaskRemote,
} from "../services/googleService";
import {
  getSession,
  startCheckIn,
  startBreak,
  endBreak,
  endCheckOut,
  startIdlePeriod,
  endIdlePeriod,
  computeElapsed,
  isOnBreak,
  isWorking,
} from "../utils/liveSession";

import useScreenshotCapture from "../hooks/useScreenshotCapture";

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function todayBackendDate() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export default function EmployeeDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const myShift = getShiftConfig(user?.shift);
  const targetSeconds = myShift.targetHours * 3600;

  const [session, setSession] = useState(() => getSession(user?.empId));
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orgSettings, setOrgSettings] = useState(getOrgSettings());

  useEffect(() => {
    syncOrgSettings().then(setOrgSettings);
  }, []);

  // Tick every second — elapsed time is always recomputed from real
  // timestamps, so switching tabs/pages never resets it.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-read the session whenever the tab regains focus, in case it changed
  // in another tab/window.
  useEffect(() => {
    function refresh() {
      setSession(getSession(user?.empId));
    }
    window.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.empId]);

  const working = isWorking(session);
  const onBreak = isOnBreak(session);
  const { totalSeconds, breakSeconds, idleSeconds: idleTrackedSeconds, effectiveSeconds } = computeElapsed(session, now);
  const progressPct = Math.min(Math.round((effectiveSeconds / targetSeconds) * 100), 100);

  const { isIdle, idleSeconds, dismiss } = useIdleTimer(
    orgSettings.idleTimeoutMinutes,
    working && !onBreak
  );

  // Once the idle threshold is crossed, log the whole idle stretch (from
  // when activity actually stopped, not just from when the popup appeared)
  // so it gets excluded from effective hours.
  useEffect(() => {
    if (isIdle && user?.empId) {
      const sinceMs = Date.now() - idleSeconds * 1000;
      setSession(startIdlePeriod(user.empId, sinceMs));
      startIdleRemote(user.empId, sinceMs).catch((err) =>
        console.warn("Couldn't log idle start to backend:", err)
      );
    }
  }, [isIdle]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleResumeFromIdle() {
    setSession(endIdlePeriod(user.empId));
    endIdleRemote(user.empId).catch((err) =>
      console.warn("Couldn't log idle end to backend:", err)
    );
    dismiss();
  }

  function statusLabel() {
    if (!session || !session.checkInAt) return "Not Checked In";
    if (session.checkOutAt) return "Checked Out";
    if (onBreak) return "On Break";
    return "Online";
  }

  function statusBadgeClass() {
    const label = statusLabel();
    if (label === "Online") return "badge-success";
    if (label === "On Break") return "badge-warning";
    if (label === "Checked Out") return "badge-danger";
    return "badge-info";
  }

  async function handleCheckIn() {
    setBusy(true);
    setError("");
    try {
      const res = await checkIn({ empId: user.empId, name: user.name, shift: user.shift });
      if (res?.success === false) throw new Error(res.message || "Check-in failed");
      setSession(startCheckIn(user.empId));
    } catch (err) {
      console.error(err);
      setError("Couldn't check in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStartBreak() {
    setSession(startBreak(user.empId)); // instant local feedback
    try {
      const res = await startBreakRemote(user.empId);
      if (res?.success === false) console.warn("Break start not saved to backend:", res.message);
    } catch (err) {
      console.warn("Couldn't log break start to backend:", err);
    }
  }

  async function handleEndBreak() {
    setSession(endBreak(user.empId)); // instant local feedback
    try {
      const res = await endBreakRemote(user.empId);
      if (res?.success === false) console.warn("Break end not saved to backend:", res.message);
    } catch (err) {
      console.warn("Couldn't log break end to backend:", err);
    }
  }

  const screenshotCapture = useScreenshotCapture(user?.empId, 12); // 12 min = 5/hour

  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);

  useEffect(() => {
    if (user?.empId) loadTasks();
  }, [user?.empId]);

  async function loadTasks() {
    try {
      const rows = await fetchTasks(user.empId, todayBackendDate());
      setTasks(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Couldn't load tasks:", err);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTaskBusy(true);
    try {
      await addTaskRemote(user.empId, newTask.trim());
      setNewTask("");
      loadTasks();
    } catch (err) {
      console.error("Couldn't add task:", err);
    } finally {
      setTaskBusy(false);
    }
  }

  async function handleToggleTask(task) {
    const nextStatus = task.status === "Done" ? "Pending" : "Done";
    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? { ...t, status: nextStatus } : t)));
    try {
      await updateTaskStatusRemote(task.taskId, nextStatus);
    } catch (err) {
      console.error("Couldn't update task:", err);
    }
  }

  async function handleDeleteTask(taskId) {
    setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    try {
      await deleteTaskRemote(taskId);
    } catch (err) {
      console.error("Couldn't delete task:", err);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    setError("");
    try {
      const res = await checkOut(user.empId);
      if (res?.success === false) throw new Error(res.message || "Check-out failed");
      setSession(endCheckOut(user.empId));
      screenshotCapture.disable();
    } catch (err) {
      console.error(err);
      setError("Couldn't check out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MainLayout>
      {isIdle && (
        <IdleWarningModal idleMinutes={orgSettings.idleTimeoutMinutes} onDismiss={handleResumeFromIdle} />
      )}

      <h1 className="page-title">Employee Dashboard</h1>
      <p className="page-subtitle">Welcome back, {user?.name || "there"}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }}>
        <div className="panel" style={{ textAlign: "center" }}>
          <h3>Working Timer — {myShift.label}</h3>
          <h1 style={{ fontSize: 42, color: "var(--primary)", margin: "8px 0" }}>
            {formatDuration(effectiveSeconds)}
          </h1>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--border)",
              overflow: "hidden",
              margin: "10px 0",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: progressPct >= 100 ? "var(--success)" : "var(--primary)",
                transition: "width 0.3s",
              }}
            />
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {progressPct}% of {myShift.targetHours}h target — breaks &amp; idle time excluded
          </p>
          <span className={`badge ${statusBadgeClass()}`}>{statusLabel()}</span>
        </div>

        <div className="panel">
          <h3>Today's Summary</h3>
          <p>
            <b>Check In:</b>{" "}
            {session?.checkInAt ? new Date(session.checkInAt).toLocaleTimeString() : "--"}
          </p>
          <p>
            <b>Check Out:</b>{" "}
            {session?.checkOutAt ? new Date(session.checkOutAt).toLocaleTimeString() : "--"}
          </p>
          <p><b>Total Time:</b> {formatDuration(totalSeconds)}</p>
          <p><b>Break Time:</b> {formatDuration(breakSeconds)}</p>
          <p><b>Idle Time:</b> {formatDuration(idleTrackedSeconds)}</p>
          <p><b>Shift:</b> {myShift.label}</p>
        </div>
      </div>

      <div className="panel" style={{ display: "flex", gap: 15, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={handleCheckIn} disabled={busy || working}>
          ✅ Check In
        </button>
        <button
          className="btn"
          style={{ background: "var(--warning)", color: "#fff" }}
          onClick={handleStartBreak}
          disabled={!working || onBreak}
        >
          🍽️ Start Break
        </button>
        <button
          className="btn"
          style={{ background: "var(--info)", color: "#fff" }}
          onClick={handleEndBreak}
          disabled={!onBreak}
        >
          ▶ Resume Work
        </button>
        <button className="btn btn-danger" onClick={handleCheckOut} disabled={busy || !working}>
          🔴 Check Out
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <h3>Activity Monitoring</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          Optionally share your screen to capture periodic activity snapshots (about 5 per
          hour) while you're checked in. Your browser will ask for screen-share permission —
          nothing is captured without that.
        </p>

        {!working ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Check in first to enable monitoring.</p>
        ) : !screenshotCapture.enabled ? (
          <button className="btn btn-primary" onClick={screenshotCapture.enable}>
            📸 Enable Activity Monitoring
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span className="badge badge-success">Monitoring active</span>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {screenshotCapture.captureCount} snapshot{screenshotCapture.captureCount === 1 ? "" : "s"} taken
              {screenshotCapture.lastCaptureAt &&
                ` · last at ${screenshotCapture.lastCaptureAt.toLocaleTimeString()}`}
            </span>
            <button className="btn btn-danger" style={{ padding: "6px 14px" }} onClick={screenshotCapture.disable}>
              Stop
            </button>
          </div>
        )}

        {screenshotCapture.error && (
          <div className="error-banner" style={{ marginTop: 10 }}>{screenshotCapture.error}</div>
        )}
      </div>

      <div className="panel">
        <h3>Today's Tasks</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          Log what you're working on — helps your manager see progress without interrupting you.
        </p>

        <form onSubmit={handleAddTask} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <input
            placeholder="What are you working on?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8 }}
          />
          <button type="submit" className="btn btn-primary" disabled={taskBusy || !newTask.trim()}>
            + Add Task
          </button>
        </form>

        {tasks.length === 0 ? (
          <div className="empty-state">No tasks logged yet today.</div>
        ) : (
          <div>
            {tasks.map((t) => (
              <div
                key={t.taskId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={t.status === "Done"}
                  onChange={() => handleToggleTask(t)}
                  style={{ width: "auto" }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    textDecoration: t.status === "Done" ? "line-through" : "none",
                    color: t.status === "Done" ? "var(--muted)" : "var(--ink)",
                  }}
                >
                  {t.task}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.time}</span>
                <button
                  onClick={() => handleDeleteTask(t.taskId)}
                  style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
          Your timer keeps running based on real check-in time even if you switch tabs or
          navigate elsewhere — it only pauses while you're on a break or flagged idle. See{" "}
          <b>My Attendance</b> in the sidebar for your full monthly history.
        </p>
      </div>
    </MainLayout>
  );
}
