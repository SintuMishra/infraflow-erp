const { pool, withTransaction } = require("../../config/db");
const {
  findPostingRule,
  createVoucher,
  postVoucher,
  upsertFinanceSourceLink,
} = require("../general_ledger/general_ledger.model");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateOnly = (value, fieldName = "date") => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value || "").trim();
  if (!raw) {
    const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
    error.statusCode = 400;
    throw error;
  }

  const isoCandidate = raw.slice(0, 10);
  if (ISO_DATE_PATTERN.test(isoCandidate)) {
    return isoCandidate;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const error = new Error(`${fieldName} must use YYYY-MM-DD format`);
  error.statusCode = 400;
  throw error;
};

const requireCompanyId = (companyId) => {
  const normalized = Number(companyId || 0);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const getLedgerForAccount = async ({ companyId, accountId, partyId = null, vendorId = null, db }) => {
  const values = [companyId, accountId];
  const where = ["company_id = $1", "account_id = $2", "is_active = TRUE"];

  if (partyId) {
    values.push(partyId);
    where.push(`party_id = $${values.length}`);
  }

  if (vendorId) {
    values.push(vendorId);
    where.push(`vendor_id = $${values.length}`);
  }

  const result = await db.query(
    `
    SELECT id, account_id AS "accountId", ledger_name AS "ledgerName"
    FROM ledgers
    WHERE ${where.join(" AND ")}
    ORDER BY is_system_generated DESC, id ASC
    LIMIT 1
    `,
    values
  );

  return result.rows[0] || null;
};

const assertCounterpartyExists = async ({ companyId, partyId = null, vendorId = null, db }) => {
  if (partyId) {
    const partyResult = await db.query(
      `
      SELECT id
      FROM party_master
      WHERE id = $1
        AND company_id = $2
      LIMIT 1
      `,
      [Number(partyId), companyId]
    );
    if (!partyResult.rows[0]?.id) {
      const error = new Error("partyId is not valid in company scope");
      error.statusCode = 400;
      throw error;
    }
  }

  if (vendorId) {
    const vendorResult = await db.query(
      `
      SELECT id
      FROM vendor_master
      WHERE id = $1
        AND company_id = $2
      LIMIT 1
      `,
      [Number(vendorId), companyId]
    );
    if (!vendorResult.rows[0]?.id) {
      const error = new Error("vendorId is not valid in company scope");
      error.statusCode = 400;
      throw error;
    }
  }
};

const resolveSettlementBankOrCashLedger = async ({
  companyId,
  preferredLedgerId = null,
  expectedAccountId,
  db,
}) => {
  if (!preferredLedgerId) {
    return getLedgerForAccount({
      companyId,
      accountId: expectedAccountId,
      db,
    });
  }

  const selected = await db.query(
    `
    SELECT
      l.id,
      l.account_id AS "accountId",
      l.is_active AS "isActive",
      a.is_active AS "accountIsActive",
      a.account_type AS "accountType",
      b.id AS "bankAccountId",
      b.is_active AS "bankAccountIsActive"
    FROM ledgers l
    INNER JOIN chart_of_accounts a ON a.id = l.account_id
    LEFT JOIN bank_accounts b ON b.ledger_id = l.id AND b.company_id = l.company_id
    WHERE l.id = $1
      AND l.company_id = $2
    LIMIT 1
    `,
    [Number(preferredLedgerId), companyId]
  );
  const row = selected.rows[0] || null;
  if (!row?.id || !row.isActive || !row.accountIsActive) {
    const error = new Error("Selected cash/bank ledger is not active in company scope");
    error.statusCode = 400;
    throw error;
  }

  if (Number(row.accountId) !== Number(expectedAccountId)) {
    const error = new Error("Selected cash/bank ledger does not match payment posting rule account");
    error.statusCode = 400;
    throw error;
  }

  const accountType = String(row.accountType || "").toLowerCase();
  if (!["cash", "bank"].includes(accountType)) {
    const error = new Error("Selected ledger must belong to cash/bank account type");
    error.statusCode = 400;
    throw error;
  }

  if (accountType === "bank") {
    if (!row.bankAccountId || !row.bankAccountIsActive) {
      const error = new Error("Selected bank ledger is not mapped to an active bank account");
      error.statusCode = 400;
      throw error;
    }
  }

  return row;
};

const buildSettlementSourceEvent = ({ payableId, settlementDate, amount, referenceNumber }) =>
  `payment_settlement:${payableId}:${settlementDate}:${Number(amount).toFixed(2)}:${String(referenceNumber || "").trim().toLowerCase() || "na"}`;

const listPayables = async ({ companyId, status = "", vendorId = null, partyId = null }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const filters = ["p.company_id = $1"];

  if (status) {
    values.push(String(status).trim().toLowerCase());
    filters.push(`p.status = $${values.length}`);
  }

  if (vendorId) {
    values.push(Number(vendorId));
    filters.push(`p.vendor_id = $${values.length}`);
  }

  if (partyId) {
    values.push(Number(partyId));
    filters.push(`p.party_id = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      p.id,
      p.party_id AS "partyId",
      pr.party_name AS "partyName",
      p.vendor_id AS "vendorId",
      vd.vendor_name AS "vendorName",
      p.reference_number AS "referenceNumber",
      p.bill_date AS "billDate",
      p.due_date AS "dueDate",
      p.voucher_id AS "voucherId",
      p.amount,
      p.outstanding_amount AS "outstandingAmount",
      p.status,
      p.notes,
      GREATEST((CURRENT_DATE - p.due_date), 0)::int AS "overdueDays",
      CASE
        WHEN CURRENT_DATE <= p.due_date THEN 'current'
        WHEN CURRENT_DATE - p.due_date <= 30 THEN '1-30'
        WHEN CURRENT_DATE - p.due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - p.due_date <= 90 THEN '61-90'
        ELSE '90+'
      END AS "ageingBucket",
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM payables p
    LEFT JOIN party_master pr ON pr.id = p.party_id
    LEFT JOIN vendor_master vd ON vd.id = p.vendor_id
    WHERE ${filters.join(" AND ")}
    ORDER BY p.bill_date DESC, p.id DESC
    `,
    values
  );

  return result.rows;
};

const createPayable = async ({
  companyId,
  partyId = null,
  vendorId = null,
  referenceNumber = "",
  billDate,
  dueDate,
  amount,
  notes = "",
  userId = null,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedAmount = Number(amount || 0);

  if (Boolean(partyId) === Boolean(vendorId)) {
    const error = new Error("Provide exactly one counterparty: either partyId or vendorId");
    error.statusCode = 400;
    throw error;
  }

  if (!(normalizedAmount > 0)) {
    const error = new Error("amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  const normalizedBillDate = String(billDate || "").trim();
  const normalizedDueDate = String(dueDate || "").trim();
  if (!ISO_DATE_PATTERN.test(normalizedBillDate)) {
    const error = new Error("billDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }
  if (!ISO_DATE_PATTERN.test(normalizedDueDate)) {
    const error = new Error("dueDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }
  if (normalizedDueDate < normalizedBillDate) {
    const error = new Error("dueDate cannot be before billDate");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(async (db) => {
    await assertCounterpartyExists({
      companyId: normalizedCompanyId,
      partyId,
      vendorId,
      db,
    });

    const rule = await findPostingRule({
      companyId: normalizedCompanyId,
      sourceModule: "accounts_payable",
      eventName: "bill_to_payable",
      db,
    });

    if (!rule) {
      const error = new Error("No active finance posting rule for bill_to_payable");
      error.statusCode = 400;
      throw error;
    }

    const debitLedger = await getLedgerForAccount({
      companyId: normalizedCompanyId,
      accountId: rule.debitAccountId,
      db,
    });

    const creditLedger = await getLedgerForAccount({
      companyId: normalizedCompanyId,
      accountId: rule.creditAccountId,
      partyId,
      vendorId,
      db,
    });

    if (!debitLedger || !creditLedger) {
      const error = new Error("Required ledgers are missing for payable posting");
      error.statusCode = 400;
      throw error;
    }

    if (rule.partyRequired && !partyId) {
      const error = new Error("Selected posting rule requires partyId");
      error.statusCode = 400;
      throw error;
    }

    if (rule.vendorRequired && !vendorId) {
      const error = new Error("Selected posting rule requires vendorId");
      error.statusCode = 400;
      throw error;
    }

    const payableInsert = await db.query(
      `
      INSERT INTO payables (
        company_id,
        party_id,
        vendor_id,
        reference_number,
        bill_date,
        due_date,
        voucher_id,
        amount,
        outstanding_amount,
        status,
        notes,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,'open',$9,$10,$11)
      RETURNING
        id,
        party_id AS "partyId",
        vendor_id AS "vendorId",
        reference_number AS "referenceNumber",
        bill_date AS "billDate",
        due_date AS "dueDate",
        voucher_id AS "voucherId",
        amount,
        outstanding_amount AS "outstandingAmount",
        status,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        normalizedCompanyId,
        partyId || null,
        vendorId || null,
        String(referenceNumber || "").trim() || null,
        normalizedBillDate,
        normalizedDueDate,
        normalizedAmount,
        normalizedAmount,
        String(notes || "").trim() || null,
        userId || null,
        userId || null,
      ]
    );

    const payable = payableInsert.rows[0] || null;

    const voucher = await createVoucher({
      companyId: normalizedCompanyId,
      voucherType: rule.voucherType,
      voucherDate: normalizedBillDate,
      approvalStatus: rule.requiresApproval ? "submitted" : "approved",
      narration: `Payable bill posting: ${String(referenceNumber || "").trim() || "manual"}`,
      sourceModule: "accounts_payable",
      sourceRecordId: payable.id,
      sourceEvent: "bill_to_payable",
      createdByUserId: userId,
      lines: [
        {
          accountId: rule.debitAccountId,
          ledgerId: debitLedger.id,
          partyId: partyId || null,
          vendorId: vendorId || null,
          debit: normalizedAmount,
          credit: 0,
          lineNarration: "Expense/bill recognition",
        },
        {
          accountId: rule.creditAccountId,
          ledgerId: creditLedger.id,
          partyId: partyId || null,
          vendorId: vendorId || null,
          debit: 0,
          credit: normalizedAmount,
          lineNarration: "AP control recognition",
        },
      ],
      db,
    });

    const postedVoucher = rule.requiresApproval
      ? voucher
      : await postVoucher({
          voucherId: voucher.id,
          companyId: normalizedCompanyId,
          postedByUserId: userId,
          db,
        });

    await db.query(
      `
      UPDATE payables
      SET
        voucher_id = $1,
        updated_by_user_id = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND company_id = $4
      `,
      [postedVoucher.id, userId || null, payable.id, normalizedCompanyId]
    );

    await upsertFinanceSourceLink({
      companyId: normalizedCompanyId,
      sourceModule: "accounts_payable",
      sourceRecordId: payable.id,
      sourceEvent: "bill_to_payable",
      postingRuleCode: rule.ruleCode,
      voucherId: postedVoucher.id,
      postingStatus: postedVoucher.status === "posted" ? "posted" : "pending",
      metadata: {
        partyId: partyId || null,
        vendorId: vendorId || null,
        payableId: payable.id,
      },
      db,
    });

    return {
      payable: {
        ...payable,
        voucherId: postedVoucher.id,
      },
      voucher: postedVoucher,
    };
  });
};

const settlePayable = async ({
  companyId,
  payableId,
  amount,
  settlementDate,
  referenceNumber = "",
  notes = "",
  bankLedgerId = null,
  userId = null,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedPayableId = Number(payableId || 0) || null;
  const normalizedAmount = Number(amount || 0);
  const normalizedSettlementDate = String(settlementDate || "").trim();
  const normalizedReference = String(referenceNumber || "").trim() || null;

  if (!normalizedPayableId) {
    const error = new Error("Valid payableId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!(normalizedAmount > 0)) {
    const error = new Error("amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  if (!ISO_DATE_PATTERN.test(normalizedSettlementDate)) {
    const error = new Error("settlementDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(async (db) => {
    const payableResult = await db.query(
      `
      SELECT
        id,
        party_id AS "partyId",
        vendor_id AS "vendorId",
        bill_date AS "billDate",
        outstanding_amount AS "outstandingAmount",
        status,
        voucher_id AS "voucherId"
      FROM payables
      WHERE id = $1 AND company_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [normalizedPayableId, normalizedCompanyId]
    );

    const payable = payableResult.rows[0] || null;
    if (!payable) {
      const error = new Error("Payable not found");
      error.statusCode = 404;
      throw error;
    }

    if (!["open", "partial"].includes(payable.status)) {
      const error = new Error("Only open/partial payables can be settled");
      error.statusCode = 409;
      throw error;
    }

    if (payable.voucherId) {
      const voucherState = await db.query(
        `
        SELECT status
        FROM vouchers
        WHERE id = $1 AND company_id = $2
        LIMIT 1
        `,
        [payable.voucherId, normalizedCompanyId]
      );
      const sourceVoucherStatus = String(voucherState.rows[0]?.status || "").toLowerCase();
      if (sourceVoucherStatus !== "posted") {
        const error = new Error("Payable source voucher is not posted yet; settlement blocked");
        error.statusCode = 409;
        throw error;
      }
    }

    if (normalizedAmount > Number(payable.outstandingAmount || 0)) {
      const error = new Error("Settlement amount exceeds outstanding payable");
      error.statusCode = 400;
      throw error;
    }

    const payableBillDate = toDateOnly(payable.billDate, "payable billDate");
    if (normalizedSettlementDate < payableBillDate) {
      const error = new Error("settlementDate cannot be before payable billDate");
      error.statusCode = 400;
      throw error;
    }

    const rule = await findPostingRule({
      companyId: normalizedCompanyId,
      sourceModule: "accounts_payable",
      eventName: "payment_settlement",
      db,
    });

    if (!rule) {
      const error = new Error("No active finance posting rule for payment_settlement");
      error.statusCode = 400;
      throw error;
    }

    if (rule.requiresApproval) {
      const error = new Error("Settlement vouchers requiring approval are not supported in this flow");
      error.statusCode = 409;
      throw error;
    }

    const debitLedger = await getLedgerForAccount({
      companyId: normalizedCompanyId,
      accountId: rule.debitAccountId,
      partyId: payable.partyId,
      vendorId: payable.vendorId,
      db,
    });

    const creditLedger = await resolveSettlementBankOrCashLedger({
      companyId: normalizedCompanyId,
      preferredLedgerId: bankLedgerId ? Number(bankLedgerId) : null,
      expectedAccountId: rule.creditAccountId,
      db,
    });

    if (!debitLedger || !creditLedger) {
      const error = new Error("Settlement ledgers missing. Verify payment posting rule and party/vendor ledgers");
      error.statusCode = 400;
      throw error;
    }

    const sourceEvent = buildSettlementSourceEvent({
      payableId: payable.id,
      settlementDate: normalizedSettlementDate,
      amount: normalizedAmount,
      referenceNumber: normalizedReference,
    });

    // Idempotency strategy mirrors AR settlements: one semantic settlement event maps to one source-link.
    const existingSettlementLink = await db.query(
      `
      SELECT voucher_id AS "voucherId"
      FROM finance_source_links
      WHERE company_id = $1
        AND source_module = 'accounts_payable'
        AND source_record_id = $2
        AND source_event = $3
      LIMIT 1
      `,
      [normalizedCompanyId, payable.id, sourceEvent]
    );
    const existingVoucherId = existingSettlementLink.rows[0]?.voucherId || null;
    if (existingVoucherId) {
      const settlementResult = await db.query(
        `
        SELECT
          id,
          settlement_type AS "settlementType",
          settlement_date AS "settlementDate",
          source_document_type AS "sourceDocumentType",
          source_document_id AS "sourceDocumentId",
          voucher_id AS "voucherId",
          amount,
          reference_number AS "referenceNumber",
          notes,
          created_at AS "createdAt"
        FROM settlements
        WHERE company_id = $1
          AND source_document_type = 'payable'
          AND source_document_id = $2
          AND voucher_id = $3
        ORDER BY id DESC
        LIMIT 1
        `,
        [normalizedCompanyId, payable.id, existingVoucherId]
      );

      return {
        idempotent: true,
        settlement: settlementResult.rows[0] || null,
        voucher: { id: existingVoucherId, status: "posted" },
        payableStatus: payable.status,
        outstandingAmount: Number(payable.outstandingAmount || 0),
      };
    }

    const voucher = await createVoucher({
      companyId: normalizedCompanyId,
      voucherType: "payment",
      voucherDate: normalizedSettlementDate,
      approvalStatus: "approved",
      narration: `Payment settlement against payable #${payable.id}`,
      sourceModule: "accounts_payable",
      sourceRecordId: payable.id,
      sourceEvent,
      createdByUserId: null,
      lines: [
        {
          accountId: rule.debitAccountId,
          ledgerId: debitLedger.id,
          partyId: payable.partyId,
          vendorId: payable.vendorId,
          debit: normalizedAmount,
          credit: 0,
          lineNarration: `AP settlement for payable #${payable.id}`,
        },
        {
          accountId: rule.creditAccountId,
          ledgerId: creditLedger.id,
          partyId: payable.partyId,
          vendorId: payable.vendorId,
          debit: 0,
          credit: normalizedAmount,
          lineNarration: `Payment against payable #${payable.id}`,
        },
      ],
      db,
    });

    const postedVoucher = await postVoucher({
      voucherId: voucher.id,
      companyId: normalizedCompanyId,
      postedByUserId: userId,
      db,
    });

    const settlementResult = await db.query(
      `
      INSERT INTO settlements (
        company_id,
        settlement_type,
        settlement_date,
        source_document_type,
        source_document_id,
        voucher_id,
        amount,
        reference_number,
        notes,
        created_by_user_id
      )
      VALUES ($1,'payment',$2,'payable',$3,$4,$5,$6,$7,$8)
      RETURNING
        id,
        settlement_type AS "settlementType",
        settlement_date AS "settlementDate",
        source_document_type AS "sourceDocumentType",
        source_document_id AS "sourceDocumentId",
        voucher_id AS "voucherId",
        amount,
        reference_number AS "referenceNumber",
        notes,
        created_at AS "createdAt"
      `,
      [
        normalizedCompanyId,
        normalizedSettlementDate,
        payable.id,
        postedVoucher.id,
        normalizedAmount,
        normalizedReference,
        String(notes || "").trim() || null,
        userId || null,
      ]
    );

    const nextOutstanding = Number(payable.outstandingAmount || 0) - normalizedAmount;
    const nextStatus = nextOutstanding <= 0 ? "settled" : "partial";

    await db.query(
      `
      UPDATE payables
      SET
        outstanding_amount = $1,
        status = $2,
        updated_by_user_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND company_id = $5
      `,
      [Math.max(nextOutstanding, 0), nextStatus, userId || null, payable.id, normalizedCompanyId]
    );

    await upsertFinanceSourceLink({
      companyId: normalizedCompanyId,
      sourceModule: "accounts_payable",
      sourceRecordId: payable.id,
      sourceEvent,
      postingRuleCode: rule.ruleCode,
      voucherId: postedVoucher.id,
      postingStatus: postedVoucher.status === "posted" ? "posted" : "pending",
      metadata: {
        settlementId: settlementResult.rows[0]?.id || null,
        amount: normalizedAmount,
        referenceNumber: normalizedReference,
      },
      db,
    });

    return {
      settlement: settlementResult.rows[0] || null,
      voucher: postedVoucher,
      payableStatus: nextStatus,
      outstandingAmount: Math.max(nextOutstanding, 0),
    };
  });
};

module.exports = {
  listPayables,
  createPayable,
  settlePayable,
};
