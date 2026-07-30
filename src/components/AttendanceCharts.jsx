import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const STATUS_COLORS = {
  Present: "#16a34a",
  Online: "#16a34a",
  Break: "#f59e0b",
  "Checked Out": "#64748b",
  Absent: "#dc2626",
};

// Groups raw attendance rows by date -> { date, present, absent }
export function buildDailyTrend(rows, totalEmployees) {
  const byDate = {};
  rows.forEach((r) => {
    if (!r.date) return;
    byDate[r.date] = byDate[r.date] || { date: r.date, present: 0 };
    const isPresent = r.status === "Present" || r.status === "Online" || r.checkIn || r.login;
    if (isPresent) byDate[r.date].present += 1;
  });

  return Object.values(byDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-7)
    .map((d) => ({
      ...d,
      absent: totalEmployees ? Math.max(totalEmployees - d.present, 0) : 0,
    }));
}

export function buildStatusBreakdown(rows) {
  const counts = {};
  rows.forEach((r) => {
    const status = r.status || "Unknown";
    counts[status] = (counts[status] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function AttendanceTrendChart({ data }) {
  if (!data.length) {
    return <div className="empty-state">Not enough data yet for a trend chart.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="present" name="Present" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Bar dataKey="absent" name="Absent" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }) {
  if (!data.length) {
    return <div className="empty-state">No status data available.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.name] || "#8b5cf6"} />
          ))}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
