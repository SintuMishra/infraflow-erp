const { pool } = require("../config/db");
const env = require("../config/env");

const MIN_RECOMMENDED_BOOTSTRAP_SECRET_LENGTH = 24;

const fail = (message, details = {}) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message,
        details,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
};

const run = async () => {
  const onboardingSecret = String(env.onboardingBootstrapSecret || "").trim();
  const platformOwnerCompanyId = env.platformOwnerCompanyId;

  if (!onboardingSecret) {
    fail("ONBOARDING_BOOTSTRAP_SECRET is missing.");
    return;
  }

  if (onboardingSecret.length < MIN_RECOMMENDED_BOOTSTRAP_SECRET_LENGTH) {
    fail("ONBOARDING_BOOTSTRAP_SECRET is too short for production.", {
      minRecommendedLength: MIN_RECOMMENDED_BOOTSTRAP_SECRET_LENGTH,
      actualLength: onboardingSecret.length,
    });
    return;
  }

  if (onboardingSecret.toLowerCase().includes("replace_with")) {
    fail("ONBOARDING_BOOTSTRAP_SECRET still looks like a placeholder value.");
    return;
  }

  if (!Number.isInteger(platformOwnerCompanyId) || platformOwnerCompanyId <= 0) {
    fail("PLATFORM_OWNER_COMPANY_ID must be set to a positive integer.");
    return;
  }

  const companyCheck = await pool.query(
    `
    SELECT id, company_code AS "companyCode", company_name AS "companyName", is_active AS "isActive"
    FROM companies
    WHERE id = $1
    LIMIT 1
    `,
    [platformOwnerCompanyId]
  );

  const ownerCompany = companyCheck.rows[0];

  if (!ownerCompany) {
    fail("PLATFORM_OWNER_COMPANY_ID does not exist in companies table.", {
      platformOwnerCompanyId,
    });
    return;
  }

  if (!ownerCompany.isActive) {
    fail("Platform owner company is inactive. Activate it before go-live.", {
      platformOwnerCompanyId,
      companyCode: ownerCompany.companyCode,
      companyName: ownerCompany.companyName,
    });
    return;
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        message: "Owner lock configuration verified successfully.",
        checks: {
          onboardingBootstrapSecretConfigured: true,
          onboardingBootstrapSecretLength: onboardingSecret.length,
          platformOwnerCompanyId,
          platformOwnerCompanyCode: ownerCompany.companyCode,
          platformOwnerCompanyName: ownerCompany.companyName,
          platformOwnerCompanyActive: true,
        },
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    fail("Owner lock verification failed unexpectedly.", {
      errorMessage: error?.message || String(error),
    });
  })
  .finally(async () => {
    await pool.end();
  });
