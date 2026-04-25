const { pool } = require("../../config/db");
const { hasColumn, tableExists } = require("../../utils/companyScope.util");
const {
  DEFAULT_COMPANY_MODULES,
  normalizeCompanyModules,
} = require("../../utils/companyModules.util");

const buildEmployeeCodeAlias = (identifier) => {
  const normalizedIdentifier = String(identifier || "").trim();
  const numericIdentifier = normalizedIdentifier.replace(/\D/g, "");

  if (
    !/[A-Za-z]/.test(normalizedIdentifier) ||
    !/\d{4}$/.test(normalizedIdentifier) ||
    numericIdentifier.length <= 4
  ) {
    return "";
  }

  return normalizedIdentifier.slice(0, -4).trim();
};

const buildCompanyFilter = (
  usersHasCompany,
  employeesHasCompany,
  companyId,
  userParamIndex,
  employeeParamIndex = userParamIndex
) => {
  if (companyId === null) {
    return "";
  }

  if (usersHasCompany) {
    return `AND u.company_id = $${userParamIndex}`;
  }

  if (employeesHasCompany) {
    return `AND e.company_id = $${employeeParamIndex}`;
  }

  return "";
};

const findUsersByLoginIdentifier = async (identifier, companyId = null) => {
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const employeesHasEmail = await hasColumn("employees", "email");
  const normalizedIdentifier = String(identifier || "").trim();
  const numericIdentifier = normalizedIdentifier.replace(/\D/g, "");
  const employeeCodeAlias = buildEmployeeCodeAlias(normalizedIdentifier);

  const query = `
    SELECT
      u.id,
      u.employee_id AS "employeeId",
      u.username,
      u.password_hash AS "passwordHash",
      u.role,
      u.is_active AS "isActive",
      u.must_change_password AS "mustChangePassword",
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      e.department,
      e.designation,
      ${
        usersHasCompany
          ? `u.company_id AS "companyId"`
          : employeesHasCompany
          ? `e.company_id AS "companyId"`
          : `NULL AS "companyId"`
      }
    FROM users u
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE (
      LOWER(u.username) = LOWER($1)
      OR LOWER(e.employee_code) = LOWER($1)
      OR ($3 <> '' AND LOWER(e.employee_code) = LOWER($3))
      OR REGEXP_REPLACE(COALESCE(e.mobile_number, ''), '[^0-9]', '', 'g') = $2
    )
    ${buildCompanyFilter(usersHasCompany, employeesHasCompany, companyId, 4)}
    ORDER BY
      CASE
        WHEN LOWER(u.username) = LOWER($1) THEN 0
        WHEN LOWER(e.employee_code) = LOWER($1) THEN 1
        WHEN $3 <> '' AND LOWER(e.employee_code) = LOWER($3) THEN 2
        WHEN REGEXP_REPLACE(COALESCE(e.mobile_number, ''), '[^0-9]', '', 'g') = $2 THEN 3
        ELSE 4
      END,
      u.id ASC
  `;

  const params = [normalizedIdentifier, numericIdentifier, employeeCodeAlias];
  if (companyId !== null) {
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

const findActiveCompanyLoginContextByCode = async (companyCode) => {
  const companiesExists = await tableExists("companies");
  const companiesHasEnabledModules = await hasColumn("companies", "enabled_modules");

  if (!companiesExists) {
    return null;
  }

  const normalizedCompanyCode = String(companyCode || "").trim();

  if (!normalizedCompanyCode) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      company_code AS "companyCode",
      company_name AS "companyName",
      is_active AS "isActive",
      ${
        companiesHasEnabledModules
          ? `enabled_modules AS "enabledModules"`
          : `NULL AS "enabledModules"`
      }
    FROM companies
    WHERE LOWER(company_code) = LOWER($1)
      AND is_active = TRUE
    LIMIT 1
    `,
    [normalizedCompanyCode]
  );
  const company = result.rows[0] || null;

  if (!company) {
    return null;
  }

  return {
    ...company,
    enabledModules: normalizeCompanyModules(
      company.enabledModules,
      DEFAULT_COMPANY_MODULES
    ),
  };
};

const findCompanyAccessById = async (companyId) => {
  const normalizedCompanyId = Number(companyId || 0) || null;

  if (!normalizedCompanyId) {
    return null;
  }

  const companiesExists = await tableExists("companies");
  const companiesHasEnabledModules = await hasColumn("companies", "enabled_modules");

  if (!companiesExists) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      company_code AS "companyCode",
      company_name AS "companyName",
      is_active AS "isActive",
      ${
        companiesHasEnabledModules
          ? `enabled_modules AS "enabledModules"`
          : `NULL AS "enabledModules"`
      }
    FROM companies
    WHERE id = $1
    LIMIT 1
    `,
    [normalizedCompanyId]
  );
  const company = result.rows[0] || null;

  if (!company) {
    return null;
  }

  return {
    ...company,
    enabledModules: normalizeCompanyModules(
      company.enabledModules,
      DEFAULT_COMPANY_MODULES
    ),
  };
};

const findUserByUsername = async (username, companyId = null) => {
  const result = await findUsersByLoginIdentifier(username, companyId);
  return result[0] || null;
};

const findUserByEmployeeId = async (employeeId, companyId = null) => {
  const usersHasCompany = await hasColumn("users", "company_id");
  const query = `
    SELECT
      id,
      employee_id AS "employeeId",
      username,
      role,
      is_active AS "isActive",
      must_change_password AS "mustChangePassword",
      ${usersHasCompany ? `company_id AS "companyId"` : `NULL AS "companyId"`}
    FROM users
    WHERE employee_id = $1
    ${usersHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const params = [employeeId];
  if (usersHasCompany && companyId !== null) {
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const findEmployeeById = async (employeeId, companyId = null) => {
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const query = `
    SELECT
      id,
      employee_code AS "employeeCode",
      full_name AS "fullName",
      department,
      designation,
      status,
      ${employeesHasCompany ? `company_id AS "companyId"` : `NULL AS "companyId"`}
    FROM employees
    WHERE id = $1
    ${employeesHasCompany && companyId !== null ? `AND company_id = $2` : ""}
    LIMIT 1
  `;

  const params = [employeeId];
  if (employeesHasCompany && companyId !== null) {
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const createUser = async ({
  employeeId,
  username,
  passwordHash,
  role,
  companyId,
}, db = pool) => {
  const usersHasCompany = await hasColumn("users", "company_id", db);
  const query = `
    INSERT INTO users (
      employee_id,
      username,
      password_hash,
      role,
      must_change_password
      ${usersHasCompany ? `, company_id` : ""}
    )
    VALUES ($1, $2, $3, $4, TRUE${usersHasCompany ? `, $5` : ""})
    RETURNING
      id,
      employee_id AS "employeeId",
      username,
      role,
      is_active AS "isActive",
      must_change_password AS "mustChangePassword",
      ${usersHasCompany ? `company_id AS "companyId",` : ""}
      created_at AS "createdAt"
  `;

  const values = usersHasCompany
    ? [employeeId, username, passwordHash, role, companyId]
    : [employeeId, username, passwordHash, role];
  const result = await db.query(query, values);

  return result.rows[0];
};

const updateLastLogin = async (userId) => {
  const query = `
    UPDATE users
    SET last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `;

  await pool.query(query, [userId]);
};

const updatePasswordByUserId = async ({ userId, passwordHash }) => {
  const query = `
    UPDATE users
    SET
      password_hash = $1,
      must_change_password = FALSE,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING
      id,
      employee_id AS "employeeId",
      username,
      role,
      is_active AS "isActive",
      must_change_password AS "mustChangePassword"
  `;

  const result = await pool.query(query, [passwordHash, userId]);
  return result.rows[0];
};

const findUserById = async (userId, companyId = null) => {
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");

  const query = `
    SELECT
      u.id,
      u.employee_id AS "employeeId",
      u.username,
      u.password_hash AS "passwordHash",
      u.role,
      u.is_active AS "isActive",
      u.must_change_password AS "mustChangePassword",
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      e.department,
      e.designation,
      ${
        usersHasCompany
          ? `u.company_id AS "companyId"`
          : employeesHasCompany
          ? `e.company_id AS "companyId"`
          : `NULL AS "companyId"`
      }
    FROM users u
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE u.id = $1
    ${buildCompanyFilter(usersHasCompany, employeesHasCompany, companyId, 2)}
    LIMIT 1
  `;

  const params = [userId];
  if (companyId !== null) {
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const findUserForPasswordRecovery = async ({
  identifier,
  mobileNumber,
  companyId = null,
}) => {
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const employeesHasEmail = await hasColumn("employees", "email");
  const normalizedIdentifier = String(identifier || "").trim();
  const normalizedMobile = String(mobileNumber || "").replace(/\D/g, "");
  const employeeCodeAlias = buildEmployeeCodeAlias(normalizedIdentifier);

  const query = `
    SELECT
      u.id,
      u.employee_id AS "employeeId",
      u.username,
      u.password_hash AS "passwordHash",
      u.role,
      u.is_active AS "isActive",
      u.must_change_password AS "mustChangePassword",
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      e.department,
      e.designation,
      REGEXP_REPLACE(COALESCE(e.mobile_number, ''), '[^0-9]', '', 'g') AS "mobileNumber",
      ${employeesHasEmail ? `e.email` : `NULL`} AS "email",
      ${
        usersHasCompany
          ? `u.company_id AS "companyId"`
          : employeesHasCompany
          ? `e.company_id AS "companyId"`
          : `NULL AS "companyId"`
      }
    FROM users u
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE (
      LOWER(u.username) = LOWER($1)
      OR LOWER(e.employee_code) = LOWER($1)
      OR ($3 <> '' AND LOWER(e.employee_code) = LOWER($3))
    )
    AND REGEXP_REPLACE(COALESCE(e.mobile_number, ''), '[^0-9]', '', 'g') = $2
    ${buildCompanyFilter(usersHasCompany, employeesHasCompany, companyId, 4)}
    LIMIT 1
  `;

  const params = [normalizedIdentifier, normalizedMobile, employeeCodeAlias];
  if (companyId !== null) {
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const revokeActivePasswordResetTokensForUser = async (
  userId,
  companyId = null
) => {
  const resetTokensHasCompany = await hasColumn(
    "password_reset_tokens",
    "company_id"
  );

  const query = `
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND used_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
      ${resetTokensHasCompany && companyId !== null ? `AND company_id = $2` : ""}
  `;

  await pool.query(
    query,
    resetTokensHasCompany && companyId !== null ? [userId, companyId] : [userId]
  );
};

const createPasswordResetToken = async ({
  userId,
  tokenHash,
  expiresAt,
  companyId,
  requestedByIp,
  requestedByUserAgent,
}) => {
  const resetTokensHasCompany = await hasColumn(
    "password_reset_tokens",
    "company_id"
  );

  const query = `
    INSERT INTO password_reset_tokens (
      user_id,
      token_hash,
      expires_at,
      requested_by_ip,
      requested_by_user_agent
      ${resetTokensHasCompany ? ", company_id" : ""}
    )
    VALUES ($1, $2, $3, $4, $5${resetTokensHasCompany ? ", $6" : ""})
    RETURNING id
  `;

  const params = [
    userId,
    tokenHash,
    expiresAt,
    requestedByIp || null,
    requestedByUserAgent || null,
    ...(resetTokensHasCompany ? [companyId || null] : []),
  ];

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const findValidPasswordResetToken = async (tokenHash, companyId = null) => {
  const resetTokensHasCompany = await hasColumn(
    "password_reset_tokens",
    "company_id"
  );
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");

  const query = `
    SELECT
      prt.id,
      prt.user_id AS "userId",
      prt.expires_at AS "expiresAt",
      prt.used_at AS "usedAt",
      u.username,
      u.role,
      u.is_active AS "isActive",
      u.must_change_password AS "mustChangePassword",
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      e.department,
      e.designation,
      u.employee_id AS "employeeId",
      ${
        usersHasCompany
          ? `u.company_id AS "companyId"`
          : employeesHasCompany
          ? `e.company_id AS "companyId"`
          : `NULL AS "companyId"`
      }
    FROM password_reset_tokens prt
    INNER JOIN users u ON u.id = prt.user_id
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE prt.token_hash = $1
      AND prt.used_at IS NULL
      AND prt.expires_at > CURRENT_TIMESTAMP
      ${resetTokensHasCompany && companyId !== null ? `AND prt.company_id = $2` : ""}
    LIMIT 1
  `;

  const result = await pool.query(
    query,
    resetTokensHasCompany && companyId !== null ? [tokenHash, companyId] : [tokenHash]
  );

  return result.rows[0] || null;
};

const markPasswordResetTokenUsed = async (tokenId) => {
  await pool.query(
    `
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [tokenId]
  );
};

