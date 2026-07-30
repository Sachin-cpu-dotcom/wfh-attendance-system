import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import MainLayout from "../layouts/MainLayout";
import Loader from "../components/Loader";
import DiagnosticsPanel from "../components/DiagnosticsPanel";
import { fetchAttendance, fetchBreaks, fetchEmployees } from "../services/googleService";
import {
  computeRowMetrics,
  filterByRange,
  currentMonthValue,
  aggregateBreakMinutes,
  breakKeyFor,
} from "../utils/attendanceUtils";

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [breakMap, setBreakMap] = useState({});
  const [rangeType, setRangeType] = useState("week"); // today | yesterday | week | month
  const [month, setMonth] = useState(currentMonthValue());

  // Employee filter for the report
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  // Sequential requests — hitting the same Apps Script web app with several
  // requests at once can cause it to drop or mix up responses.
  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const emp = await fetchEmployees();
      const att = await fetchAttendance();
      let breaks = [];
      try {
        breaks = await fetchBreaks();
      } catch (err) {
        console.warn("Break log not available yet:", err);
      }

      setEmployees(Array.isArray(emp) ? emp : emp?.data || []);
      setAttendance(Array.isArray(att) ? att : att?.data || []);
      const breakRows = Array.isArray(breaks) ? breaks : breaks?.data || [];
      setBreakMap(aggregateBreakMinutes(breakRows));
    } catch (err) {
      console.error(err);
      setError("Couldn't load report data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  const filteredEmployees = employees.filter((e) =>
    (e.name || "").toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.empId || "").toLowerCase().includes(empSearch.toLowerCase())
  );

  const rows = useMemo(() => {
    const range =
      rangeType === "month" ? { type: "month", month } : { type: rangeType };
    let filtered = filterByRange(attendance, range);
    if (selectedEmpId) {
      filtered = filtered.filter((r) => r.empId === selectedEmpId);
    }
    return filtered;
  }, [attendance, rangeType, month, selectedEmpId]);

  const enriched = rows.map((row) => ({
    ...row,
    ...computeRowMetrics(row, breakMap[breakKeyFor(row)] ?? null),
  }));
  const present = enriched.filter((r) => r.status === "Present" || r.checkIn).length;
  const absent = enriched.length - present;
  const avgProductivity = enriched.length
    ? Math.round(
        enriched.reduce((sum, r) => sum + (r.productivity || 0), 0) / enriched.length
      )
    : 0;

  function rangeLabel() {
    if (rangeType === "today") return "Today";
    if (rangeType === "yesterday") return "Yesterday";
    if (rangeType === "week") return "This Week";
    return `Month: ${month}`;
  }

  function downloadCSV() {
    if (!enriched.length) return;
    const csvRows = enriched.map((r) => ({
      Date: r.date,
      Employee: r.name || r.empId,
      Shift: r.shift || "",
      "Check In": r.checkIn || r.login || "",
      "Check Out": r.checkOut || r.logout || "",
      "Break Time": r.breakHM,
      "Total Hours": r.totalHM,
      "Effective Hours": r.effectiveHM,
      "Productivity %": r.productivity ?? "",
    }));
    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${rangeType}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    if (!enriched.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Attendance Report — ${rangeLabel()}`, 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [["Date", "Employee", "Shift", "Check In", "Check Out", "Break", "Total", "Effective", "Prod %"]],
      body: enriched.map((r) => [
        r.date,
        r.name || r.empId,
        r.shift || "",
        r.checkIn || r.login || "",
        r.checkOut || r.logout || "",
        r.breakHM,
        r.totalHM,
        r.effectiveHM,
        r.productivity != null ? `${r.productivity}%` : "",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`attendance-report-${rangeType}.pdf`);
  }

  return (
    <MainLayout>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">Attendance summary — {rangeLabel()}</p>

      {loading ? (
        <Loader label="Building report..." />
      ) : (
        <>
          {error && (
            <div className="error-banner" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{error}</span>
              <button className="btn btn-primary" style={{ padding: "6px 14px" }} onClick={loadData}>
                Retry
              </button>
            </div>
          )}

          <DiagnosticsPanel
            employeeCount={employees.length}
            attendanceCount={attendance.length}
            breakCount={Object.keys(breakMap).length}
          />

          <div className="panel">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-row" style={{ minWidth: 220 }}>
                <label>Search employee</label>
                <input
                  placeholder="Search by name or ID..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                />
              </div>

              <div className="form-row" style={{ minWidth: 220 }}>
                <label>Employee</label>
                <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}>
                  <option value="">All employees</option>
                  {filteredEmployees.map((emp) => (
                    <option key={emp.empId} value={emp.empId}>
                      {emp.empId} - {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row" style={{ minWidth: 180 }}>
                <label>Range</label>
                <select value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">Monthly</option>
                </select>
              </div>

              {rangeType === "month" && (
                <div className="form-row">
                  <label>Month</label>
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
              )}

              <button className="btn btn-primary" onClick={downloadCSV} disabled={!enriched.length}>
                ⬇ Download CSV
              </button>
              <button className="btn btn-primary" onClick={downloadPDF} disabled={!enriched.length}>
                ⬇ Download PDF
              </button>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card" style={{ borderLeftColor: "var(--success)" }}>
              <h4>Present</h4>
              <p className="stat-value">{present}</p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--danger)" }}>
              <h4>Absent</h4>
              <p className="stat-value">{Math.max(absent, 0)}</p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--info)" }}>
              <h4>Avg Productivity</h4>
              <p className="stat-value">{avgProductivity}%</p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--primary)" }}>
              <h4>Total Records</h4>
              <p className="stat-value">{enriched.length}</p>
            </div>
          </div>

          <div className="panel">
            <h3>Detailed log</h3>
            {enriched.length === 0 ? (
              <div className="empty-state">No attendance data for this range.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Break</th>
                    <th>Total</th>
                    <th>Effective</th>
                    <th>Productivity</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((row, i) => (
                    <tr key={i}>
                      <td>{row.date}</td>
                      <td>{row.name || row.empId}</td>
                      <td>{row.breakHM}</td>
                      <td>{row.totalHM}</td>
                      <td>{row.effectiveHM}</td>
                      <td>
                        <span
                          className={`badge ${
                            (row.productivity || 0) >= 80 ? "badge-success" : "badge-warning"
                          }`}
                        >
                          {row.productivity != null ? `${row.productivity}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </MainLayout>
  );
}
