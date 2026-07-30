import {
  unwrapArray,
  normalizeEmployee,
  normalizeAttendanceRow,
  normalizeBreakRow,
} from "../utils/normalize";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxP_Z8_GnKk8S5mrjj1wzrIsmAX5F9HwFw3fjgVYZliakKUoDZv-Nso1eXMY72cVpuJ/exec";

// Keeps the last raw (un-normalized) response from each endpoint so the
// Diagnostics panel can show exactly what the backend sent — useful for
// figuring out field-naming mismatches without needing browser devtools.
const lastRaw = { employees: null, attendance: null, breaks: null, idleLogs: null };
export function getLastRawDebug() {
  return lastRaw;
}

// =======================================
// EMPLOYEE
// =======================================

// Get Employees — always returns a clean array with normalized field names
// (empId, name, email, shift, role, department, status) regardless of how
// the backend wraps or names its fields.
export async function fetchEmployees() {
  const res = await fetch(`${API_URL}?action=employees`);
  const json = await res.json();
  lastRaw.employees = json;
  return unwrapArray(json).map(normalizeEmployee);
}

// Add Employee
export async function addEmployee(employee) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "addEmployee",
      ...employee,
    }),
  });

  return await res.json();
}

// Update Employee
export async function updateEmployee(employee) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "updateEmployee",
      ...employee,
    }),
  });

  return await res.json();
}

// Delete Employee
export async function deleteEmployee(empId) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "deleteEmployee",
      empId,
    }),
  });

  return await res.json();
}

// =======================================
// ATTENDANCE
// =======================================

// Today's Attendance — normalized array (empId, name, date, checkIn,
// checkOut, status, shift).
export async function fetchAttendance() {
  const res = await fetch(`${API_URL}?action=attendance`);
  const json = await res.json();
  lastRaw.attendance = json;
  return unwrapArray(json).map(normalizeAttendanceRow);
}

// Check In
export async function checkIn(employee) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "checkIn",
      ...employee,
    }),
  });

  return await res.json();
}

// Check Out
export async function checkOut(empId) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "checkOut",
      empId,
    }),
  });

  return await res.json();
}
// =======================================
// BREAK LOG (Start / End / Total per day, from the BreakLog sheet)
// =======================================

// All break rows (date, empId, start, end, total). Filter client-side like attendance.
export async function fetchBreaks() {
  const res = await fetch(`${API_URL}?action=breaks`);
  const json = await res.json();
  lastRaw.breaks = json;
  return unwrapArray(json).map(normalizeBreakRow);
}

// Logs a break start for today.
export async function startBreakRemote(empId) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "startBreak",
      empId,
    }),
  });

  return await res.json();
}

// Closes today's open break and records its duration.
export async function endBreakRemote(empId) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "endBreak",
      empId,
    }),
  });

  return await res.json();
}

// =======================================
// IDLE TRACKING LOG
// =======================================

export async function fetchIdleLogs() {
  const res = await fetch(`${API_URL}?action=idleLogs`);
  const json = await res.json();
  lastRaw.idleLogs = json;
  return unwrapArray(json).map(normalizeBreakRow); // same shape as break rows
}

export async function startIdleRemote(empId, idleSinceMs) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "startIdle", empId, idleSinceMs }),
  });
  return await res.json();
}

export async function endIdleRemote(empId) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "endIdle", empId }),
  });
  return await res.json();
}

// =======================================
// WEEK OFF
// =======================================

export async function fetchWeekOffs() {
  const res = await fetch(`${API_URL}?action=weekOffs`);
  const json = await res.json();
  return unwrapArray(json);
}

// days: array like ["Sunday", "Saturday"]
export async function setWeekOffRemote(empId, days) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "setWeekOff", empId, days }),
  });
  return await res.json();
}

// =======================================
// HOLIDAY LIST
// =======================================

export async function fetchHolidays() {
  const res = await fetch(`${API_URL}?action=holidays`);
  const json = await res.json();
  return unwrapArray(json);
}

export async function addHolidayRemote(date, name) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "addHoliday", date, name }),
  });
  return await res.json();
}

export async function deleteHolidayRemote(date) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "deleteHoliday", date }),
  });
  return await res.json();
}

// =======================================
// TASKS
// =======================================

export async function fetchTasks(empId, date) {
  const params = new URLSearchParams({ action: "tasks" });
  if (empId) params.set("empId", empId);
  if (date) params.set("date", date);
  const res = await fetch(`${API_URL}?${params.toString()}`);
  const json = await res.json();
  return unwrapArray(json);
}

export async function addTaskRemote(empId, task) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "addTask", empId, task }),
  });
  return await res.json();
}

export async function updateTaskStatusRemote(taskId, status) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "updateTaskStatus", taskId, status }),
  });
  return await res.json();
}

export async function deleteTaskRemote(taskId) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "deleteTask", taskId }),
  });
  return await res.json();
}

// =======================================
// SCREENSHOTS
// =======================================

// imageBase64 should NOT include the "data:image/jpeg;base64," prefix.
export async function uploadScreenshotRemote(empId, imageBase64, mimeType = "image/jpeg") {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "uploadScreenshot", empId, imageBase64, mimeType }),
  });
  return await res.json();
}

export async function fetchScreenshots(empId, date) {
  const params = new URLSearchParams({ action: "screenshots" });
  if (empId) params.set("empId", empId);
  if (date) params.set("date", date);
  const res = await fetch(`${API_URL}?${params.toString()}`);
  const json = await res.json();
  return unwrapArray(json);
}

// =======================================
// ORG SETTINGS (idle timeout, etc. — shared across all devices)
// =======================================

// Get org-wide settings (idle timeout, etc.)
export async function fetchOrgSettingsRemote() {
  const res = await fetch(`${API_URL}?action=getSettings`);
  return await res.json();
}

// Update org-wide settings (idle timeout, etc.)
export async function updateOrgSettingsRemote(settings) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      action: "updateSettings",
      ...settings,
    }),
  });

  return await res.json();
}

// ==========================
// LOGIN
// ==========================

export async function login(email, password) {

  const res = await fetch(API_URL, {

    method: "POST",

    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },

    body: JSON.stringify({

      action: "login",

      email,

      password,

    }),

  });

  return await res.json();

}