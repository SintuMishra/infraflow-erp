const { pool } = require("../../config/db");
const { hasColumn } = require("../../utils/companyScope.util");

const findAllEmployees = async (companyId = null) => {
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasEmail = await hasColumn("employees", "email");
  const employeesHasEmergencyContact = await hasColumn(
    "employees",
    "emergency_contact_number"
  );
  const employeesHasAddress = await hasColumn("employees", "address");
  const employeesHasEmploymentType = await hasColumn(
    "employees",
    "employment_type"
  );
  const employeesHasIdProofType = await hasColumn("employees", "id_proof_type");
  const employeesHasIdProofNumber = await hasColumn(
    "employees",
    "id_proof_number"
  );
  const query = `
    SELECT
      e.id,
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      e.mobile_number AS "mobileNumber",
      ${employeesHasEmail ? `e.email` : `NULL`} AS "email",
      ${
        employeesHasEmergencyContact ? `e.emergency_contact_number` : `NULL`
      } AS "emergencyContactNumber",
      ${employeesHasAddress ? `e.address` : `NULL`} AS "address",
      ${
        employeesHasEmploymentType ? `e.employment_type` : `NULL`
      } AS "employmentType",
      ${employeesHasIdProofType ? `e.id_proof_type` : `NULL`} AS "idProofType",
      ${
        employeesHasIdProofNumber ? `e.id_proof_number` : `NULL`
      } AS "idProofNumber",
      e.department,
      e.designation,
      e.joining_date AS "joiningDate",
      e.status,
      e.relieving_date AS "relievingDate",
      e.remarks,
      e.created_at AS "createdAt",
      e.updated_at AS "updatedAt",
      u.id AS "userId",
      u.username,
      u.role AS "loginRole",
      u.is_active AS "loginActive",
      u.must_change_password AS "mustChangePassword",
      ${
        employeesHasCompany
          ? `e.company_id AS "companyId"`
          : usersHasCompany
          ? `u.company_id AS "companyId"`
          : `NULL AS "companyId"`
      }
    FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id
    ${
      employeesHasCompany && companyId !== null
        ? `WHERE e.company_id = $1`
        : usersHasCompany && companyId !== null
        ? `WHERE u.company_id = $1 OR u.company_id IS NULL`
        : ""
    }
    ORDER BY e.id ASC
  `;

  const result = await pool.query(query, companyId !== null ? [companyId] : []);

  return result.rows.map((row) => {
    let loginStatus = "no_login";

    if (row.userId) {
      if (!row.loginActive) {
        loginStatus = "disabled_login";
      } else if (row.mustChangePassword) {
        loginStatus = "must_change_password";
      } else {
        loginStatus = "active_login";
      }
    }

    return {
      ...row,
      loginStatus,
    };
  });
};

const findLastEmployeeCodeByPrefix = async (prefix, companyId = null, db = pool) => {
  const employeesHasCompany = await hasColumn("employees", "company_id", db);
  const query = `
    SELECT employee_code
    FROM employees
    WHERE employee_code LIKE $1
    ${employeesHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    ORDER BY
      COALESCE(
        NULLIF(
          REGEXP_REPLACE(
            SUBSTRING(employee_code FROM LENGTH($${employeesHasCompany && companyId !== null ? 3 : 2}) + 1),
            '[^0-9]',
            '',
            'g'
          ),
          ''
        )::INTEGER,
        0
      ) DESC,
      id DESC
    LIMIT 1
  `;

  const params = [`${prefix}%`];
  if (employeesHasCompany && companyId !== null) {
    params.push(companyId);
  }
  params.push(prefix);

  const result = await db.query(query, params);
  return result.rows[0]?.employee_code || null;
};

