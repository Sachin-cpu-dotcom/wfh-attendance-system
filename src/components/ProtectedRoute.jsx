import { Navigate } from "react-router-dom";

function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw || raw === "undefined") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getHomeRoute(role) {
  if (role === "Admin") return "/admin";
  if (role === "Manager") return "/manager";
  return "/employee";
}

export default function ProtectedRoute({ roles, children }) {
  const user = getUser();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  return children;
}
