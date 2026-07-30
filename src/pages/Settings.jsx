import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import {
  fetchEmployees,
  updateEmployee,
  fetchWeekOffs,
  setWeekOffRemote,
  fetchHolidays,
  addHolidayRemote,
  deleteHolidayRemote,
} from "../services/googleService";
import { getOrgSettings, saveOrgSettings, syncOrgSettings } from "../utils/appSettings";
import { SHIFTS } from "../utils/attendanceUtils";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Settings() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [shift, setShift] = useState("Regular Shift");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [orgSettings, setOrgSettings] = useState(getOrgSettings());
  const [idleSaved, setIdleSaved] = useState(false);
  const [idleSaving, setIdleSaving] = useState(false);
  const [idleError, setIdleError] = useState("");
  const [idleSynced, setIdleSynced] = useState(false);

  // Week Off
  const [weekOffEmpId, setWeekOffEmpId] = useState("");
  const [weekOffDays, setWeekOffDays] = useState([]);
  const [weekOffMap, setWeekOffMap] = useState({});
  const [weekOffSaving, setWeekOffSaving] = useState(false);
  const [weekOffMsg, setWeekOffMsg] = useState("");

  // Holidays
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayError, setHolidayError] = useState("");

  useEffect(() => {
    fetchEmployees()
      .then((data) => setEmployees(Array.isArray(data) ? data : data?.data || []))
      .catch((err) => console.error(err));

    syncOrgSettings().then((settings) => {
      setOrgSettings(settings);
      setIdleSynced(true);
    });

    loadWeekOffs();
    loadHolidays();
  }, []);

  async function loadWeekOffs() {
    try {
      const rows = await fetchWeekOffs();
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        map[r.empId] = r.days || [];
      });
      setWeekOffMap(map);
    } catch (err) {
      console.error("Couldn't load week-offs:", err);
    }
  }

  async function loadHolidays() {
    try {
      const rows = await fetchHolidays();
      setHolidays(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Couldn't load holidays:", err);
    }
  }

  useEffect(() => {
    const emp = employees.find((e) => e.empId === selectedEmpId);
    if (emp) setShift(emp.shift || "Regular Shift");
  }, [selectedEmpId, employees]);

  useEffect(() => {
    setWeekOffDays(weekOffMap[weekOffEmpId] || []);
  }, [weekOffEmpId, weekOffMap]);

  async function handleShiftSave(e) {
    e.preventDefault();
    if (!selectedEmpId) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const emp = employees.find((x) => x.empId === selectedEmpId);
      const res = await updateEmployee({ ...emp, empId: selectedEmpId, shift });
      if (res?.success === false) throw new Error(res.message || "Update failed");
      setSaveMsg("Shift updated successfully.");
      setEmployees((prev) =>
        prev.map((x) => (x.empId === selectedEmpId ? { ...x, shift } : x))
      );
    } catch (err) {
      console.error(err);
      setSaveMsg("Couldn't update shift. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleIdleSave(e) {
    e.preventDefault();
    setIdleSaving(true);
    setIdleError("");
    const result = await saveOrgSettings({ idleTimeoutMinutes: orgSettings.idleTimeoutMinutes });
    setOrgSettings(result.settings);
    setIdleSaving(false);

    if (result.ok) {
      setIdleSaved(true);
      setTimeout(() => setIdleSaved(false), 2000);
    } else {
      setIdleError(
        "Saved on this device only — backend doesn't support settings sync yet. See the Apps Script snippet your developer needs to add."
      );
    }
  }

  function toggleWeekOffDay(day) {
    setWeekOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleWeekOffSave(e) {
    e.preventDefault();
    if (!weekOffEmpId) return;
    setWeekOffSaving(true);
    setWeekOffMsg("");
    try {
      const res = await setWeekOffRemote(weekOffEmpId, weekOffDays);
      if (res?.success === false) throw new Error(res.message || "Save failed");
      setWeekOffMap((prev) => ({ ...prev, [weekOffEmpId]: weekOffDays }));
      setWeekOffMsg("Week off saved successfully.");
    } catch (err) {
      console.error(err);
      setWeekOffMsg("Couldn't save week off. Please try again.");
    } finally {
      setWeekOffSaving(false);
    }
  }

  async function handleAddHoliday(e) {
    e.preventDefault();
    if (!holidayDate || !holidayName) return;
    setHolidaySaving(true);
    setHolidayError("");
    try {
      const res = await addHolidayRemote(holidayDate, holidayName);
      if (res?.success === false) throw new Error(res.message || "Add failed");
      setHolidayDate("");
      setHolidayName("");
      loadHolidays();
    } catch (err) {
      console.error(err);
      setHolidayError("Couldn't add holiday. Please try again.");
    } finally {
      setHolidaySaving(false);
    }
  }

  async function handleDeleteHoliday(dateStr) {
    try {
      await deleteHolidayRemote(dateStr);
      setHolidays((prev) => prev.filter((h) => h.date !== dateStr));
    } catch (err) {
      console.error(err);
      setHolidayError("Couldn't delete holiday.");
    }
  }

  return (
    <MainLayout>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Organization preferences</p>

      <div className="panel" style={{ maxWidth: 480 }}>
        <h3>Account</h3>
        <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
          Signed in as <b>{user?.name}</b> ({user?.email}) — {user?.role}
        </p>
      </div>

      <form className="panel" style={{ maxWidth: 480 }} onSubmit={handleShiftSave}>
        <h3>Change employee shift / timezone</h3>

        <div className="form-row">
          <label>Employee</label>
          <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}>
            <option value="">-- Select employee --</option>
            {employees.map((emp) => (
              <option key={emp.empId} value={emp.empId}>
                {emp.empId} - {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Shift (sets timezone + target hours)</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            {Object.keys(SHIFTS).map((key) => (
              <option key={key} value={key}>
                {SHIFTS[key].label} — {SHIFTS[key].timezone} ({SHIFTS[key].targetHours}h)
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-primary" disabled={!selectedEmpId || saving}>
          {saving ? "Saving..." : "Save shift"}
        </button>

        {saveMsg && (
          <p style={{ fontSize: 13, marginTop: 10, color: saveMsg.includes("Couldn't") ? "var(--danger)" : "var(--success)" }}>
            {saveMsg}
          </p>
        )}
      </form>

      <form className="panel" style={{ maxWidth: 480 }} onSubmit={handleWeekOffSave}>
        <h3>Assign Week Off</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          Pick which day(s) of the week are off for a specific employee.
        </p>

        <div className="form-row">
          <label>Employee</label>
          <select value={weekOffEmpId} onChange={(e) => setWeekOffEmpId(e.target.value)}>
            <option value="">-- Select employee --</option>
            {employees.map((emp) => (
              <option key={emp.empId} value={emp.empId}>
                {emp.empId} - {emp.name}
                {weekOffMap[emp.empId]?.length ? ` (${weekOffMap[emp.empId].join(", ")})` : ""}
              </option>
            ))}
          </select>
        </div>

        {weekOffEmpId && (
          <div className="form-row">
            <label>Week off day(s)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {DAYS_OF_WEEK.map((day) => (
                <label
                  key={day}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    background: weekOffDays.includes(day) ? "var(--primary-light)" : "var(--bg)",
                    padding: "6px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={weekOffDays.includes(day)}
                    onChange={() => toggleWeekOffDay(day)}
                    style={{ width: "auto" }}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={!weekOffEmpId || weekOffSaving}>
          {weekOffSaving ? "Saving..." : "Save week off"}
        </button>

        {weekOffMsg && (
          <p style={{ fontSize: 13, marginTop: 10, color: weekOffMsg.includes("Couldn't") ? "var(--danger)" : "var(--success)" }}>
            {weekOffMsg}
          </p>
        )}
      </form>

      <div className="panel" style={{ maxWidth: 480 }}>
        <h3>Holiday List</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          Company-wide holidays — visible to everyone, doesn't count as absent.
        </p>

        <form onSubmit={handleAddHoliday} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          </div>
          <div className="form-row" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
            <label>Holiday name</label>
            <input placeholder="e.g. Diwali" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={holidaySaving || !holidayDate || !holidayName}>
            {holidaySaving ? "Adding..." : "Add"}
          </button>
        </form>

        {holidayError && <div className="error-banner" style={{ marginBottom: 12 }}>{holidayError}</div>}

        {holidays.length === 0 ? (
          <div className="empty-state">No holidays added yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h, i) => (
                <tr key={i}>
                  <td>{h.date}</td>
                  <td>{h.name}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => handleDeleteHoliday(h.date)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form className="panel" style={{ maxWidth: 480 }} onSubmit={handleIdleSave}>
        <h3>Idle detection {idleSynced && <span className="badge badge-success" style={{ marginLeft: 8 }}>Synced</span>}</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
          If an employee leaves their system idle (no mouse/keyboard activity) while
          checked in, they'll see a "still there?" popup after this many minutes. This
          setting is shared across all employees and devices.
        </p>

        <div className="form-row">
          <label>Idle timeout (minutes)</label>
          <input
            type="number"
            min="1"
            max="60"
            value={orgSettings.idleTimeoutMinutes}
            onChange={(e) =>
              setOrgSettings((prev) => ({ ...prev, idleTimeoutMinutes: Number(e.target.value) }))
            }
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={idleSaving}>
          {idleSaving ? "Saving..." : "Save idle setting"}
        </button>

        {idleSaved && (
          <p style={{ color: "var(--success)", fontSize: 13, marginTop: 10 }}>
            Saved — applies to every employee and device.
          </p>
        )}
        {idleError && <div className="error-banner" style={{ marginTop: 10 }}>{idleError}</div>}
      </form>
    </MainLayout>
  );
}
