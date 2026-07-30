export default function StatCard({ title, value, color = "var(--primary)" }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <h4>{title}</h4>
      <p className="stat-value">{value}</p>
    </div>
  );
}
