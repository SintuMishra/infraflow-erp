const bcrypt = require("bcryptjs");

const { pool, withTransaction } = require("../config/db");
const env = require("../config/env");
const { createEmployeeRecord } = require("../modules/employees/employees.service");
const { createUser } = require("../modules/auth/auth.model");
const {
  buildUsernameFromEmployeeCode,
  generateTemporaryPassword,
} = require("../utils/loginCredentials.util");

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

const normalize = (value) => String(value || "").trim();

const printUsage = () => {
  console.log(
    "Usage: npm run reset:trial -- --yes [--company-name <name>] [--company-code <code>] [--owner-name <name>] [--owner-designation <designation>] [--owner-mobile <mobile>] [--owner-department <department>] [--owner-joining-date YYYY-MM-DD]"
  );
};

const getTruncateSql = async (db) => {
  const result = await db.query(
    `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'schema_migrations'
    ORDER BY tablename ASC
    `
  );

  const tableNames = result.rows.map((row) => row.tablename);

  if (!tableNames.length) {
    throw new Error("No public tables found for reset");
  }

  const escaped = tableNames.map((name) => `"${name.replace(/"/g, '""')}"`);
  return `TRUNCATE TABLE ${escaped.join(", ")} RESTART IDENTITY CASCADE`;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.yes) {
    throw new Error(
      "Refusing destructive reset without --yes confirmation flag."
    );
  }

  const companyName = normalize(args["company-name"]) || "SinSoftware Solutions";
  const companyCode = normalize(args["company-code"]) || "SINSOFTWARE_SOLUTIONS";
  const ownerName = normalize(args["owner-name"]) || "Sintu Mishra";
  const ownerDesignation = normalize(args["owner-designation"]) || "Founder";
  const ownerMobile = normalize(args["owner-mobile"]) || null;
  const ownerDepartment = normalize(args["owner-department"]) || "Admin";
  const ownerJoiningDate = normalize(args["owner-joining-date"]) || null;

  const resetResult = await withTransaction(async (db) => {
    const truncateSql = await getTruncateSql(db);
    await db.query(truncateSql);

    const companyInsert = await db.query(
      `
      INSERT INTO companies (
        company_code,
        company_name,
        is_active
      )
      VALUES ($1, $2, TRUE)
      RETURNING id, company_code AS "companyCode", company_name AS "companyName"
      `,
      [companyCode, companyName]
    );

    const ownerCompany = companyInsert.rows[0];

    const ownerEmployee = await createEmployeeRecord(
      {
        fullName: ownerName,
        mobileNumber: ownerMobile,
        department: ownerDepartment,
        designation: ownerDesignation,
        joiningDate: ownerJoiningDate || null,
        companyId: ownerCompany.id,
      },
      db
    );

    const ownerUsername = buildUsernameFromEmployeeCode(ownerEmployee.employeeCode);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const ownerUser = await createUser(
      {
        employeeId: ownerEmployee.id,
        username: ownerUsername,
        passwordHash,
        role: "super_admin",
        companyId: ownerCompany.id,
      },
      db
    );

    return {
      company: ownerCompany,
      ownerEmployee,
      ownerUser,
      temporaryPassword,
    };
  });

  const configuredOwnerCompanyId = Number(env.platformOwnerCompanyId || 0) || null;
  const ownerCompanyIdMatchesEnv =
    configuredOwnerCompanyId === null ||
    configuredOwnerCompanyId === Number(resetResult.company.id);

  console.log("Trial baseline reset completed.");
  console.log(`Company ID: ${resetResult.company.id}`);
  console.log(`Company Code: ${resetResult.company.companyCode}`);
  console.log(`Company Name: ${resetResult.company.companyName}`);
  console.log(`Owner Employee ID: ${resetResult.ownerEmployee.id}`);
  console.log(`Owner Employee Code: ${resetResult.ownerEmployee.employeeCode}`);
  console.log(`Owner Username: ${resetResult.ownerUser.username}`);
  console.log(`Owner Temporary Password: ${resetResult.temporaryPassword}`);
  console.log(`Owner Must Change Password: ${resetResult.ownerUser.mustChangePassword}`);
  console.log(
    `PLATFORM_OWNER_COMPANY_ID Check: ${
      ownerCompanyIdMatchesEnv ? "OK" : `MISMATCH (env=${configuredOwnerCompanyId})`
    }`
  );
  console.log(
    "Next step: restart backend and login at /owner-login, then change password."
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
