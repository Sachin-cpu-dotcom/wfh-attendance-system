import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/googleService";
import { getHomeRoute } from "../components/ProtectedRoute";
import InstallAppButton from "../components/InstallAppButton";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData || userData === "undefined") return;

    try {
      const user = JSON.parse(userData);
      navigate(getHomeRoute(user.role));
    } catch {
      localStorage.removeItem("user");
    }
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await login(email, password);

      if (!res.success) {
        setError(res.message || "Invalid email or password.");
        return;
      }

      localStorage.setItem("user", JSON.stringify(res.user));
      navigate(getHomeRoute(res.user.role));
    } catch (err) {
      console.error(err);
      setError("Login failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleLogin}>
        <div className="sidebar-brand-mark" style={{ width: 44, height: 44, fontSize: 18 }}>
          W
        </div>
        <h1>WFH Attendance System</h1>
        <p className="tagline">The Flights Guru</p>

        <div className="form-row">
          <label htmlFor="email">Company Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        {error && <div className="error-banner">{error}</div>}
      </form>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
        <InstallAppButton />
      </div>
    </div>
  );
}
