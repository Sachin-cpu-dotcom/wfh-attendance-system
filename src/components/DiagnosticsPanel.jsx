import { useState } from "react";
import { getLastRawDebug } from "../services/googleService";

export default function DiagnosticsPanel({ employeeCount, attendanceCount, breakCount }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel" style={{ borderLeft: "4px solid var(--purple)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Diagnostics</h3>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>
            Loaded: <b>{employeeCount}</b> employees, <b>{attendanceCount}</b> attendance rows,{" "}
            <b>{breakCount}</b> break rows.
            {employeeCount === 0 && (
              <span style={{ color: "var(--danger)" }}> No employees came back from the server.</span>
            )}
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: "6px 14px" }} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide raw data" : "Show raw data"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            This is exactly what your Google Apps Script backend sent back, before any
            processing. If employee names look empty above but there's real data here, the
            column names in your Sheet don't match what's expected — copy this and share it.
          </p>
          <RawBlock label="Employees (?action=employees)" data={getLastRawDebug().employees} />
          <RawBlock label="Attendance (?action=attendance)" data={getLastRawDebug().attendance} />
          <RawBlock label="Breaks (?action=breaks)" data={getLastRawDebug().breaks} />
        </div>
      )}
    </div>
  );
}

function RawBlock({ label, data }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <textarea
        readOnly
        value={JSON.stringify(data, null, 2) ?? "(no response yet)"}
        style={{
          width: "100%",
          height: 120,
          fontFamily: "monospace",
          fontSize: 11,
          padding: 8,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "#f8fafc",
        }}
      />
    </div>
  );
}
