import { Link, useLocation } from "react-router-dom";
import { getHomeRoute } from "./ProtectedRoute";

function NavItem({ to, icon, label }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link className={`nav-link${active ? " active" : ""}`} to={to}>
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const role = user?.role || "Employee";
  const dashboard = getHomeRoute(role);

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">W</div>
        <div>
          <h2>WFH System</h2>
          <span>The Flights Guru</span>
        </div>
      </div>

      <NavItem to={dashboard} icon="🏠" label="Dashboard" />

      {(role === "Admin" || role === "Manager") && (
        <>
          <div className="nav-section-label">Team</div>
          <NavItem to="/attendance" icon="🕒" label="Attendance" />
          <NavItem to="/reports" icon="📊" label="Reports" />
          <NavItem to="/screenshots" icon="📸" label="Screenshots" />
        </>
      )}

      {role === "Admin" && (
        <>
          <div className="nav-section-label">Admin</div>
          <NavItem to="/employees" icon="👨‍💼" label="Employees" />
          <NavItem to="/live-attendance" icon="🟢" label="Live Attendance" />
          <NavItem to="/settings" icon="⚙️" label="Settings" />
        </>
      )}

      {role === "Employee" && (
        <>
          <div className="nav-section-label">You</div>
          <NavItem to="/attendance" icon="📅" label="My Attendance" />
        </>
      )}
    </div>
  );
}
