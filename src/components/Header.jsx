import { useNavigate } from "react-router-dom";
import InstallAppButton from "./InstallAppButton";

export default function Header({ title = "WFH Attendance Dashboard" }) {
  const navigate = useNavigate();

  const userData = localStorage.getItem("user");
  const user =
    userData && userData !== "undefined" ? JSON.parse(userData) : null;

  function logout() {
    localStorage.removeItem("user");
    navigate("/");
  }

  return (
    <div className="topbar">
      <div>
        <h2>{title}</h2>
        <p>
          Welcome, <b>{user?.name || "there"}</b>
        </p>
        {user?.role && <span className="role-pill">{user.role}</span>}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <InstallAppButton />
        <button className="btn btn-danger" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
