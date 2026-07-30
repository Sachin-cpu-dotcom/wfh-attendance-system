import { useEffect, useRef, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import Loader from "../components/Loader";
import { fetchEmployees, fetchAttendance, fetchBreaks } from "../services/googleService";
import { computeRowMetrics, aggregateBreakMinutes, breakKeyFor } from "../utils/attendanceUtils";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LiveAttendance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000); // refresh every 20s
    return () => clearInterval(interval);
  }, []);

  // Sequential requests, and a guard so overlapping polls can't stack up.
  async function load() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const emp = await fetchEmployees();
      const att = await fetchAttendance();
      let breaks = [];
      try {
        breaks = await fetchBreaks();
      } catch (err) {
        console.warn("Break log not available yet:", err);
      }

      const employees = Array.isArray(emp) ? emp : emp?.data || [];
      const attendance = Array.isArray(att) ? att : att?.data || [];
      const breakRows = Array.isArray(breaks) ? breaks : breaks?.data || [];
      const breakMap = aggregateBreakMinutes(breakRows);

      const today = todayStr();
      const openBreakEmpIds = new Set(
        breakRows.filter((b) => b.date === today && !b.end).map((b) => b.empId)
      );

      const combined = employees
        .filter((e) => e.role === "Employee" || !e.role)
        .map((e) => {
          const todayRow = attendance.find((a) => a.empId === e.empId && a.date === today);
          const m = todayRow ? computeRowMetrics(todayRow, breakMap[breakKeyFor(todayRow)] ?? null) : null;

          let status = "Not Checked In";
          if (todayRow) {
            if (todayRow.checkOut || todayRow.logout) status = "Checked Out";
            else if (openBreakEmpIds.has(e.empId)) status = "On Break";
            else status = "Online";
          }

          return {
            empId: e.empId,
            name: e.name,
            shift: e.shift || todayRow?.shift || "—",
            status,
            checkIn: todayRow?.checkIn || todayRow?.login || "—",
            effectiveHM: m?.effectiveHM || "—",
            breakHM: m?.breakHM || "—",
          };
        });

      setRows(combined);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      console.error(err);
      setError("Couldn't load live attendance. Retrying automatically...");
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }

  function statusBadge(status) {
    if (status === "Online") return "badge-success";
    if (status === "On Break") return "badge-warning";
    if (status === "Checked Out") return "badge-danger";
    return "badge-info";
  }

  const onlineCount = rows.filter((r) => r.status === "Online").length;
  const breakCount = rows.filter((r) => r.status === "On Break").length;
  const notInCount = rows.filter((r) => r.status === "Not Checked In").length;

  return (
    <MainLayout>
      <h1 className="page-title">Live Attendance</h1>
      <p className="page-subtitle">
        Real-time status for today
        {lastUpdated && (
          <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>
            — updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </p>

      {loading ? (
        <Loader label="Loading live status..." />
      ) : (
        <>
          {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="stat-grid">
            <div className="stat-card" style={{ borderLeftColor: "var(--success)" }}>
              <h4>Online now</h4>
              <p className="stat-value">{onlineCount}</p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--warning)" }}>
              <h4>On break</h4>
              <p className="stat-value">{breakCount}</p>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--danger)" }}>
              <h4>Not checked in</h4>
              <p className="stat-value">{notInCount}</p>
            </div>
          </div>

          <div className="panel">
            <h3>Team status</h3>
            {rows.length === 0 ? (
              <div className="empty-state">No employees found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Shift</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Break Today</th>
                    <th>Effective Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.empId}>
                      <td>{r.name || r.empId}</td>
                      <td>{r.shift}</td>
                      <td>
                        <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>
                      </td>
                      <td>{r.checkIn}</td>
                      <td>{r.breakHM}</td>
                      <td>{r.effectiveHM}</td>
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
