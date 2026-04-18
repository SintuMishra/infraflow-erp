import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import AppShell from "../components/layout/AppShell";
import SectionCard from "../components/dashboard/SectionCard";
import { useAuth } from "../hooks/useAuth";

const DEPARTMENT_ROLE_MAP = {
  HR: "hr",
  Crusher: "crusher_supervisor",
  Projects: "site_engineer",
  Accounts: "manager",
  Admin: "manager",
};

const ROLE_ASSIGNMENT_RULES = {
  super_admin: ["hr", "manager", "crusher_supervisor", "site_engineer", "operator"],
  hr: ["crusher_supervisor", "site_engineer", "operator"],
  manager: ["crusher_supervisor", "site_engineer", "operator"],
};
const BASE_DEPARTMENT_OPTIONS = [
  "Crusher",
  "HR",
  "Projects",
  "Accounts",
  "Plant Operations",
  "Vehicles",
  "Machinery",
  "Admin",
];

const EMPLOYEE_STATUSES = ["active", "inactive", "resigned", "terminated"];
const EMPLOYMENT_TYPE_OPTIONS = [
  "full_time",
  "contract",
  "intern",
  "temporary",
  "consultant",
  "other",
];
const ID_PROOF_TYPE_OPTIONS = [
  "aadhaar",
  "pan",
  "driving_license",
  "voter_id",
  "passport",
  "other",
];
const OTHER_PREFIX_PATTERN = /^other\s*:\s*/i;
const isOtherCustomValue = (value) => OTHER_PREFIX_PATTERN.test(String(value || "").trim());
const getOtherCustomLabel = (value) =>
  String(value || "").trim().replace(OTHER_PREFIX_PATTERN, "").trim();
const buildOtherValue = (customValue) => `other:${String(customValue || "").trim()}`;
const formatDropdownValue = (value) => {
  if (!isOtherCustomValue(value)) {
    return value;
  }

  const custom = getOtherCustomLabel(value);
  return custom ? `other (${custom})` : "other";
};

const toTitleCase = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const isValidPhoneNumber = (value) => /^[0-9]{10,15}$/.test(String(value || "").trim());
const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const formatDateDisplay = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

