import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import Loader from "../components/Loader";
import { fetchEmployees, fetchScreenshots } from "../services/googleService";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export default function Screenshots() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEmployees()
      .then((data) => setEmployees(Array.isArray(data) ? data : data?.data || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpId, date]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Convert yyyy-MM-dd input back to dd-MM-yyyy to match the backend's format.
      const [y, m, d] = date.split("-");
      const backendDate = `${d}-${m}-${y}`;
      const rows = await fetchScreenshots(selectedEmpId || undefined, backendDate);
      setShots(rows.sort((a, b) => (a.time > b.time ? -1 : 1)));
    } catch (err) {
      console.error(err);
      setError("Couldn't load screenshots. Make sure the Screenshots sheet & Apps Script action exist.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <h1 className="page-title">Screenshots</h1>
      <p className="page-subtitle">Activity snapshots captured during check-in (with employee consent)</p>

      <div className="panel">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-row" style={{ minWidth: 220, marginBottom: 0 }}>
            <label>Employee</label>
            <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}>
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp.empId} value={emp.empId}>
                  {emp.empId} - {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading screenshots..." />
      ) : (
        <div className="panel">
          {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
          {shots.length === 0 ? (
            <div className="empty-state">
              No screenshots for this selection. Employees must click "Enable Activity
              Monitoring" on their Dashboard for captures to start.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {shots.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", textDecoration: "none" }}
                >
                  <div style={{ background: "#0f172a", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>🖼 Click to view</span>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.empId}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{s.time}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
