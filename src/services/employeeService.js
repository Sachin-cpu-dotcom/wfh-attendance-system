const KEY = "employees";

export function getEmployees() {
  const data = localStorage.getItem(KEY);
  return data ? JSON.parse(data) : [];
}

export function saveEmployees(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}