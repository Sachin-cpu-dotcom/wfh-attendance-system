import { useEffect, useMemo, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import Loader from "../components/Loader";
import DiagnosticsPanel from "../components/DiagnosticsPanel";
import {
  fetchEmployees,
  fetchAttendance,
  fetchBreaks,
} from "../services/googleService";
import {
  computeRowMetrics,
  filterByRange,
  currentMonthValue,
  aggregateBreakMinutes,
  breakKeyFor,
} from "../utils/attendanceUtils";

function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw || raw === "undefined") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function Attendance() {
  const user = getUser();
  const isManagerView = user?.role === "Admin" || user?.role === "Manager";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [breakMap, setBreakMap] = useState({});

  // Filters (shared by both views)
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [rangeType, setRangeType] = useState("month"); // yesterday | month | custom
  const [month, setMonth] = useState(currentMonthValue());
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const emp = await fetchEmployees();
      const att = await fetchAttendance();
      let breaks = [];
      try {
        breaks = await fetchBreaks();
      } catch (err) {
        console.warn("Break log not available yet:", err);
      }

      const empList = Array.isArray(emp) ? emp : emp?.data || [];
      const attList = Array.isArray(att) ? att : att?.data || [];
      setEmployees(empList);
      setAttendance(attList);
      const breakRows = Array.isArray(breaks) ? breaks : breaks?.data || [];
      setBreakMap(aggregateBreakMinutes(breakRows));

      if (isManagerView && empList.length === 0) {
        setLoadError("No employees came back from the server — check your connection or try refreshing.");
      }
    } catch (err) {
      console.error(err);
      setLoadError("Couldn't load attendance data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  const activeRange = () =>
    rangeType === "custom"
      ? { type: "custom", from: customFrom, to: customTo }
      : rangeType === "month"
      ? { type: "month", month }
      : { type: "yesterday" };

  // ---- Manager/Admin: rows for the selected employee ----
  const employeeRows = useMemo(() => {
    if (!isManagerView || !selectedEmployee) return [];
    const rows = attendance.filter((r) => r.empId === selectedEmployee);
    return filterByRange(rows, activeRange()).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [attendance, selectedEmployee, rangeType, month, customFrom, customTo, isManagerView]);

  // ---- Employee: own monthly history ----
  const myRows = useMemo(() => {
    if (isManagerView || !user?.empId) return [];
    const rows = attendance.filter((r) => r.empId === user.empId);
    return filterByRange(rows, activeRange()).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [attendance, rangeType, month, customFrom, customTo, isManagerView, user?.empId]);

  function renderFilters() {
    return (
      <div className="panel">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {isManagerView && (
            <div className="form-row" style={{ minWidth: 240, marginBottom: 0 }}>
              <label>Select Employee</label>
              <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                <option value="">-- Select employee --</option>
                {employees.map((emp) => (
                  <option key={emp.empId} value={emp.empId}>
                    {emp.empId} - {emp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-row" style={{ minWidth: 180, marginBottom: 0 }}>
            <label>Date range</label>
            <select value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="month">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {rangeType === "month" && (
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          )}

          {rangeType === "custom" && (
            <>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>From</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>To</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderTable(rows, emptyMsg) {
    if (rows.length === 0) {
      return <div className="empty-state">{emptyMsg}</div>;
    }
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Shift</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Break</th>
            <th>Total Hours</th>
            <th>Effective Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const overrideBreak = breakMap[breakKeyFor(row)] ?? null;
            const m = computeRowMetrics(row, overrideBreak);
            return (
              <tr key={i}>
                <td>{row.date}</td>
                <td>{row.shift || "—"}</td>
                <td>{row.checkIn || row.login || "—"}</td>
                <td>{row.checkOut || row.logout || "—"}</td>
                <td>{m.breakHM}</td>
                <td>
                  {m.totalHM}
                  {m.isLive && <span className="badge badge-info" style={{ marginLeft: 6 }}>Live</span>}
                  {m.isEstimated && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Est.</span>}
                </td>
                <td>{m.effectiveHM}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <MainLayout>
      <h1 className="page-title">Attendance</h1>
      <p className="page-subtitle">
        {isManagerView
          ? "Review attendance across the team"
          : "Your monthly attendance history — check in / out from the Dashboard"}
      </p>

      {loadError && (
        <div className="error-banner" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{loadError}</span>
          <button className="btn btn-primary" style={{ padding: "6px 14px" }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <Loader label="Loading attendance..." />
      ) : isManagerView ? (
        <>
          <DiagnosticsPanel
            employeeCount={employees.length}
            attendanceCount={attendance.length}
            breakCount={Object.keys(breakMap).length}
          />
          {renderFilters()}
          <div className="panel">
            <h3>
              {selectedEmployee
                ? `Attendance — ${employees.find((e) => e.empId === selectedEmployee)?.name || selectedEmployee}`
                : "Select an employee to see their attendance"}
            </h3>
            {!selectedEmployee
              ? <div className="empty-state">No employee selected yet.</div>
              : renderTable(employeeRows, "No records found for this range.")}
          </div>
        </>
      ) : (
        <>
          {renderFilters()}
          <div className="panel">
            <h3>My Attendance</h3>
            {renderTable(myRows, "No attendance records found for this range.")}
          </div>
        </>
      )}
    </MainLayout>
  );
}