const createAuthRefreshToken = async ({
  userId,
  companyId = null,
  tokenHash,
  expiresAt,
  issuedByIp = null,
  issuedByUserAgent = null,
  replacedByTokenHash = null,
}) => {
  const result = await pool.query(
    `
    INSERT INTO auth_refresh_tokens (
      user_id,
      company_id,
      token_hash,
      expires_at,
      issued_by_ip,
      issued_by_user_agent,
      replaced_by_token_hash
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING
      id,
      user_id AS "userId",
      company_id AS "companyId",
      token_hash AS "tokenHash",
      expires_at AS "expiresAt",
      revoked_at AS "revokedAt"
    `,
    [
      userId,
      companyId,
      tokenHash,
      expiresAt,
      issuedByIp,
      issuedByUserAgent,
      replacedByTokenHash,
    ]
  );

  return result.rows[0] || null;
};

const findValidAuthRefreshToken = async ({ tokenHash, companyId = null }) => {
  const params = [tokenHash];
  let companyFilter = "";

  if (Number(companyId || 0) > 0) {
    params.push(Number(companyId));
    companyFilter = `AND art.company_id = $${params.length}`;
  }

  const result = await pool.query(
    `
    SELECT
      art.id,
      art.user_id AS "userId",
      art.company_id AS "companyId",
      art.token_hash AS "tokenHash",
      art.expires_at AS "expiresAt",
      art.revoked_at AS "revokedAt",
      u.is_active AS "userIsActive"
    FROM auth_refresh_tokens art
    INNER JOIN users u ON u.id = art.user_id
    WHERE art.token_hash = $1
      ${companyFilter}
      AND art.revoked_at IS NULL
      AND art.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
    `,
    params
  );

  return result.rows[0] || null;
};

