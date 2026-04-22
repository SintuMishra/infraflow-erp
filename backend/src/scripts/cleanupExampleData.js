const { pool } = require("../config/db");
const {
  permanentlyDeleteManagedCompany,
} = require("../modules/onboarding/onboarding.service");

const EXAMPLE_NAME_PATTERNS = [
  "Procurement Test %",
  "Procurement Smoke %",
  "Finance Test %",
  "Codex Write Smoke %",
  "Accounts Mini Smoke %",
  "Owner Governance Smoke %",
];

const EXAMPLE_CODE_PATTERNS = ["PRC%", "FIN%", "PROCUREMENT_SMOKE_%"];

const buildWhereClauses = () => {
  const clauses = [];
  const values = [];

  for (const pattern of EXAMPLE_NAME_PATTERNS) {
    values.push(pattern);
    clauses.push(`company_name ILIKE $${values.length}`);
  }

  for (const pattern of EXAMPLE_CODE_PATTERNS) {
    values.push(pattern);
    clauses.push(`company_code LIKE $${values.length}`);
  }

  return {
    where: clauses.length ? `(${clauses.join(" OR ")})` : "FALSE",
    values,
  };
};

const run = async () => {
  const { where, values } = buildWhereClauses();
  const candidatesResult = await pool.query(
    `
    SELECT id, company_code AS "companyCode", company_name AS "companyName"
    FROM companies
    WHERE ${where}
    ORDER BY id DESC
    `,
    values
  );

  const candidates = candidatesResult.rows;
  const deleted = [];

  for (const company of candidates) {
    const result = await permanentlyDeleteManagedCompany({
      companyId: company.id,
      deletedByUserId: null,
    });
    deleted.push(result.company);
  }

  const remainingResult = await pool.query(
    `
    SELECT COUNT(*)::int AS "remainingCount"
    FROM companies
    WHERE ${where}
    `,
    values
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        candidatesCount: candidates.length,
        deletedCount: deleted.length,
        deletedCompanies: deleted,
        remainingCount: Number(remainingResult.rows[0]?.remainingCount || 0),
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          success: false,
          message: error?.message || String(error),
          details: {
            ...(error?.details || {}),
            code: error?.code || null,
            stack: error?.stack || null,
            errors: Array.isArray(error?.errors)
              ? error.errors.map((item) => ({
                  message: item?.message || String(item),
                  code: item?.code || null,
                }))
              : null,
          },
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
