const {
  findAllEmployees,
  findLastEmployeeCodeByPrefix,
  insertEmployee,
  updateEmployeeById,
  updateEmployeeStatus,
  setUserActiveStatusByEmployeeId,
} = require("./employees.model");
const {
  getDepartmentPrefix,
  buildNextEmployeeCode,
} = require("../../utils/employeeCode.util");

const DEFAULT_EMPLOYEE_DEPARTMENT = "General";
const DEFAULT_EMPLOYEE_DESIGNATION = "Team Member";

const isEmployeeCodeConflict = (error) =>
  error?.code === "23505" &&
  error?.constraint === "employees_employee_code_key";

const runWithRetrySavepoint = async (db, attempt, work) => {
  if (!db) {
    return await work();
  }

  const savepointName = `employee_code_retry_${attempt + 1}`;
  await db.query(`SAVEPOINT ${savepointName}`);

  try {
    const result = await work();
    await db.query(`RELEASE SAVEPOINT ${savepointName}`);
    return result;
  } catch (error) {
    await db.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    await db.query(`RELEASE SAVEPOINT ${savepointName}`);
    throw error;
  }
};

const getEmployeesList = async (companyId = null) => {
  return await findAllEmployees(companyId);
};

const createEmployeeRecord = async ({
  fullName,
  mobileNumber,
  email,
  emergencyContactNumber,
  address,
  employmentType,
  idProofType,
  idProofNumber,
  department,
  designation,
  joiningDate,
  status,
  relievingDate,
  remarks,
  companyId,
}, db) => {
  const normalizedDepartment =
    String(department || "").trim() || DEFAULT_EMPLOYEE_DEPARTMENT;
  const normalizedDesignation =
    String(designation || "").trim() || DEFAULT_EMPLOYEE_DESIGNATION;
  const normalizedStatus =
    String(status || "active").trim().toLowerCase() || "active";
  const prefix = getDepartmentPrefix(normalizedDepartment);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const lastCode = await findLastEmployeeCodeByPrefix(prefix, null, db);
    const employeeCode = buildNextEmployeeCode(prefix, lastCode);

    try {
      return await runWithRetrySavepoint(db, attempt, async () =>
        await insertEmployee({
          employeeCode,
          fullName,
          mobileNumber,
          email: String(email || "").trim() || null,
          emergencyContactNumber:
            String(emergencyContactNumber || "").trim() || null,
          address: String(address || "").trim() || null,
          employmentType: String(employmentType || "").trim().toLowerCase() || null,
          idProofType: String(idProofType || "").trim().toLowerCase() || null,
          idProofNumber: String(idProofNumber || "").trim() || null,
          department: normalizedDepartment,
          designation: normalizedDesignation,
          joiningDate,
          status: normalizedStatus,
          relievingDate:
            normalizedStatus === "active"
              ? null
              : String(relievingDate || "").trim() || null,
          remarks: String(remarks || "").trim() || null,
          companyId,
        }, db)
      );
    } catch (error) {
      if (!isEmployeeCodeConflict(error)) {
        throw error;
      }
    }
  }

  throw new Error("EMPLOYEE_CODE_GENERATION_FAILED");
};

const changeEmployeeStatus = async ({
  employeeId,
  status,
  relievingDate,
  remarks,
}) => {
  const updatedEmployee = await updateEmployeeStatus({
    employeeId,
    status,
    relievingDate,
    remarks,
  });

  const shouldUserBeActive = status === "active";
  await setUserActiveStatusByEmployeeId(employeeId, shouldUserBeActive);

  return updatedEmployee;
};

const changeEmployeeLoginStatus = async ({ employeeId, enableLogin }) => {
  return await setUserActiveStatusByEmployeeId(employeeId, enableLogin);
};

const normalizeEmployeeUpdatePayload = ({
  employeeId,
  fullName,
  mobileNumber,
  email,
  emergencyContactNumber,
  address,
  employmentType,
  idProofType,
  idProofNumber,
  department,
  designation,
  joiningDate,
  status,
  relievingDate,
  remarks,
  companyId = null,
}) => ({
  employeeId: Number(employeeId),
  fullName: String(fullName || "").trim(),
  mobileNumber: String(mobileNumber || "").trim() || null,
  email: String(email || "").trim().toLowerCase() || null,
  emergencyContactNumber: String(emergencyContactNumber || "").trim() || null,
  address: String(address || "").trim() || null,
  employmentType: String(employmentType || "").trim().toLowerCase() || null,
  idProofType: String(idProofType || "").trim().toLowerCase() || null,
  idProofNumber: String(idProofNumber || "").trim() || null,
  department:
    String(department || "").trim() || DEFAULT_EMPLOYEE_DEPARTMENT,
  designation:
    String(designation || "").trim() || DEFAULT_EMPLOYEE_DESIGNATION,
  joiningDate: String(joiningDate || "").trim() || null,
  status: String(status || "active").trim().toLowerCase() || "active",
  relievingDate: String(relievingDate || "").trim() || null,
  remarks: String(remarks || "").trim() || null,
  companyId,
});

const editEmployeeRecord = async (payload) => {
  const normalized = normalizeEmployeeUpdatePayload(payload);

  const updatedEmployee = await updateEmployeeById({
    ...normalized,
    relievingDate: normalized.status === "active" ? null : normalized.relievingDate,
  });

  if (!updatedEmployee) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }

  const shouldUserBeActive = normalized.status === "active";
  await setUserActiveStatusByEmployeeId(normalized.employeeId, shouldUserBeActive);

  return updatedEmployee;
};

module.exports = {
  getEmployeesList,
  createEmployeeRecord,
  editEmployeeRecord,
  changeEmployeeStatus,
  changeEmployeeLoginStatus,
  isEmployeeCodeConflict,
};