const revokeAuthRefreshTokenById = async ({
  tokenId,
  replacedByTokenHash = null,
}) => {
  const result = await pool.query(
    `
    UPDATE auth_refresh_tokens
    SET
      revoked_at = CURRENT_TIMESTAMP,
      replaced_by_token_hash = COALESCE($2, replaced_by_token_hash),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND revoked_at IS NULL
    `,
    [tokenId, replacedByTokenHash]
  );

  return Number(result.rowCount || 0) > 0;
};

const revokeAllAuthRefreshTokensForUser = async ({
  userId,
  companyId = null,
}) => {
  const params = [Number(userId)];
  let companyFilter = "";

  if (Number(companyId || 0) > 0) {
    params.push(Number(companyId));
    companyFilter = `AND company_id = $${params.length}`;
  }

  await pool.query(
    `
    UPDATE auth_refresh_tokens
    SET
      revoked_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      ${companyFilter}
      AND revoked_at IS NULL
    `,
    params
  );
};

const setTemporaryPasswordByUserId = async ({
  userId,
  passwordHash,
  mustChangePassword = true,
}) => {
  const result = await pool.query(
    `
    UPDATE users
    SET
      password_hash = $1,
      must_change_password = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING
      id,
      employee_id AS "employeeId",
      username,
      role,
      is_active AS "isActive",
      must_change_password AS "mustChangePassword"
    `,
    [passwordHash, mustChangePassword, userId]
  );

  return result.rows[0] || null;
};

