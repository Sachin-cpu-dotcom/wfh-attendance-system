import { useEffect, useState } from "react";
import MainLayout from "../layouts/MainLayout";
import {
  fetchEmployees,
  addEmployee,
  deleteEmployee,
} from "../services/googleService";

export default function Employee() {

  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    empId: "",
    name: "",
    email: "",
    password: "",
    shift: "UK Shift",
    role: "Employee",
    department: "MIS",
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {

    setLoading(true);

    try {

      const data = await fetchEmployees();

      setEmployees(data);

    } catch (err) {

      console.log(err);

      alert("Unable to load employees");

    }

    setLoading(false);

  }

  function handleChange(e) {

    setForm({

      ...form,

      [e.target.name]: e.target.value,

    });

  }

  function generateEmployeeId() {

    return "EMP" + String(employees.length + 1).padStart(3, "0");

  }

  async function saveEmployee() {

    if (!form.name || !form.email) {

      alert("Please fill all fields");

      return;

    }

    const employee = {

      ...form,

      empId: generateEmployeeId(),

    };

    const res = await addEmployee(employee);

    if (res.success) {

      alert("Employee Added");

      setForm({

        empId: "",

        name: "",

        email: "",

        password: "",

        shift: "UK Shift",

        role: "Employee",

        department: "MIS",

      });

      loadEmployees();

    }

  }

  async function removeEmployee(empId) {

    if (!window.confirm("Delete Employee?"))

      return;

    const res = await deleteEmployee(empId);

    if (res.success) {

      loadEmployees();

    }

  }

  const filteredEmployees = employees.filter((emp) =>

    emp.name

      .toLowerCase()

      .includes(search.toLowerCase())

  );
    return (
    <MainLayout>

      <h2>Employee Master</h2>

      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >

        <h3>Add Employee</h3>

        <input
          name="name"
          placeholder="Employee Name"
          value={form.name}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
        />

        <br /><br />

        <select
          name="shift"
          value={form.shift}
          onChange={handleChange}
        >
          <option>UK Shift</option>
          <option>US Shift</option>
          <option>India General</option>
          <option>Flexible Shift</option>
        </select>

        <br /><br />

        <select
          name="role"
          value={form.role}
          onChange={handleChange}
        >
          <option>Employee</option>
          <option>Manager</option>
          <option>Admin</option>
        </select>

        <br /><br />

        <input
          name="department"
          placeholder="Department"
          value={form.department}
          onChange={handleChange}
        />

        <br /><br />

        <button onClick={saveEmployee}>
          Add Employee
        </button>

      </div>

      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >

        <input
          placeholder="Search Employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: 300,
          }}
        />

      </div>

      {loading ? (

        <h3>Loading...</h3>

      ) : (

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
          }}
        >

          <thead>

            <tr
              style={{
                background: "#2563EB",
                color: "#fff",
              }}
            >
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Shift</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>

          </thead>

          <tbody>

            {filteredEmployees.map((emp) => (

              <tr key={emp.empId}>

                <td>{emp.empId}</td>

                <td>{emp.name}</td>

                <td>{emp.email}</td>

                <td>{emp.department}</td>

                <td>{emp.shift}</td>

                <td>{emp.role}</td>

                <td>

                  <span
                    style={{
                      color:
                        emp.status === "Active"
                          ? "green"
                          : "red",
                      fontWeight: "bold",
                    }}
                  >
                    {emp.status}
                  </span>

                </td>

                <td>

                  <button
                    onClick={() =>
                      removeEmployee(emp.empId)
                    }
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      )}

    </MainLayout>
  );

}