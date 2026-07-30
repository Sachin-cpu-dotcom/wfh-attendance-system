export default function IdleWarningModal({ idleMinutes, onDismiss }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          width: 360,
          textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,.25)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>⏸️</div>
        <h3 style={{ margin: "0 0 8px" }}>Are you still there?</h3>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 20 }}>
          You've been inactive for the last <b>{idleMinutes} minutes</b>. Time
          during idle periods isn't counted toward your effective work hours.
        </p>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onDismiss}>
          I'm back — resume working
        </button>
      </div>
    </div>
  );
}