const getUserSelfProfileById = async (userId, companyId = null) => {
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const employeesHasEmail = await hasColumn("employees", "email");
  const employeesHasEmergencyContact = await hasColumn(
    "employees",
    "emergency_contact_number"
  );
  const employeesHasAddress = await hasColumn("employees", "address");

  const query = `
    SELECT
      u.id,
      u.employee_id AS "employeeId",
      u.username,
      u.role,
      u.is_active AS "isActive",
      u.must_change_password AS "mustChangePassword",
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      e.mobile_number AS "mobileNumber",
      ${employeesHasEmail ? `e.email` : `NULL`} AS "email",
      ${
        employeesHasEmergencyContact ? `e.emergency_contact_number` : `NULL`
      } AS "emergencyContactNumber",
      ${employeesHasAddress ? `e.address` : `NULL`} AS "address",
      e.department,
      e.designation,
      e.joining_date AS "joiningDate",
      ${
        usersHasCompany
          ? `u.company_id AS "companyId"`
          : employeesHasCompany
          ? `e.company_id AS "companyId"`
          : `NULL AS "companyId"`
      }
    FROM users u
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE u.id = $1
    ${buildCompanyFilter(usersHasCompany, employeesHasCompany, companyId, 2)}
    LIMIT 1
  `;

  const params = [userId];
  if (companyId !== null) {
    params.push(companyId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

const updateUserSelfProfileById = async ({
  userId,
  companyId = null,
  fullName,
  mobileNumber,
  email,
  emergencyContactNumber,
  address,
  department,
  designation,
}) => {
  const usersHasCompany = await hasColumn("users", "company_id");
  const employeesHasCompany = await hasColumn("employees", "company_id");
  const employeesHasEmail = await hasColumn("employees", "email");
  const employeesHasEmergencyContact = await hasColumn(
    "employees",
    "emergency_contact_number"
  );
  const employeesHasAddress = await hasColumn("employees", "address");

  const selectQuery = `
    SELECT
      e.id AS "employeeId"
    FROM users u
    INNER JOIN employees e ON e.id = u.employee_id
    WHERE u.id = $1
    ${buildCompanyFilter(usersHasCompany, employeesHasCompany, companyId, 2)}
    LIMIT 1
  `;
  const selectParams = [userId];
  if (companyId !== null) {
    selectParams.push(companyId);
  }

  const employeeResult = await pool.query(selectQuery, selectParams);
  const employeeId = employeeResult.rows[0]?.employeeId || null;
  if (!employeeId) {
    return null;
  }

  let paramIndex = 1;
  const values = [];
  const sets = [];

  sets.push(`full_name = $${paramIndex++}`);
  values.push(fullName);
  sets.push(`mobile_number = $${paramIndex++}`);
  values.push(mobileNumber || null);

  if (employeesHasEmail) {
    sets.push(`email = $${paramIndex++}`);
    values.push(email || null);
  }

  if (employeesHasEmergencyContact) {
    sets.push(`emergency_contact_number = $${paramIndex++}`);
    values.push(emergencyContactNumber || null);
  }

  if (employeesHasAddress) {
    sets.push(`address = $${paramIndex++}`);
    values.push(address || null);
  }

  sets.push(`department = $${paramIndex++}`);
  values.push(department);
  sets.push(`designation = $${paramIndex++}`);
  values.push(designation);

  const employeeIdParam = paramIndex++;
  values.push(employeeId);
  const companyParam =
    employeesHasCompany && companyId !== null ? paramIndex++ : null;
  if (companyParam) {
    values.push(companyId);
  }

  await pool.query(
    `
    UPDATE employees
    SET
      ${sets.join(",\n      ")},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${employeeIdParam}
    ${
      employeesHasCompany && companyId !== null
        ? `AND company_id = $${companyParam}`
        : ""
    }
    `,
    values
  );

  return await getUserSelfProfileById(userId, companyId);
};

module.exports = {
  buildEmployeeCodeAlias,
  createAuthRefreshToken,
  createPasswordResetToken,
  findActiveCompanyLoginContextByCode,
  findCompanyAccessById,
  findValidAuthRefreshToken,
  findValidPasswordResetToken,
  findUserById,
  findUserByEmployeeId,
  findUserByUsername,
  findUserForPasswordRecovery,
  findUsersByLoginIdentifier,
  findEmployeeById,
  getUserSelfProfileById,
  createUser,
  markPasswordResetTokenUsed,
  revokeActivePasswordResetTokensForUser,
  revokeAllAuthRefreshTokensForUser,
  revokeAuthRefreshTokenById,
  setTemporaryPasswordByUserId,
  updateUserSelfProfileById,
  updateLastLogin,
  updatePasswordByUserId,
};