const insertEmployee = async ({
  employeeCode,
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
}, db = pool) => {
  const employeesHasCompany = await hasColumn("employees", "company_id", db);
  const employeesHasEmail = await hasColumn("employees", "email", db);
  const employeesHasEmergencyContact = await hasColumn(
    "employees",
    "emergency_contact_number",
    db
  );
  const employeesHasAddress = await hasColumn("employees", "address", db);
  const employeesHasEmploymentType = await hasColumn(
    "employees",
    "employment_type",
    db
  );
  const employeesHasIdProofType = await hasColumn(
    "employees",
    "id_proof_type",
    db
  );
  const employeesHasIdProofNumber = await hasColumn(
    "employees",
    "id_proof_number",
    db
  );

  const insertColumns = [
    "employee_code",
    "full_name",
    "mobile_number",
  ];
  const insertValues = [
    employeeCode,
    fullName,
    mobileNumber || null,
  ];

  if (employeesHasEmail) {
    insertColumns.push("email");
    insertValues.push(email || null);
  }
  if (employeesHasEmergencyContact) {
    insertColumns.push("emergency_contact_number");
    insertValues.push(emergencyContactNumber || null);
  }
  if (employeesHasAddress) {
    insertColumns.push("address");
    insertValues.push(address || null);
  }
  if (employeesHasEmploymentType) {
    insertColumns.push("employment_type");
    insertValues.push(employmentType || null);
  }
  if (employeesHasIdProofType) {
    insertColumns.push("id_proof_type");
    insertValues.push(idProofType || null);
  }
  if (employeesHasIdProofNumber) {
    insertColumns.push("id_proof_number");
    insertValues.push(idProofNumber || null);
  }

  insertColumns.push(
    "department",
    "designation",
    "joining_date",
    "status",
    "relieving_date",
    "remarks"
  );
  insertValues.push(
    department,
    designation,
    joiningDate || null,
    status || "active",
    relievingDate || null,
    remarks || null
  );

  if (employeesHasCompany) {
    insertColumns.push("company_id");
    insertValues.push(companyId || null);
  }

  const placeholders = insertValues.map((_, index) => `$${index + 1}`);
  const query = `
    INSERT INTO employees (${insertColumns.join(", ")})
    VALUES (${placeholders.join(", ")})
    RETURNING
      id,
      employee_code AS "employeeCode",
      full_name AS "fullName",
      mobile_number AS "mobileNumber",
      ${employeesHasEmail ? `email` : `NULL`} AS "email",
      ${
        employeesHasEmergencyContact ? `emergency_contact_number` : `NULL`
      } AS "emergencyContactNumber",
      ${employeesHasAddress ? `address` : `NULL`} AS "address",
      ${
        employeesHasEmploymentType ? `employment_type` : `NULL`
      } AS "employmentType",
      ${employeesHasIdProofType ? `id_proof_type` : `NULL`} AS "idProofType",
      ${
        employeesHasIdProofNumber ? `id_proof_number` : `NULL`
      } AS "idProofNumber",
      department,
      designation,
      joining_date AS "joiningDate",
      status,
      relieving_date AS "relievingDate",
      remarks,
      ${employeesHasCompany ? `company_id AS "companyId",` : ""}
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const result = await db.query(query, insertValues);
  return result.rows[0];
};

const updateEmployeeStatus = async ({
  employeeId,
  status,
  relievingDate,
  remarks,
}) => {
  const query = `
    UPDATE employees
    SET
      status = $1,
      relieving_date = $2,
      remarks = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING
      id,
      employee_code AS "employeeCode",
      full_name AS "fullName",
      mobile_number AS "mobileNumber",
      department,
      designation,
      joining_date AS "joiningDate",
      status,
      relieving_date AS "relievingDate",
      remarks,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const values = [status, relievingDate || null, remarks || null, employeeId];
  const result = await pool.query(query, values);

  return result.rows[0];
};

