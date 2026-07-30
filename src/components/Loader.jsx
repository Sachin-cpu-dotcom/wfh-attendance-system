export default function Loader({ label = "Loading..." }) {
  return (
    <div className="loader-wrap" role="status" aria-live="polite">
      <div className="spinner" />
      <span style={{ marginLeft: 12, color: "var(--ink-soft)" }}>{label}</span>
    </div>
  );
}
