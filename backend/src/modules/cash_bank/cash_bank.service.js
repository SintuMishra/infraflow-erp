const { pool, withTransaction } = require("../../config/db");
const {
  createVoucher,
  submitVoucher,
  approveVoucher,
  postVoucher,
} = require("../general_ledger/general_ledger.model");

const requireCompanyId = (companyId) => {
  const normalized = Number(companyId || 0);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const listBankAccounts = async ({ companyId, activeOnly = false }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const filters = ["b.company_id = $1"];

  if (activeOnly) {
    filters.push("b.is_active = TRUE");
  }

  const result = await pool.query(
    `
    SELECT
      b.id,
      b.account_name AS "accountName",
      b.bank_name AS "bankName",
      b.branch_name AS "branchName",
      b.account_number AS "accountNumber",
      b.ifsc_code AS "ifscCode",
      b.ledger_id AS "ledgerId",
      l.ledger_name AS "ledgerName",
      b.is_default AS "isDefault",
      b.is_active AS "isActive",
      b.created_at AS "createdAt",
      b.updated_at AS "updatedAt"
    FROM bank_accounts b
    LEFT JOIN ledgers l ON l.id = b.ledger_id
    WHERE ${filters.join(" AND ")}
    ORDER BY b.is_default DESC, b.account_name ASC
    `,
    values
  );

  return result.rows;
};

const resolveLedgerMeta = async ({ companyId, ledgerId, db = pool }) => {
  const result = await db.query(
    `
    SELECT
      l.id,
      l.account_id AS "accountId",
      l.is_active AS "isActive",
      a.account_type AS "accountType",
      a.is_active AS "accountIsActive"
    FROM ledgers l
    INNER JOIN chart_of_accounts a ON a.id = l.account_id
    WHERE l.id = $1
      AND l.company_id = $2
    LIMIT 1
    `,
    [Number(ledgerId), companyId]
  );
  return result.rows[0] || null;
};

const createBankAccount = async ({
  companyId,
  accountName,
  bankName,
  branchName = "",
  accountNumber,
  ifscCode = "",
  ledgerId = null,
  isDefault = false,
  isActive = true,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);

  if (!String(accountName || "").trim() || !String(bankName || "").trim()) {
    const error = new Error("accountName and bankName are required");
    error.statusCode = 400;
    throw error;
  }

  if (!String(accountNumber || "").trim()) {
    const error = new Error("accountNumber is required");
    error.statusCode = 400;
    throw error;
  }

  if (ledgerId) {
    const ledger = await resolveLedgerMeta({
      companyId: normalizedCompanyId,
      ledgerId,
      db: pool,
    });
    if (!ledger || !ledger.isActive || !ledger.accountIsActive) {
      const error = new Error("ledgerId must reference an active ledger in company scope");
      error.statusCode = 400;
      throw error;
    }
    if (!["bank", "cash"].includes(String(ledger.accountType || "").toLowerCase())) {
      const error = new Error("ledgerId must reference a bank/cash account type");
      error.statusCode = 400;
      throw error;
    }
  }

  return withTransaction(async (db) => {
    if (isDefault) {
      await db.query(
        `
        UPDATE bank_accounts
        SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE company_id = $1
        `,
        [normalizedCompanyId]
      );
    }

    const result = await db.query(
      `
      INSERT INTO bank_accounts (
        company_id,
        account_name,
        bank_name,
        branch_name,
        account_number,
        ifsc_code,
        ledger_id,
        is_default,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING
        id,
        account_name AS "accountName",
        bank_name AS "bankName",
        branch_name AS "branchName",
        account_number AS "accountNumber",
        ifsc_code AS "ifscCode",
        ledger_id AS "ledgerId",
        is_default AS "isDefault",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        normalizedCompanyId,
        String(accountName).trim(),
        String(bankName).trim(),
        String(branchName || "").trim() || null,
        String(accountNumber).trim(),
        String(ifscCode || "").trim().toUpperCase() || null,
        ledgerId || null,
        Boolean(isDefault),
        Boolean(isActive),
      ]
    );

    return result.rows[0] || null;
  });
};

const updateBankAccountStatus = async ({ companyId, bankAccountId, isActive, isDefault = null }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedBankAccountId = Number(bankAccountId || 0) || null;
  if (!normalizedBankAccountId) {
    const error = new Error("Valid bankAccountId is required");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(async (db) => {
    const existingResult = await db.query(
      `
      SELECT
        id,
        is_active AS "isActive",
        is_default AS "isDefault"
      FROM bank_accounts
      WHERE id = $1
        AND company_id = $2
      FOR UPDATE
      `,
      [normalizedBankAccountId, normalizedCompanyId]
    );
    const existing = existingResult.rows[0] || null;
    if (!existing) {
      const error = new Error("Bank account not found");
      error.statusCode = 404;
      throw error;
    }

    const nextIsActive = Boolean(isActive);
    const nextIsDefault = isDefault === null ? existing.isDefault : Boolean(isDefault);

    if (!nextIsActive && nextIsDefault) {
      const replacement = await db.query(
        `
        SELECT id
        FROM bank_accounts
        WHERE company_id = $1
          AND id <> $2
          AND is_active = TRUE
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE
        `,
        [normalizedCompanyId, normalizedBankAccountId]
      );

      if (!replacement.rows[0]?.id) {
        const error = new Error("Cannot deactivate default bank account without another active bank account");
        error.statusCode = 409;
        throw error;
      }

      await db.query(
        `
        UPDATE bank_accounts
        SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE company_id = $1
        `,
        [normalizedCompanyId]
      );

      await db.query(
        `
        UPDATE bank_accounts
        SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND company_id = $2
        `,
        [replacement.rows[0].id, normalizedCompanyId]
      );
    } else if (nextIsDefault) {
      await db.query(
        `
        UPDATE bank_accounts
        SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE company_id = $1
        `,
        [normalizedCompanyId]
      );
    }

    const result = await db.query(
      `
      UPDATE bank_accounts
      SET
        is_active = $1,
        is_default = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND company_id = $4
      RETURNING
        id,
        account_name AS "accountName",
        bank_name AS "bankName",
        branch_name AS "branchName",
        account_number AS "accountNumber",
        ifsc_code AS "ifscCode",
        ledger_id AS "ledgerId",
        is_default AS "isDefault",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [nextIsActive, nextIsDefault && nextIsActive, normalizedBankAccountId, normalizedCompanyId]
    );

    return result.rows[0] || null;
  });
};

const createCashBankVoucher = async ({
  companyId,
  voucherType,
  voucherDate,
  amount,
  cashOrBankAccountId,
  counterAccountId,
  cashOrBankLedgerId,
  counterLedgerId,
  partyId = null,
  vendorId = null,
  narration = "",
  userId = null,
  autoPost = true,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedAmount = Number(amount || 0);
  if (!(normalizedAmount > 0)) {
    const error = new Error("amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  const normalizedType = String(voucherType || "").trim().toLowerCase();
  if (!["receipt", "payment", "contra"].includes(normalizedType)) {
    const error = new Error("voucherType must be receipt, payment, or contra");
    error.statusCode = 400;
    throw error;
  }

  if (!cashOrBankLedgerId && !cashOrBankAccountId) {
    const error = new Error("cashOrBankLedgerId or cashOrBankAccountId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!counterAccountId || !counterLedgerId) {
    const error = new Error("counterAccountId and counterLedgerId are required");
    error.statusCode = 400;
    throw error;
  }

  const bankLedger = cashOrBankLedgerId
    ? { id: Number(cashOrBankLedgerId) }
    : await pool.query(
        `
        SELECT ledger_id AS id
        FROM bank_accounts
        WHERE id = $1 AND company_id = $2 AND is_active = TRUE
        LIMIT 1
        `,
        [Number(cashOrBankAccountId), normalizedCompanyId]
      ).then((r) => r.rows[0] || null);

  if (!bankLedger?.id) {
    const error = new Error("Unable to resolve cash/bank ledger");
    error.statusCode = 400;
    throw error;
  }

  const cashOrBankLedgerMeta = await resolveLedgerMeta({
    companyId: normalizedCompanyId,
    ledgerId: Number(bankLedger.id),
    db: pool,
  });

  if (!cashOrBankLedgerMeta?.accountId || !cashOrBankLedgerMeta.isActive || !cashOrBankLedgerMeta.accountIsActive) {
    const error = new Error("Cash/bank ledger not found in company scope");
    error.statusCode = 400;
    throw error;
  }

  if (!["cash", "bank"].includes(String(cashOrBankLedgerMeta.accountType || "").toLowerCase())) {
    const error = new Error("cashOrBankLedger must be mapped to cash/bank account type");
    error.statusCode = 400;
    throw error;
  }

  const counterLedgerMeta = await resolveLedgerMeta({
    companyId: normalizedCompanyId,
    ledgerId: Number(counterLedgerId),
    db: pool,
  });
  if (!counterLedgerMeta?.accountId || !counterLedgerMeta.isActive || !counterLedgerMeta.accountIsActive) {
    const error = new Error("counterLedgerId must reference an active ledger in company scope");
    error.statusCode = 400;
    throw error;
  }

  if (Number(counterLedgerMeta.accountId) !== Number(counterAccountId)) {
    const error = new Error("counterAccountId and counterLedgerId mismatch");
    error.statusCode = 400;
    throw error;
  }

  const isReceipt = normalizedType === "receipt";
  const isContra = normalizedType === "contra";

  if (isContra) {
    const counterType = String(counterLedgerMeta.accountType || "").toLowerCase();
    if (!["cash", "bank"].includes(counterType)) {
      const error = new Error("Contra vouchers require both sides as cash/bank ledgers");
      error.statusCode = 400;
      throw error;
    }
  }

  const lines = [
    {
      accountId:
        isReceipt || isContra
          ? Number(cashOrBankLedgerMeta.accountId)
          : Number(counterAccountId),
      ledgerId: isReceipt || isContra ? Number(bankLedger.id) : Number(counterLedgerId),
      partyId: partyId || null,
      vendorId: vendorId || null,
      debit: normalizedAmount,
      credit: 0,
      lineNarration: isReceipt
        ? "Receipt into cash/bank"
        : isContra
          ? "Contra transfer debit"
          : "Counter account debit",
    },
    {
      accountId:
        isReceipt || isContra
          ? Number(counterAccountId)
          : Number(cashOrBankLedgerMeta.accountId),
      ledgerId: isReceipt || isContra ? Number(counterLedgerId) : Number(bankLedger.id),
      partyId: partyId || null,
      vendorId: vendorId || null,
      debit: 0,
      credit: normalizedAmount,
      lineNarration: isReceipt
        ? "Counter account credit"
        : isContra
          ? "Contra transfer credit"
          : "Payment from cash/bank",
    },
  ];

  return withTransaction(async (db) => {
    const voucher = await createVoucher({
      companyId: normalizedCompanyId,
      voucherType: normalizedType,
      voucherDate: String(voucherDate || "").trim(),
      approvalStatus: "draft",
      narration: String(narration || "").trim() || `${normalizedType} transaction`,
      lines,
      createdByUserId: userId,
      db,
    });

    if (!autoPost) {
      return voucher;
    }

    if (!Number(userId || 0)) {
      const error = new Error("userId is required for auto-post cash/bank voucher");
      error.statusCode = 400;
      throw error;
    }

    const submitted = await submitVoucher({
      voucherId: voucher.id,
      companyId: normalizedCompanyId,
      submittedByUserId: userId,
      db,
    });

    const approved = await approveVoucher({
      voucherId: submitted.id,
      companyId: normalizedCompanyId,
      approvedByUserId: userId,
      approvalNotes: "Auto-approved cash/bank voucher",
      db,
    });

    return postVoucher({
      voucherId: approved.id,
      companyId: normalizedCompanyId,
      postedByUserId: userId,
      db,
    });
  });
};

module.exports = {
  listBankAccounts,
  createBankAccount,
  updateBankAccountStatus,
  createCashBankVoucher,
};