const updateEmployeeById = async ({
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
}) => {
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const employeesHasEmail = await hasColumn("employees", "email");
  const employeesHasEmergencyContact = await hasColumn(
    "employees",
    "emergency_contact_number"
  );
  const employeesHasAddress = await hasColumn("employees", "address");
  const employeesHasEmploymentType = await hasColumn(
    "employees",
    "employment_type"
  );
  const employeesHasIdProofType = await hasColumn("employees", "id_proof_type");
  const employeesHasIdProofNumber = await hasColumn(
    "employees",
    "id_proof_number"
  );

  let paramIndex = 1;
  const updateSetClauses = [];
  const values = [];

  updateSetClauses.push(`full_name = $${paramIndex++}`);
  values.push(fullName);
  updateSetClauses.push(`mobile_number = $${paramIndex++}`);
  values.push(mobileNumber || null);

  if (employeesHasEmail) {
    updateSetClauses.push(`email = $${paramIndex++}`);
    values.push(email || null);
  }
  if (employeesHasEmergencyContact) {
    updateSetClauses.push(`emergency_contact_number = $${paramIndex++}`);
    values.push(emergencyContactNumber || null);
  }
  if (employeesHasAddress) {
    updateSetClauses.push(`address = $${paramIndex++}`);
    values.push(address || null);
  }
  if (employeesHasEmploymentType) {
    updateSetClauses.push(`employment_type = $${paramIndex++}`);
    values.push(employmentType || null);
  }
  if (employeesHasIdProofType) {
    updateSetClauses.push(`id_proof_type = $${paramIndex++}`);
    values.push(idProofType || null);
  }
  if (employeesHasIdProofNumber) {
    updateSetClauses.push(`id_proof_number = $${paramIndex++}`);
    values.push(idProofNumber || null);
  }

  updateSetClauses.push(`department = $${paramIndex++}`);
  values.push(department);
  updateSetClauses.push(`designation = $${paramIndex++}`);
  values.push(designation);
  updateSetClauses.push(`joining_date = $${paramIndex++}`);
  values.push(joiningDate || null);
  updateSetClauses.push(`status = $${paramIndex++}`);
  values.push(status);
  updateSetClauses.push(`relieving_date = $${paramIndex++}`);
  values.push(relievingDate || null);
  updateSetClauses.push(`remarks = $${paramIndex++}`);
  values.push(remarks || null);

  const idParam = paramIndex++;
  values.push(employeeId);
  const companyParam = employeesHasCompany && companyId !== null ? paramIndex++ : null;
  if (companyParam) {
    values.push(companyId);
  }

  const query = `
    UPDATE employees
    SET
      ${updateSetClauses.join(",\n      ")},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idParam}
    ${
      employeesHasCompany && companyId !== null
        ? `AND company_id = $${companyParam}`
        : ""
    }
    RETURNING
      id,
      employee_code AS "employeeCode",
      full_name AS "fullName",
      mobile_number AS "mobileNumber",
      ${employeesHasEmail ? `email` : `NULL`} AS "email",
      ${
        employeesHasEmergencyContact ? `emergency_contact_number` : `NULL`
      } AS "emergencyContactNumber",
      ${employeesHasAddress ? `address` : `NULL`} AS "address",
      ${
        employeesHasEmploymentType ? `employment_type` : `NULL`
      } AS "employmentType",
      ${employeesHasIdProofType ? `id_proof_type` : `NULL`} AS "idProofType",
      ${
        employeesHasIdProofNumber ? `id_proof_number` : `NULL`
      } AS "idProofNumber",
      department,
      designation,
      joining_date AS "joiningDate",
      status,
      relieving_date AS "relievingDate",
      remarks,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

const setUserActiveStatusByEmployeeId = async (employeeId, isActive) => {
  const query = `
    UPDATE users
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = $2
    RETURNING
      id,
      employee_id AS "employeeId",
      username,
      is_active AS "isActive",
      must_change_password AS "mustChangePassword"
  `;

  const result = await pool.query(query, [isActive, employeeId]);
  return result.rows[0] || null;
};

module.exports = {
  findAllEmployees,
  findLastEmployeeCodeByPrefix,
  insertEmployee,
  updateEmployeeById,
  updateEmployeeStatus,
  setUserActiveStatusByEmployeeId,
};