function EmployeesPage() {
  const { currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showEmployeeList, setShowEmployeeList] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    mobileNumber: "",
    email: "",
    emergencyContactNumber: "",
    address: "",
    employmentType: "",
    employmentTypeCustom: "",
    idProofType: "",
    idProofTypeCustom: "",
    idProofNumber: "",
    department: "",
    designation: "",
    joiningDate: "",
    status: "active",
    relievingDate: "",
    remarks: "",
  });

  const [formData, setFormData] = useState({
    fullName: "",
    mobileNumber: "",
    email: "",
    emergencyContactNumber: "",
    address: "",
    employmentType: "",
    employmentTypeCustom: "",
    idProofType: "",
    idProofTypeCustom: "",
    idProofNumber: "",
    department: "",
    designation: "",
    joiningDate: "",
    status: "active",
    remarks: "",
  });

  const loadEmployees = useCallback(async () => {
    setIsLoadingEmployees(true);
    try {
      const res = await api.get("/employees");
      setEmployees(res.data.data || []);
    } catch {
      setError("Failed to load employees");
    } finally {
      setIsLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadEmployees();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch =
        employee.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = departmentFilter
        ? employee.department === departmentFilter
        : true;

      const matchesStatus = statusFilter
        ? employee.status === statusFilter
        : true;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchTerm, departmentFilter, statusFilter]);

  const departmentOptions = useMemo(() => {
    const dynamicDepartments = employees
      .map((employee) => String(employee.department || "").trim())
      .filter(Boolean);

    return Array.from(
      new Set([...BASE_DEPARTMENT_OPTIONS, ...dynamicDepartments])
    ).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const employeeInsights = useMemo(() => {
    const activeCount = employees.filter(
      (employee) => String(employee.status || "").toLowerCase() === "active"
    ).length;
    const loginEnabledCount = employees.filter(
      (employee) => employee.loginStatus === "active_login"
    ).length;
    const noLoginCount = employees.filter(
      (employee) => employee.loginStatus === "no_login"
    ).length;
    const uniqueDepartments = new Set(
      employees
        .map((employee) => String(employee.department || "").trim())
        .filter(Boolean)
    ).size;

    return {
      total: employees.length,
      activeCount,
      loginEnabledCount,
      noLoginCount,
      uniqueDepartments,
      filtered: filteredEmployees.length,
    };
  }, [employees, filteredEmployees]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.fullName.trim() || !formData.mobileNumber.trim()) {
      setError("Full Name and Mobile Number are required");
      return;
    }
    if (!isValidPhoneNumber(formData.mobileNumber)) {
      setError("Mobile Number must be 10 to 15 digits");
      return;
    }
    if (formData.email.trim() && !isValidEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (
      formData.emergencyContactNumber.trim() &&
      !isValidPhoneNumber(formData.emergencyContactNumber)
    ) {
      setError("Emergency Contact must be 10 to 15 digits");
      return;
    }

    if (
      formData.employmentType === "other" &&
      !String(formData.employmentTypeCustom || "").trim()
    ) {
      setError("Please enter custom employment type when selecting Other");
      return;
    }

    if (
      formData.idProofType === "other" &&
      !String(formData.idProofTypeCustom || "").trim()
    ) {
      setError("Please enter custom ID proof type when selecting Other");
      return;
    }

    const payload = {
      ...formData,
      employmentType:
        formData.employmentType === "other"
          ? buildOtherValue(formData.employmentTypeCustom)
          : formData.employmentType,
      idProofType:
        formData.idProofType === "other"
          ? buildOtherValue(formData.idProofTypeCustom)
          : formData.idProofType,
    };
    delete payload.employmentTypeCustom;
    delete payload.idProofTypeCustom;

    try {
      setIsSubmittingEmployee(true);
      await api.post("/employees", {
        ...payload,
        fullName: payload.fullName.trim(),
        mobileNumber: payload.mobileNumber.trim(),
        email: payload.email.trim(),
        emergencyContactNumber: payload.emergencyContactNumber.trim(),
        address: payload.address.trim(),
        employmentType: payload.employmentType.trim(),
        idProofType: payload.idProofType.trim(),
        idProofNumber: payload.idProofNumber.trim(),
        department: payload.department.trim(),
        designation: payload.designation.trim(),
        remarks: payload.remarks.trim(),
      });

      setSuccess("Employee added successfully");
      setFormData({
        fullName: "",
        mobileNumber: "",
        email: "",
        emergencyContactNumber: "",
        address: "",
        employmentType: "",
        employmentTypeCustom: "",
        idProofType: "",
        idProofTypeCustom: "",
        idProofNumber: "",
        department: "",
        designation: "",
        joiningDate: "",
        status: "active",
        remarks: "",
      });

      loadEmployees();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add employee");
    } finally {
      setIsSubmittingEmployee(false);
    }
  };

  const openEditPanel = (employee) => {
    const hasCustomEmploymentType = isOtherCustomValue(employee.employmentType);
    const hasCustomIdProofType = isOtherCustomValue(employee.idProofType);

    setSelectedEmployee(employee);
    setEditForm({
      fullName: employee.fullName || "",
      mobileNumber: employee.mobileNumber || "",
      email: employee.email || "",
      emergencyContactNumber: employee.emergencyContactNumber || "",
      address: employee.address || "",
      employmentType: hasCustomEmploymentType
        ? "other"
        : employee.employmentType || "",
      employmentTypeCustom: hasCustomEmploymentType
        ? getOtherCustomLabel(employee.employmentType)
        : "",
      idProofType: hasCustomIdProofType ? "other" : employee.idProofType || "",
      idProofTypeCustom: hasCustomIdProofType
        ? getOtherCustomLabel(employee.idProofType)
        : "",
      idProofNumber: employee.idProofNumber || "",
      department: employee.department || "",
      designation: employee.designation || "",
      joiningDate: employee.joiningDate || "",
      status: employee.status || "active",
      relievingDate: employee.relievingDate || "",
      remarks: employee.remarks || "",
    });
    setError("");
    setSuccess("");
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEmployeeUpdate = async () => {
    if (!selectedEmployee) return;

    setError("");
    setSuccess("");

    if (!editForm.fullName.trim() || !editForm.mobileNumber.trim()) {
      setError("Full Name and Mobile Number are required");
      return;
    }
    if (!isValidPhoneNumber(editForm.mobileNumber)) {
      setError("Mobile Number must be 10 to 15 digits");
      return;
    }
    if (editForm.email.trim() && !isValidEmail(editForm.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (
      editForm.emergencyContactNumber.trim() &&
      !isValidPhoneNumber(editForm.emergencyContactNumber)
    ) {
      setError("Emergency Contact must be 10 to 15 digits");
      return;
    }

    if (
      editForm.employmentType === "other" &&
      !String(editForm.employmentTypeCustom || "").trim()
    ) {
      setError("Please enter custom employment type when selecting Other");
      return;
    }

    if (
      editForm.idProofType === "other" &&
      !String(editForm.idProofTypeCustom || "").trim()
    ) {
      setError("Please enter custom ID proof type when selecting Other");
      return;
    }

    const payload = {
      ...editForm,
      employmentType:
        editForm.employmentType === "other"
          ? buildOtherValue(editForm.employmentTypeCustom)
          : editForm.employmentType,
      idProofType:
        editForm.idProofType === "other"
          ? buildOtherValue(editForm.idProofTypeCustom)
          : editForm.idProofType,
    };
    delete payload.employmentTypeCustom;
    delete payload.idProofTypeCustom;

    try {
      setIsSavingEmployee(true);
      await api.patch(`/employees/${selectedEmployee.id}`, {
        ...payload,
        fullName: payload.fullName.trim(),
        mobileNumber: payload.mobileNumber.trim(),
        email: payload.email.trim(),
        emergencyContactNumber: payload.emergencyContactNumber.trim(),
        address: payload.address.trim(),
        employmentType: payload.employmentType.trim(),
        idProofType: payload.idProofType.trim(),
        idProofNumber: payload.idProofNumber.trim(),
        relievingDate:
          payload.status === "active" ? null : payload.relievingDate || null,
      });

      setSuccess("Employee updated successfully");
      setSelectedEmployee(null);
      loadEmployees();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update employee status"
      );
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const getTodayFileDate = () => {
    return new Date().toISOString().slice(0, 10);
  };

  const escapeCsvCell = (value) => {
    const normalized = String(value ?? "");
    const escaped = normalized.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const handleDownloadCsv = () => {
    if (!filteredEmployees.length) {
      setError("No employee records available for CSV download");
      return;
    }

    const headers = [
      "Employee Code",
      "Full Name",
      "Mobile Number",
      "Email",
      "Emergency Contact Number",
      "Department",
      "Designation",
      "Employment Type",
      "ID Proof Type",
      "ID Proof Number",
      "Address",
      "Joining Date",
      "Status",
      "Relieving Date",
      "Login Status",
      "Remarks",
    ];

    const rows = filteredEmployees.map((employee) => [
      employee.employeeCode,
      employee.fullName,
      employee.mobileNumber,
      employee.email,
      employee.emergencyContactNumber,
      employee.department,
      employee.designation,
      employee.employmentType,
      employee.idProofType,
      employee.idProofNumber,
      employee.address,
      employee.joiningDate,
      employee.status,
      employee.relievingDate,
      formatLoginStatus(employee.loginStatus),
      employee.remarks,
    ]);

    const csvContent = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `employees-${getTodayFileDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess("Employee CSV downloaded successfully");
  };
  
  const handleCreateLogin = async (employee) => {
    setError("");
    setSuccess("");

    try {
      const role = DEPARTMENT_ROLE_MAP[employee.department] || "operator";

      const res = await api.post("/auth/register", {
        employeeId: employee.id,
        role,
      });

      const created = res.data.data;

      setSuccess(
        `Login created for ${created.fullName}. Username: ${created.username}, Temporary Password: ${created.temporaryPassword}`
      );
      loadEmployees();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to create login account"
      );
    }
  };

  const canCreateLoginForEmployee = (employee) => {
    const actorRole = String(currentUser?.role || "").trim().toLowerCase();
    const targetRole = DEPARTMENT_ROLE_MAP[employee.department] || "operator";
    return (ROLE_ASSIGNMENT_RULES[actorRole] || []).includes(targetRole);
  };

  const handleAdminResetPassword = async (employee) => {
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/auth/admin-reset-password", {
        employeeId: employee.id,
      });

      const resetData = res.data?.data;

      setSuccess(
        `Temporary password reset for ${
          resetData?.fullName || employee.fullName
        }. Username: ${
          resetData?.username || employee.employeeCode
        }, Temporary Password: ${resetData?.temporaryPassword}`
      );
      loadEmployees();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to reset temporary password"
      );
    }
  };

  const handleToggleLogin = async (employeeId, enableLogin) => {
    setError("");
    setSuccess("");

    try {
      await api.patch(`/employees/${employeeId}/login-status`, {
        enableLogin,
      });

      setSuccess(
        enableLogin ? "Login enabled successfully" : "Login disabled successfully"
      );
      loadEmployees();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to update login status"
      );
    }
  };

  const formatLoginStatus = (status) => {
    switch (status) {
      case "active_login":
        return "Active Login";
      case "must_change_password":
        return "Must Change Password";
      case "disabled_login":
        return "Disabled Login";
      default:
        return "No Login";
    }
  };

  return (
    <AppShell
      title="Employees"
      subtitle="Manage your workforce with real-time insights, streamlined onboarding, and comprehensive employee records."
    >
      <div style={styles.stack}>
        <section style={styles.hero}>
          <div>
            <h3 style={styles.heroTitle}>Workforce Command Center</h3>
            <p style={styles.heroSubtitle}>
              Manage records, credentials, and reporting from one polished view.
            </p>
          </div>
          <div style={styles.heroChipWrap}>
            <span style={styles.heroChip}>{employeeInsights.filtered} Showing</span>
            <span style={styles.heroChip}>{employeeInsights.total} Total</span>
            <span style={styles.heroChip}>{employeeInsights.activeCount} Active</span>
          </div>
        </section>

        <section style={styles.metricsGrid}>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>Total Employees</p>
            <p style={styles.metricValue}>{employeeInsights.total}</p>
          </article>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>Active Team</p>
            <p style={styles.metricValue}>{employeeInsights.activeCount}</p>
          </article>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>Login Enabled</p>
            <p style={styles.metricValue}>{employeeInsights.loginEnabledCount}</p>
          </article>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>No Login Yet</p>
            <p style={styles.metricValue}>{employeeInsights.noLoginCount}</p>
          </article>
          <article style={styles.metricCard}>
            <p style={styles.metricLabel}>Departments</p>
            <p style={styles.metricValue}>{employeeInsights.uniqueDepartments}</p>
          </article>
        </section>

        <SectionCard title="Add Employee">
          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              name="fullName"
              placeholder="Full Name *"
              value={formData.fullName}
              onChange={handleChange}
              required
              style={styles.input}
            />
            <input
              name="mobileNumber"
              placeholder="Mobile Number *"
              value={formData.mobileNumber}
              onChange={handleChange}
              required
              style={styles.input}
            />
            <input
              name="email"
              type="email"
              placeholder="Email (Optional)"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
            />
            <input
              name="emergencyContactNumber"
              placeholder="Emergency Contact (Optional)"
              value={formData.emergencyContactNumber}
              onChange={handleChange}
              style={styles.input}
            />
            <input
              list="employee-department-options"
              name="department"
              placeholder="Department (Recommended)"
              value={formData.department}
              onChange={handleChange}
              style={styles.input}
            />
            <input
              name="designation"
              placeholder="Designation (Recommended)"
              value={formData.designation}
              onChange={handleChange}
              style={styles.input}
            />
            <select
              name="employmentType"
              value={formData.employmentType}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Employment Type (Optional)</option>
              {EMPLOYMENT_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {toTitleCase(type)}
                </option>
              ))}
            </select>
            {formData.employmentType === "other" ? (
              <input
                name="employmentTypeCustom"
                placeholder="Custom Employment Type"
                value={formData.employmentTypeCustom}
                onChange={handleChange}
                style={styles.input}
              />
            ) : null}
            <select
              name="idProofType"
              value={formData.idProofType}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">ID Proof Type (Optional)</option>
              {ID_PROOF_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {toTitleCase(type)}
                </option>
              ))}
            </select>
            {formData.idProofType === "other" ? (
              <input
                name="idProofTypeCustom"
                placeholder="Custom ID Proof Type"
                value={formData.idProofTypeCustom}
                onChange={handleChange}
                style={styles.input}
              />
            ) : null}
            <input
              name="idProofNumber"
              placeholder="ID Proof Number (Optional)"
              value={formData.idProofNumber}
              onChange={handleChange}
              style={styles.input}
            />
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              style={styles.input}
            >
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status[0].toUpperCase()}
                  {status.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="joiningDate"
              value={formData.joiningDate}
              onChange={handleChange}
              style={styles.input}
            />
            <textarea
              name="address"
              placeholder="Address (Optional)"
              value={formData.address}
              onChange={handleChange}
              style={styles.textareaCompact}
            />
            <textarea
              name="remarks"
              placeholder="Remarks (Optional)"
              value={formData.remarks}
              onChange={handleChange}
              style={styles.textareaCompact}
            />

            <button
              type="submit"
              style={
                isSubmittingEmployee
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
              disabled={isSubmittingEmployee}
            >
              {isSubmittingEmployee ? "Adding..." : "Add Employee"}
            </button>
          </form>
          <datalist id="employee-department-options">
            {departmentOptions.map((department) => (
              <option key={department} value={department} />
            ))}
          </datalist>
        </SectionCard>

        <SectionCard title="Search & Filters">
          <div style={styles.filters}>
            <input
              placeholder="Search by name or employee code"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.input}
            />

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="">All Statuses</option>
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status[0].toUpperCase()}
                  {status.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.toolbar}>
            <button
              style={
                !filteredEmployees.length
                  ? { ...styles.button, ...styles.buttonDisabled }
                  : styles.button
              }
              onClick={handleDownloadCsv}
              disabled={!filteredEmployees.length}
            >
              Download CSV
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => setShowEmployeeList((prev) => !prev)}
            >
              {showEmployeeList ? "Hide Employee List" : "Show Employee List"}
            </button>
          </div>
        </SectionCard>

        {showEmployeeList ? (
        <SectionCard title="Employee List">
          <div style={styles.listHeader}>
            <p style={styles.listTitle}>
              {employeeInsights.filtered} records
            </p>
            <p style={styles.listSubtitle}>
              {isLoadingEmployees
                ? "Refreshing workforce data..."
                : "Real-time view with account readiness and workforce status."}
            </p>
          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Employee Code</th>
                  <th style={styles.th}>Full Name</th>
                  <th style={styles.th}>Mobile</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>Designation</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Joining Date</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Login Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee, index) => (
                  <tr
                    key={employee.id}
                    style={index % 2 === 1 ? styles.tableRowAlt : undefined}
                  >
                    <td style={styles.td}>{employee.employeeCode}</td>
                    <td style={styles.td}>{employee.fullName}</td>
                    <td style={styles.td}>{employee.mobileNumber || "-"}</td>
                    <td style={styles.td}>{employee.email || "-"}</td>
                    <td style={styles.td}>{employee.department}</td>
                    <td style={styles.td}>{employee.designation}</td>
                    <td style={styles.td}>
                      {employee.employmentType
                        ? toTitleCase(formatDropdownValue(employee.employmentType))
                        : "-"}
                    </td>
                    <td style={styles.td}>
                      {formatDateDisplay(employee.joiningDate)}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={getEmployeeStatusBadgeStyle(employee.status)}
                      >
                        {toTitleCase(employee.status)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={getLoginStatusBadgeStyle(employee.loginStatus)}>
                        {formatLoginStatus(employee.loginStatus)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionsRowInline}>
                        <button
                          style={styles.smallButton}
                          onClick={() => openEditPanel(employee)}
                        >
                          Edit
                        </button>

                        {employee.loginStatus === "no_login" ? (
                          <button
                            style={styles.smallButton}
                            onClick={() => handleCreateLogin(employee)}
                            disabled={!canCreateLoginForEmployee(employee)}
                            title={
                              canCreateLoginForEmployee(employee)
                                ? ""
                                : "Your role cannot create this type of login account"
                            }
                          >
                            Create Login
                          </button>
                        ) : (
                          <>
                            <button
                              style={styles.smallButton}
                              onClick={() =>
                                handleToggleLogin(
                                  employee.id,
                                  employee.loginStatus === "disabled_login"
                                )
                              }
                            >
                              {employee.loginStatus === "disabled_login"
                                ? "Enable Login"
                                : "Disable Login"}
                            </button>
                            <button
                              style={styles.secondarySmallButton}
                              onClick={() => handleAdminResetPassword(employee)}
                            >
                              Reset Password
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredEmployees.length ? (
                  <tr>
                    <td style={styles.emptyStateCell} colSpan={11}>
                      No employees found for current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
        ) : (
          <SectionCard title="Employee List">
            <p style={styles.helperText}>
              Employee list is currently hidden for a cleaner workspace.
            </p>
          </SectionCard>
        )}

        {selectedEmployee && (
          <SectionCard title={`Edit Employee — ${selectedEmployee.fullName}`}>
            <div style={styles.editGrid}>
              <div>
                <label style={styles.label}>Employee Code</label>
                <input
                  value={selectedEmployee.employeeCode}
                  style={styles.input}
                  disabled
                />
              </div>

              <div>
                <label style={styles.label}>Status</label>
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                  style={styles.input}
                >
                  {EMPLOYEE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status[0].toUpperCase()}
                      {status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Relieving Date</label>
                <input
                  type="date"
                  name="relievingDate"
                  value={editForm.relievingDate || ""}
                  onChange={handleEditChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Full Name</label>
                <input
                  name="fullName"
                  value={editForm.fullName}
                  onChange={handleEditChange}
                  required
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Mobile Number</label>
                <input
                  name="mobileNumber"
                  value={editForm.mobileNumber}
                  onChange={handleEditChange}
                  required
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  placeholder="Email (Optional)"
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Emergency Contact</label>
                <input
                  name="emergencyContactNumber"
                  value={editForm.emergencyContactNumber}
                  onChange={handleEditChange}
                  placeholder="Emergency Contact (Optional)"
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Department</label>
                <input
                  list="employee-department-options"
                  name="department"
                  placeholder="Department (Recommended)"
                  value={editForm.department}
                  onChange={handleEditChange}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Designation</label>
                <input
                  name="designation"
                  value={editForm.designation}
                  onChange={handleEditChange}
                  placeholder="Designation (Recommended)"
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Employment Type</label>
                <select
                  name="employmentType"
                  value={editForm.employmentType}
                  onChange={handleEditChange}
                  style={styles.input}
                >
                  <option value="">Employment Type (Optional)</option>
                  {EMPLOYMENT_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {toTitleCase(type)}
                    </option>
                  ))}
                </select>
                {editForm.employmentType === "other" ? (
                  <input
                    name="employmentTypeCustom"
                    value={editForm.employmentTypeCustom}
                    onChange={handleEditChange}
                    placeholder="Custom Employment Type"
                    style={styles.input}
                  />
                ) : null}
              </div>

              <div>
                <label style={styles.label}>ID Proof Type</label>
                <select
                  name="idProofType"
                  value={editForm.idProofType}
                  onChange={handleEditChange}
                  style={styles.input}
                >
                  <option value="">ID Proof Type (Optional)</option>
                  {ID_PROOF_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {toTitleCase(type)}
                    </option>
                  ))}
                </select>
                {editForm.idProofType === "other" ? (
                  <input
                    name="idProofTypeCustom"
                    value={editForm.idProofTypeCustom}
                    onChange={handleEditChange}
                    placeholder="Custom ID Proof Type"
                    style={styles.input}
                  />
                ) : null}
              </div>

              <div>
                <label style={styles.label}>ID Proof Number</label>
                <input
                  name="idProofNumber"
                  value={editForm.idProofNumber}
                  onChange={handleEditChange}
                  placeholder="ID Proof Number (Optional)"
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Joining Date</label>
                <input
                  type="date"
                  name="joiningDate"
                  value={editForm.joiningDate || ""}
                  onChange={handleEditChange}
                  style={styles.input}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Address</label>
                <textarea
                  name="address"
                  value={editForm.address}
                  onChange={handleEditChange}
                  style={styles.textarea}
                  placeholder="Address (Optional)"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Remarks</label>
                <textarea
                  name="remarks"
                  value={editForm.remarks}
                  onChange={handleEditChange}
                  style={styles.textarea}
                  placeholder="Add remarks"
                />
              </div>
            </div>

            <div style={styles.actionsRow}>
              <button
                style={
                  isSavingEmployee
                    ? { ...styles.button, ...styles.buttonDisabled }
                    : styles.button
                }
                onClick={handleEmployeeUpdate}
                disabled={isSavingEmployee}
              >
                {isSavingEmployee ? "Saving..." : "Save Changes"}
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => setSelectedEmployee(null)}
              >
                Cancel
              </button>
            </div>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
}

const getLoginStatusBadgeStyle = (status) => {
  const base = {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
    display: "inline-block",
  };

  switch (status) {
    case "active_login":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "must_change_password":
      return { ...base, background: "#fef3c7", color: "#92400e" };
    case "disabled_login":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    default:
      return { ...base, background: "#e5e7eb", color: "#374151" };
  }
};

const getEmployeeStatusBadgeStyle = (status) => {
  const base = {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: "600",
    display: "inline-block",
  };

  switch (String(status || "").toLowerCase()) {
    case "active":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "inactive":
      return { ...base, background: "#dbeafe", color: "#1d4ed8" };
    case "resigned":
      return { ...base, background: "#fef3c7", color: "#92400e" };
    case "terminated":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    default:
      return { ...base, background: "#e5e7eb", color: "#374151" };
  }
};

const styles = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  hero: {
    padding: "22px",
    borderRadius: "18px",
    background:
      "linear-gradient(120deg, rgba(17,24,39,0.96) 0%, rgba(12,74,110,0.95) 56%, rgba(15,118,110,0.92) 100%)",
    color: "#f8fafc",
    display: "flex",
    gap: "18px",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 14px 36px rgba(15, 23, 42, 0.25)",
  },
  heroTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "0.01em",
  },
  heroSubtitle: {
    margin: "6px 0 0 0",
    color: "#dbeafe",
    fontSize: "14px",
  },
  heroChipWrap: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  heroChip: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.15)",
    color: "#f8fafc",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.02em",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
  },
  metricCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
    padding: "14px",
  },
  metricLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  metricValue: {
    margin: "6px 0 0 0",
    fontSize: "24px",
    fontWeight: "800",
    color: "#0f172a",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    width: "100%",
  },
  textarea: {
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    width: "100%",
    minHeight: "100px",
    resize: "vertical",
  },
  textareaCompact: {
    padding: "12px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    width: "100%",
    minHeight: "48px",
    resize: "vertical",
  },
  button: {
    padding: "12px 16px",
    border: "none",
    borderRadius: "10px",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  secondaryButton: {
    padding: "12px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: "600",
  },
  smallButton: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
  },
  secondarySmallButton: {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontSize: "12px",
  },
  actionsRow: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  },
  toolbar: {
    marginTop: "14px",
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#374151",
    fontSize: "13px",
    fontWeight: "600",
  },
  helperText: {
    color: "#4b5563",
    marginBottom: "8px",
    fontSize: "13px",
  },
  error: {
    color: "#b91c1c",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
  success: {
    color: "#065f46",
    background: "#d1fae5",
    border: "1px solid #a7f3d0",
    borderRadius: "10px",
    padding: "10px 12px",
    marginBottom: "12px",
  },
  listHeader: {
    marginBottom: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "12px",
    flexWrap: "wrap",
  },
  listTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
  },
  listSubtitle: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1080px",
  },
  tableRowAlt: {
    background: "#f8fafc",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#f8fafc",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#111827",
    fontSize: "14px",
    verticalAlign: "top",
  },
  emptyStateCell: {
    padding: "18px",
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  actionsRowInline: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
};

export default EmployeesPage;
