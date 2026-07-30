// Google Apps Script backends often return data with slightly different key
// casing/spacing than the frontend expects (e.g. "EmpID" vs "empId", or the
// whole array wrapped in {data: [...]} vs {result: [...]} vs a bare array).
// These helpers make every fetch tolerant of that instead of silently
// returning blank fields.

// Unwraps a fetch response into a plain array regardless of how it's wrapped.
export function unwrapArray(json) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];

  const candidates = ["data", "result", "results", "rows", "records", "list", "values", "employees", "attendance", "breaks"];
  for (const key of candidates) {
    if (Array.isArray(json[key])) return json[key];
  }
  return [];
}

// Finds a value on `obj` by trying several possible key names, ignoring
// case, spaces, underscores, and hyphens (e.g. "Emp ID" matches "empId").
function pickField(obj, aliases) {
  if (!obj) return undefined;
  const normalizedKeys = Object.keys(obj).reduce((map, k) => {
    map[k.toLowerCase().replace(/[\s_-]/g, "")] = k;
    return map;
  }, {});

  for (const alias of aliases) {
    const norm = alias.toLowerCase().replace(/[\s_-]/g, "");
    if (normalizedKeys[norm] !== undefined) {
      const val = obj[normalizedKeys[norm]];
      if (val !== undefined && val !== null && val !== "") return val;
    }
  }
  return undefined;
}

function str(val) {
  if (val === undefined || val === null) return "";
  // Apps Script sometimes returns Date objects (serialized) for time/date cells.
  if (val instanceof Date) return val.toString();
  return String(val).trim();
}

export function normalizeEmployee(raw) {
  const empId = pickField(raw, ["empId", "EmpID", "EmployeeId", "Emp Id", "ID", "Id", "employeeId"]);
  const name = pickField(raw, ["name", "Name", "EmployeeName", "Employee Name", "FullName", "Full Name"]);
  const email = pickField(raw, ["email", "Email"]);
  const shift = pickField(raw, ["shift", "Shift"]);
  const role = pickField(raw, ["role", "Role"]);
  const department = pickField(raw, ["department", "Department", "Dept"]);
  const status = pickField(raw, ["status", "Status"]);

  return {
    ...raw,
    empId: str(empId),
    name: str(name),
    email: str(email),
    shift: str(shift) || "Regular Shift",
    role: str(role) || "Employee",
    department: str(department),
    status: str(status),
  };
}

export function normalizeAttendanceRow(raw) {
  const empId = pickField(raw, ["empId", "EmpID", "EmployeeId", "Emp Id", "ID"]);
  const name = pickField(raw, ["name", "Name", "EmployeeName", "Employee Name"]);
  const date = pickField(raw, ["date", "Date"]);
  const checkIn = pickField(raw, ["checkIn", "CheckIn", "Check In", "login", "Login", "In", "InTime", "In Time"]);
  const checkOut = pickField(raw, ["checkOut", "CheckOut", "Check Out", "logout", "Logout", "Out", "OutTime", "Out Time"]);
  const status = pickField(raw, ["status", "Status"]);
  const shift = pickField(raw, ["shift", "Shift"]);
  const priorMinutes = pickField(raw, ["priorMinutes", "PriorMinutes", "Prior Minutes"]);

  return {
    ...raw,
    empId: str(empId),
    name: str(name),
    date: str(date),
    checkIn: str(checkIn),
    checkOut: str(checkOut),
    status: str(status),
    shift: str(shift),
    priorMinutes: priorMinutes ? Number(priorMinutes) || 0 : 0,
  };
}

export function normalizeBreakRow(raw) {
  const empId = pickField(raw, ["empId", "EmpID", "EmployeeId", "Emp Id", "ID"]);
  const date = pickField(raw, ["date", "Date"]);
  const start = pickField(raw, ["start", "Start"]);
  const end = pickField(raw, ["end", "End"]);
  const total = pickField(raw, ["total", "Total"]);

  return {
    ...raw,
    empId: str(empId),
    date: str(date),
    start: str(start),
    end: str(end),
    total: total === undefined || total === "" ? null : Number(total),
  };
}
