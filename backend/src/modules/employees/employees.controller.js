const {
  getEmployeesList,
  createEmployeeRecord,
  editEmployeeRecord,
  changeEmployeeStatus,
  changeEmployeeLoginStatus,
} = require("./employees.service");
const { sendControllerError } = require("../../utils/http.util");
const { recordAuditEvent } = require("../../utils/audit.util");

const getEmployees = async (req, res) => {
  try {
    const employees = await getEmployeesList(req.companyId || null);

    return res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to load employees");
  }
};

const createEmployee = async (req, res) => {
  try {
    const newEmployee = await createEmployeeRecord({
      ...req.body,
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "employee.created",
      actorUserId: req.user?.userId || null,
      targetType: "employee",
      targetId: newEmployee.id,
      companyId: req.companyId || null,
      details: {
        employeeCode: newEmployee.employeeCode,
        department: newEmployee.department,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: newEmployee,
    });
  } catch (error) {
    console.error("POST /employees error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Employee code already exists",
      });
    }

    return sendControllerError(req, res, error, "Failed to create employee");
  }
};

const updateStatus = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { status, relievingDate, remarks } = req.body;

    const updatedEmployee = await changeEmployeeStatus({
      employeeId,
      status,
      relievingDate,
      remarks,
    });

    await recordAuditEvent({
      action: "employee.status_updated",
      actorUserId: req.user?.userId || null,
      targetType: "employee",
      targetId: employeeId,
      companyId: req.companyId || null,
      details: {
        status,
        relievingDate: relievingDate || null,
        remarks: remarks || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Employee status updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update employee status");
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const {
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
    } = req.body;

    const updatedEmployee = await editEmployeeRecord({
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
      companyId: req.companyId || null,
    });

    await recordAuditEvent({
      action: "employee.updated",
      actorUserId: req.user?.userId || null,
      targetType: "employee",
      targetId: employeeId,
      companyId: req.companyId || null,
      details: {
        fullName: updatedEmployee.fullName,
        department: updatedEmployee.department,
        designation: updatedEmployee.designation,
        employmentType: updatedEmployee.employmentType || null,
        status: updatedEmployee.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update employee");
  }
};

const updateLoginStatus = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { enableLogin } = req.body;

    const updatedLogin = await changeEmployeeLoginStatus({
      employeeId,
      enableLogin,
    });

    await recordAuditEvent({
      action: enableLogin
        ? "employee.login_enabled"
        : "employee.login_disabled",
      actorUserId: req.user?.userId || null,
      targetType: "employee",
      targetId: employeeId,
      companyId: req.companyId || null,
      details: {
        enableLogin: Boolean(enableLogin),
      },
    });

    return res.status(200).json({
      success: true,
      message: enableLogin
        ? "Login enabled successfully"
        : "Login disabled successfully",
      data: updatedLogin,
    });
  } catch (error) {
    return sendControllerError(req, res, error, "Failed to update login status");
  }
};

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateStatus,
  updateLoginStatus,
};
