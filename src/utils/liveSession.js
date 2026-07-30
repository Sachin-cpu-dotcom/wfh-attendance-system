// Tracks today's check-in/break/check-out session using real timestamps,
// persisted in localStorage. Because everything is computed from actual
// clock time (not an incrementing counter), the timer stays correct even if
// the user switches tabs, navigates to another page, or reloads the browser
// — as long as it's still the same calendar day.

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayKeyPart() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function storageKey(empId) {
  return `wfh_session_${empId}_${todayKeyPart()}`;
}

export function getSession(empId) {
  if (!empId) return null;
  try {
    const raw = localStorage.getItem(storageKey(empId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(empId, session) {
  localStorage.setItem(storageKey(empId), JSON.stringify(session));
  return session;
}

export function startCheckIn(empId) {
  const existing = getSession(empId);
  // If already checked in today and not checked out, don't clobber it —
  // just return the existing session (e.g. re-clicking check in).
  if (existing && existing.checkInAt && !existing.checkOutAt) return existing;

  const session = {
    checkInAt: Date.now(),
    checkOutAt: null,
    breaks: [],
    idlePeriods: [],
    status: "online",
  };
  return saveSession(empId, session);
}

export function startBreak(empId) {
  const session = getSession(empId);
  if (!session || session.checkOutAt) return session;

  // Don't open a second break if one is already open.
  const hasOpenBreak = session.breaks.some((b) => !b.end);
  if (!hasOpenBreak) {
    session.breaks.push({ start: Date.now(), end: null });
  }
  session.status = "break";
  return saveSession(empId, session);
}

export function endBreak(empId) {
  const session = getSession(empId);
  if (!session) return session;

  const openBreak = [...session.breaks].reverse().find((b) => !b.end);
  if (openBreak) openBreak.end = Date.now();
  session.status = "online";
  return saveSession(empId, session);
}

export function endCheckOut(empId) {
  const session = getSession(empId);
  if (!session) return session;

  // Close any dangling open break first.
  const openBreak = [...session.breaks].reverse().find((b) => !b.end);
  if (openBreak) openBreak.end = Date.now();

  // Close any dangling open idle period too.
  const openIdle = [...(session.idlePeriods || [])].reverse().find((p) => !p.end);
  if (openIdle) openIdle.end = Date.now();

  session.checkOutAt = Date.now();
  session.status = "checked_out";
  return saveSession(empId, session);
}

// Marks the start of an idle period. `sinceMs` should be the timestamp when
// activity actually stopped (not when the warning popup appeared), so the
// whole idle stretch — not just the time after the popup — gets excluded
// from effective hours.
export function startIdlePeriod(empId, sinceMs) {
  const session = getSession(empId);
  if (!session || session.checkOutAt) return session;

  session.idlePeriods = session.idlePeriods || [];
  const hasOpenIdle = session.idlePeriods.some((p) => !p.end);
  if (!hasOpenIdle) {
    session.idlePeriods.push({ start: sinceMs, end: null });
  }
  return saveSession(empId, session);
}

// Closes the open idle period once the employee resumes activity.
export function endIdlePeriod(empId) {
  const session = getSession(empId);
  if (!session) return session;

  session.idlePeriods = session.idlePeriods || [];
  const openIdle = [...session.idlePeriods].reverse().find((p) => !p.end);
  if (openIdle) openIdle.end = Date.now();
  return saveSession(empId, session);
}

// Computes total / break / idle / effective seconds from a session, as of `nowMs`.
export function computeElapsed(session, nowMs = Date.now()) {
  if (!session || !session.checkInAt) {
    return { totalSeconds: 0, breakSeconds: 0, idleSeconds: 0, effectiveSeconds: 0 };
  }

  const endTime = session.checkOutAt || nowMs;

  let breakSeconds = 0;
  (session.breaks || []).forEach((b) => {
    const bEnd = b.end || nowMs;
    breakSeconds += Math.max(0, (bEnd - b.start) / 1000);
  });

  let idleSeconds = 0;
  (session.idlePeriods || []).forEach((p) => {
    const pEnd = p.end || nowMs;
    idleSeconds += Math.max(0, (pEnd - p.start) / 1000);
  });

  const totalSeconds = Math.max(0, (endTime - session.checkInAt) / 1000);
  const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds - idleSeconds);

  return { totalSeconds, breakSeconds, idleSeconds, effectiveSeconds };
}

export function isOnBreak(session) {
  return !!session && (session.breaks || []).some((b) => !b.end) && !session.checkOutAt;
}

export function isWorking(session) {
  return !!session && !!session.checkInAt && !session.checkOutAt;
}
