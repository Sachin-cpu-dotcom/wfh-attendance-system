// Shift target hours — all shifts require 9 hours, but are named separately
// because your team runs across different regions/timezones.
export const SHIFTS = {
  "UK Shift": { label: "UK Shift", targetHours: 9, timezone: "Europe/London" },
  "US Shift": { label: "US Shift", targetHours: 9, timezone: "America/New_York" },
  "Regular Shift": { label: "Regular Shift", targetHours: 9, timezone: "Asia/Kolkata" },
};

export function getShiftConfig(shiftName) {
  return SHIFTS[shiftName] || SHIFTS["Regular Shift"];
}

// Parse a variety of time strings ("09:03 AM", "09:03:12", "9:3") into minutes since midnight.
export function timeToMinutes(value) {
  if (!value) return null;
  const str = String(value).trim();

  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!ampmMatch) return null;

  let [, h, m, , ampm] = ampmMatch;
  h = parseInt(h, 10);
  m = parseInt(m, 10);

  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === "PM" && h !== 12) h += 12;
    if (upper === "AM" && h === 12) h = 0;
  }

  return h * 60 + m;
}

export function minutesToHM(mins) {
  if (mins == null || isNaN(mins) || mins < 0) return "--";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

// Given a single attendance row, compute total logged time, break time, and effective time.
// `overrideBreakMinutes` lets callers supply real break duration from the BreakLog sheet
// instead of relying on breakStart/breakEnd fields that may not exist on the row itself.
//
// Handles two edge cases:
// - `priorMinutes` on the row (from an earlier check-in/out the same day, merged by the
//   backend into one row) gets added into the total.
// - If checkOut is missing (employee forgot to check out), time is still counted: up to
//   "now" if it's today's row (marked isLive), or up to end-of-day as a best-effort
//   estimate for a past date (marked isEstimated).
export function computeRowMetrics(row, overrideBreakMinutes = null) {
  const checkIn = timeToMinutes(row.checkIn || row.login);
  let checkOut = timeToMinutes(row.checkOut || row.logout);
  const breakStart = timeToMinutes(row.breakStart);
  const breakEnd = timeToMinutes(row.breakEnd);
  const priorMinutes = Number(row.priorMinutes) || 0;

  let totalMinutes = null;
  let isLive = false;
  let isEstimated = false;

  if (checkIn != null) {
    if (checkOut != null) {
      let diff = checkOut - checkIn;
      if (diff < 0) diff += 24 * 60;
      totalMinutes = diff + priorMinutes;
    } else {
      // Missing checkout — still count the time that was worked.
      const rowDate = parseRowDate(row);
      const today = toDateOnly(new Date());

      if (rowDate && rowDate.getTime() === today.getTime()) {
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        let diff = nowMinutes - checkIn;
        if (diff < 0) diff += 24 * 60;
        totalMinutes = diff + priorMinutes;
        isLive = true;
      } else if (rowDate) {
        // Past date, forgot to check out — estimate up to end of that day.
        const diff = 24 * 60 - checkIn;
        totalMinutes = diff + priorMinutes;
        isEstimated = true;
      }
    }
  }

  let breakMinutes = 0;
  if (overrideBreakMinutes != null) {
    breakMinutes = overrideBreakMinutes;
  } else if (breakStart != null && breakEnd != null) {
    breakMinutes = breakEnd - breakStart;
    if (breakMinutes < 0) breakMinutes += 24 * 60;
  }

  const effectiveMinutes =
    totalMinutes != null ? Math.max(totalMinutes - breakMinutes, 0) : null;

  const shift = getShiftConfig(row.shift);
  const targetMinutes = shift.targetHours * 60;
  const productivity =
    effectiveMinutes != null && targetMinutes > 0
      ? Math.min(Math.round((effectiveMinutes / targetMinutes) * 100), 100)
      : null;

  return {
    totalMinutes,
    breakMinutes,
    effectiveMinutes,
    targetMinutes,
    productivity,
    isLive,
    isEstimated,
    totalHM: minutesToHM(totalMinutes),
    breakHM: minutesToHM(breakMinutes),
    effectiveHM: minutesToHM(effectiveMinutes),
  };
}

// Builds a lookup of total break minutes per "date_empId" from BreakLog rows.
// Each BreakLog row is expected to have: date, empId, start, end, total (in minutes).
export function aggregateBreakMinutes(breakRows) {
  const map = {};
  (breakRows || []).forEach((b) => {
    if (!b.date || !b.empId) return;
    const key = `${b.date}_${b.empId}`;
    let minutes = 0;

    if (b.total != null && b.total !== "") {
      minutes = Number(b.total) || 0;
    } else {
      const start = timeToMinutes(b.start);
      const end = timeToMinutes(b.end);
      if (start != null && end != null) {
        minutes = end - start;
        if (minutes < 0) minutes += 24 * 60;
      }
    }

    map[key] = (map[key] || 0) + minutes;
  });
  return map;
}

export function breakKeyFor(row) {
  return `${row.date}_${row.empId}`;
}

// ---------- Date range helpers ----------

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Backend date formats vary a lot (ISO strings, DD/MM/YYYY, Apps Script Date
// objects serialized as full timestamps, etc). This tries several common
// shapes before falling back to the native parser, and always builds the
// Date from LOCAL y/m/d components so we never get an off-by-one from a
// UTC-midnight ISO string being reinterpreted in the browser's timezone.
function parseAnyDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : toDateOnly(value);

  const str = String(value).trim();

  // ISO: 2026-07-24 or 2026-07-24T10:00:00.000Z
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }

  // DD/MM/YYYY or DD-MM-YYYY (assume day-first, common in India).
  // If the first number can't be a valid day (>31) or the second can't be a
  // valid month (>12), swap — handles stray MM/DD/YYYY rows gracefully too.
  m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    let [, a, b, y] = m.map(Number);
    let day = a, month = b;
    if (day > 31 || month > 12) {
      day = b;
      month = a;
    }
    return new Date(y, month - 1, day);
  }

  // Fallback to native parsing (handles "Jul 24, 2026", full timestamps, etc.)
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : toDateOnly(fallback);
}

function parseRowDate(row) {
  return parseAnyDate(row.date);
}

export function filterByRange(rows, range) {
  const today = toDateOnly(new Date());

  if (range.type === "today") {
    return rows.filter((r) => {
      const d = parseRowDate(r);
      return d && d.getTime() === today.getTime();
    });
  }

  if (range.type === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return rows.filter((r) => {
      const d = parseRowDate(r);
      return d && d.getTime() === y.getTime();
    });
  }

  if (range.type === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return rows.filter((r) => {
      const d = parseRowDate(r);
      return d && d >= start && d <= today;
    });
  }

  if (range.type === "month") {
    // range.month is "YYYY-MM"
    return rows.filter((r) => {
      const d = parseRowDate(r);
      if (!d) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return ym === range.month;
    });
  }

  if (range.type === "custom") {
    const start = toDateOnly(new Date(range.from));
    const end = toDateOnly(new Date(range.to));
    return rows.filter((r) => {
      const d = parseRowDate(r);
      return d && d >= start && d <= end;
    });
  }

  return rows;
}

export function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
