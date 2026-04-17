const bcrypt = require("bcryptjs");

const { pool } = require("../config/db");
const { createEmployeeRecord } = require("../modules/employees/employees.service");
const { createUser, findUserByEmployeeId } = require("../modules/auth/auth.model");
const {
  buildUsernameFromEmployeeCode,
  generateTemporaryPassword,
} = require("../utils/loginCredentials.util");
const { hasColumn } = require("../utils/companyScope.util");

const parseArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith("--")) {
      continue;
    }

    const key = item.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = value;
    index += 1;
  }

  return args;
};

const normalizeRequired = (value) => String(value || "").trim();

const printUsage = () => {
  console.log(
    "Usage: npm run bootstrap:owner -- --company-id <id> --full-name <name> --designation <designation> [--mobile-number <mobile>] [--joining-date YYYY-MM-DD] [--department Admin]"
  );
};

const ensureSingleCompanyOwner = async (companyId) => {
  const usersHasCompany = await hasColumn("users", "company_id");

  const query = `
    SELECT COUNT(*)::int AS "count"
    FROM users
    WHERE role = 'super_admin'
    ${usersHasCompany && companyId !== null ? "AND company_id = $1" : ""}
  `;

  const params = usersHasCompany && companyId !== null ? [companyId] : [];
  const result = await pool.query(query, params);
  const count = Number(result.rows[0]?.count || 0);

  if (count > 0) {
    throw new Error("SUPER_ADMIN_ALREADY_EXISTS");
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  const companyIdValue = normalizeRequired(args["company-id"]);
  const fullName = normalizeRequired(args["full-name"]);
  const mobileNumber = normalizeRequired(args["mobile-number"]);
  const designation = normalizeRequired(args.designation);
  const joiningDate = normalizeRequired(args["joining-date"]);
  const department = normalizeRequired(args.department || "Admin");

  if (args.help) {
    printUsage();
    return;
  }

  if (!companyIdValue || !fullName || !designation) {
    throw new Error(
      "Missing required arguments. Run with --help to see bootstrap usage."
    );
  }

  const companyId = Number(companyIdValue);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error("company-id must be a positive integer");
  }

  await ensureSingleCompanyOwner(companyId);

  const employee = await createEmployeeRecord({
    fullName,
    mobileNumber: mobileNumber || null,
    department,
    designation,
    joiningDate: joiningDate || null,
    companyId,
  });

  const existingUser = await findUserByEmployeeId(employee.id, companyId);

  if (existingUser) {
    throw new Error("OWNER_LOGIN_ALREADY_EXISTS");
  }

  const username = buildUsernameFromEmployeeCode(employee.employeeCode);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await createUser({
    employeeId: employee.id,
    username,
    passwordHash,
    role: "super_admin",
    companyId,
  });

  console.log("Company owner bootstrap completed.");
  console.log(`Company ID: ${companyId}`);
  console.log(`Employee ID: ${employee.id}`);
  console.log(`Employee Code: ${employee.employeeCode}`);
  console.log(`Username: ${user.username}`);
  console.log(`Temporary Password: ${temporaryPassword}`);
  console.log(
    "Next step: log in with this account and immediately change the password."
  );
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
