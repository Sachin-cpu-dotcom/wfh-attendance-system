import { Routes, Route } from "react-router-dom";
import "./styles/theme.css";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

import AdminDashboard from "./pages/AdminDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";

import Attendance from "./pages/Attendance";
import Employee from "./pages/Employee";
import LiveAttendance from "./pages/LiveAttendance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Screenshots from "./pages/Screenshots";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["Admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager"
        element={
          <ProtectedRoute roles={["Manager"]}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee"
        element={
          <ProtectedRoute roles={["Employee"]}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute roles={["Admin", "Manager", "Employee"]}>
            <Attendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employees"
        element={
          <ProtectedRoute roles={["Admin"]}>
            <Employee />
          </ProtectedRoute>
        }
      />

      <Route
        path="/live-attendance"
        element={
          <ProtectedRoute roles={["Admin"]}>
            <LiveAttendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute roles={["Admin", "Manager"]}>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute roles={["Admin"]}>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/screenshots"
        element={
          <ProtectedRoute roles={["Admin", "Manager"]}>
            <Screenshots />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Login />} />
    </Routes>
  );
}
