// ===============================
// JSON RESPONSE
// ===============================
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===============================
// GET REQUEST
// ===============================
function doGet(e) {

  const action = e.parameter.action;

  if (action === "breaks") {
    return getBreaks_();
  }

  if (action === "getSettings") {
    return getSettings_();
  }

  switch (action) {

    case "employees":
      return json(getEmployees());

    case "attendance":
      return json(getAttendance());

    default:
      return json({
        success: false,
        message: "Invalid GET Action"
      });

  }

}

// ===============================
// POST REQUEST
// ===============================
function doPost(e) {

  const data = JSON.parse(e.postData.contents);

  if (data.action === "startBreak") {
    return startBreak_(data);
  }
  if (data.action === "endBreak") {
    return endBreak_(data);
  }

  if (data.action === "updateSettings") {
    return updateSettings_(data);
  }

  switch (data.action) {

    // Employee
    case "addEmployee":
      return json(addEmployee(data));

    case "updateEmployee":
      return json(updateEmployee(data));

    case "deleteEmployee":
      return json(deleteEmployee(data.empId));

    // Attendance
    case "checkIn":
      return json(checkIn(data));

    case "checkOut":
      return json(checkOut(data));

    // Login
    case "login":
      return json(loginEmployee(data.email, data.password));

    default:
      return json({
        success: false,
        message: "Invalid POST Action"
      });

  }

}

// ===============================
// SETTINGS (idle timeout etc.) — now top-level, callable from doGet AND doPost
// ===============================

function getSettings_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Settings");
  const rows = sheet.getDataRange().getValues();
  const settings = { success: true };

  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    const value = rows[i][1];
    if (!key) continue;
    // numeric values (like idleTimeoutMinutes) come back as numbers
    settings[key] = isNaN(value) ? value : Number(value);
  }

  return ContentService
    .createTextOutput(JSON.stringify(settings))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateSettings_(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Settings");
  const rows = sheet.getDataRange().getValues();

  Object.keys(data).forEach((key) => {
    if (key === "action") return;

    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(data[key]);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, data[key]]);
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===============================
// BREAK LOG — now top-level, callable from doGet AND doPost
// ===============================

// Same Sheets quirk as Attendance: time-of-day text gets silently converted
// to a Date object (dated 1899-12-30) when read back. This normalizes it.
function formatTimeCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "hh:mm:ss a");
  }
  return value === "" || value === null || value === undefined ? "" : String(value);
}

function getBreaks_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("BreakLog");
  const rows = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const [date, empId, start, end, total] = rows[i];
    if (!empId) continue;
    result.push({
      date: formatDateForApp_(date),
      empId: String(empId),
      start: formatTimeCell_(start),
      end: formatTimeCell_(end),
      total: total === "" ? null : Number(total),
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function startBreak_(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("BreakLog");
  const now = new Date();

  sheet.appendRow([
    formatDateForApp_(now),   // Date
    data.empId,               // EmpID
    Utilities.formatDate(now, Session.getScriptTimeZone(), "hh:mm:ss a"), // Start
    "",                       // End (left blank until endBreak)
    "",                       // Total (left blank until endBreak)
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function endBreak_(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName("BreakLog");
  const rows = sheet.getDataRange().getValues();
  const todayStr = formatDateForApp_(new Date());

  // Find the most recent row for this employee, today, with no End time yet.
  for (let i = rows.length - 1; i >= 1; i--) {
    const [date, empId, start, end] = rows[i];
    if (String(empId) === String(data.empId) && formatDateForApp_(date) === todayStr && !end) {
      const now = new Date();
      const startTime = parseTimeOnDate_(start, now);
      const totalMinutes = Math.round((now - startTime) / 60000);

      sheet.getRange(i + 1, 4).setValue(
        Utilities.formatDate(now, Session.getScriptTimeZone(), "hh:mm:ss a")
      ); // End
      sheet.getRange(i + 1, 5).setValue(totalMinutes); // Total (in minutes)

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, totalMinutes }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: false, message: "No open break found for today" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Formats any date value as dd-MM-yyyy — matching the same format checkIn()
// already uses in the Attendance sheet, so break rows line up correctly
// with attendance rows for the same day.
function formatDateForApp_(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd-MM-yyyy");
}

// Combines a stored time-of-day string (e.g. "02:15:30 PM") with today's date,
// so we can compute a duration even though the sheet only stores the time.
function parseTimeOnDate_(timeStr, referenceDate) {
  if (timeStr instanceof Date) return timeStr;
  const parsed = new Date(`${Utilities.formatDate(referenceDate, Session.getScriptTimeZone(), "yyyy-MM-dd")} ${timeStr}`);
  return isNaN(parsed.getTime()) ? referenceDate : parsed;
}

// ===============================
// NOTE: getEmployees(), getAttendance(), addEmployee(), updateEmployee(),
// deleteEmployee(), checkIn(), checkOut(), loginEmployee() must still exist
// elsewhere in this same Apps Script project (in this file or another .gs
// file in the same project) — they were not part of what you pasted, so
// they're not shown here. Do NOT delete them; keep this file alongside them.
// ===============================
