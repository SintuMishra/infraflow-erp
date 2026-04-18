const { pool, withTransaction } = require("../../config/db");
const {
  findPostingRule,
  createVoucher,
  postVoucher,
  upsertFinanceSourceLink,
} = require("../general_ledger/general_ledger.model");

const toCompanyId = (companyId) => {
  const normalized = Number(companyId || 0);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
};

const requireCompanyId = (companyId) => {
  const normalized = toCompanyId(companyId);
  if (!normalized) {
    const error = new Error("Valid company scope is required");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const getLedgerForAccount = async ({
  companyId,
  accountId,
  partyId = null,
  vendorId = null,
  ledgerId = null,
  db,
}) => {
  const params = [companyId, accountId];
  const conditions = ["company_id = $1", "account_id = $2", "is_active = TRUE"];

  if (ledgerId) {
    params.push(ledgerId);
    conditions.push(`id = $${params.length}`);
  }

  if (partyId) {
    params.push(partyId);
    conditions.push(`party_id = $${params.length}`);
  }

  if (vendorId) {
    params.push(vendorId);
    conditions.push(`vendor_id = $${params.length}`);
  }

  const result = await db.query(
    `
    SELECT id, account_id AS "accountId", ledger_name AS "ledgerName", party_id AS "partyId", vendor_id AS "vendorId"
    FROM ledgers
    WHERE ${conditions.join(" AND ")}
    ORDER BY is_system_generated DESC, id ASC
    LIMIT 1
    `,
    params
  );

  return result.rows[0] || null;
};

const listReceivables = async ({ companyId, status = "", partyId = null }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const values = [normalizedCompanyId];
  const filters = ["r.company_id = $1"];

  if (status) {
    values.push(String(status).trim().toLowerCase());
    filters.push(`r.status = $${values.length}`);
  }

  if (partyId) {
    values.push(Number(partyId));
    filters.push(`r.party_id = $${values.length}`);
  }

  const result = await pool.query(
    `
    SELECT
      r.id,
      r.party_id AS "partyId",
      p.party_name AS "partyName",
      r.dispatch_report_id AS "dispatchReportId",
      r.invoice_number AS "invoiceNumber",
      r.invoice_date AS "invoiceDate",
      r.due_date AS "dueDate",
      r.voucher_id AS "voucherId",
      r.amount,
      r.outstanding_amount AS "outstandingAmount",
      r.status,
      r.notes,
      GREATEST((CURRENT_DATE - r.due_date), 0)::int AS "overdueDays",
      CASE
        WHEN CURRENT_DATE <= r.due_date THEN 'current'
        WHEN CURRENT_DATE - r.due_date <= 30 THEN '1-30'
        WHEN CURRENT_DATE - r.due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - r.due_date <= 90 THEN '61-90'
        ELSE '90+'
      END AS "ageingBucket",
      r.created_at AS "createdAt",
      r.updated_at AS "updatedAt"
    FROM receivables r
    LEFT JOIN party_master p ON p.id = r.party_id
    WHERE ${filters.join(" AND ")}
    ORDER BY r.invoice_date DESC, r.id DESC
    `,
    values
  );

  return result.rows;
};

const markDispatchReadyForFinance = async ({ companyId, dispatchId, financeNotes = "", userId = null }) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedDispatchId = Number(dispatchId || 0) || null;
  if (!normalizedDispatchId) {
    const error = new Error("Valid dispatchId is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    UPDATE dispatch_reports
    SET
      can_post_to_finance = TRUE,
      finance_status = 'ready',
      finance_posting_state = 'queued',
      finance_notes = NULLIF(BTRIM(COALESCE($1, '')), ''),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND company_id = $3
    RETURNING
      id,
      invoice_number AS "invoiceNumber",
      invoice_date AS "invoiceDate",
      total_invoice_value AS "totalInvoiceValue",
      party_id AS "partyId",
      finance_status AS "financeStatus",
      can_post_to_finance AS "canPostToFinance",
      finance_posting_state AS "financePostingState"
    `,
    [String(financeNotes || "").trim() || null, normalizedDispatchId, normalizedCompanyId]
  );

  const row = result.rows[0] || null;
  if (!row) {
    const error = new Error("Dispatch not found in company scope");
    error.statusCode = 404;
    throw error;
  }

  const sourceLink = await upsertFinanceSourceLink({
    companyId: normalizedCompanyId,
    sourceModule: "dispatch",
    sourceRecordId: normalizedDispatchId,
    sourceEvent: "dispatch_to_receivable",
    postingStatus: "pending",
    metadata: {
      markedReadyByUserId: userId,
      financeNotes: String(financeNotes || "").trim() || null,
    },
  });

  await pool.query(
    `
    UPDATE dispatch_reports
    SET finance_source_link_id = $1
    WHERE id = $2 AND company_id = $3
    `,
    [sourceLink?.id || null, normalizedDispatchId, normalizedCompanyId]
  );

  return {
    ...row,
    sourceLinkId: sourceLink?.id || null,
  };
};

const createReceivableFromDispatch = async ({
  companyId,
  dispatchId,
  dueDate,
  notes = "",
  userId = null,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedDispatchId = Number(dispatchId || 0) || null;

  if (!normalizedDispatchId) {
    const error = new Error("Valid dispatchId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || "").trim())) {
    const error = new Error("dueDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(async (db) => {
    const dispatchResult = await db.query(
      `
      SELECT
        id,
        company_id AS "companyId",
        status,
        party_id AS "partyId",
        dispatch_date AS "dispatchDate",
        invoice_number AS "invoiceNumber",
        invoice_date AS "invoiceDate",
        COALESCE(total_invoice_value, invoice_value, 0)::numeric AS "invoiceAmount",
        finance_status AS "financeStatus",
        can_post_to_finance AS "canPostToFinance",
        finance_posting_state AS "financePostingState",
        plant_id AS "plantId",
        vehicle_id AS "vehicleId"
      FROM dispatch_reports
      WHERE id = $1 AND company_id = $2
      LIMIT 1
      `,
      [normalizedDispatchId, normalizedCompanyId]
    );

    const dispatch = dispatchResult.rows[0] || null;
    if (!dispatch) {
      const error = new Error("Dispatch not found in company scope");
      error.statusCode = 404;
      throw error;
    }

    if (String(dispatch.status || "").toLowerCase() !== "completed") {
      const error = new Error("Only completed dispatch records can be posted to receivables");
      error.statusCode = 409;
      throw error;
    }

    if (!dispatch.partyId) {
      const error = new Error("Dispatch must be linked to a party for receivable posting");
      error.statusCode = 400;
      throw error;
    }

    if (!dispatch.canPostToFinance || dispatch.financeStatus !== "ready") {
      const error = new Error(
        "Dispatch is not finance-ready. Mark dispatch ready before receivable posting"
      );
      error.statusCode = 409;
      throw error;
    }

    const existingReceivable = await db.query(
      `
      SELECT id
      FROM receivables
      WHERE company_id = $1 AND dispatch_report_id = $2
      LIMIT 1
      `,
      [normalizedCompanyId, normalizedDispatchId]
    );

    if (existingReceivable.rows[0]?.id) {
      const error = new Error("Receivable already exists for this dispatch");
      error.statusCode = 409;
      throw error;
    }

    const rule = await findPostingRule({
      companyId: normalizedCompanyId,
      sourceModule: "dispatch",
      eventName: "dispatch_to_receivable",
      db,
    });

    if (!rule) {
      const error = new Error("No active finance posting rule for dispatch_to_receivable");
      error.statusCode = 400;
      throw error;
    }

    const debitLedger = await getLedgerForAccount({
      companyId: normalizedCompanyId,
      accountId: rule.debitAccountId,
      partyId: dispatch.partyId,
      db,
    });

    const creditLedger = await getLedgerForAccount({
      companyId: normalizedCompanyId,
      accountId: rule.creditAccountId,
      db,
    });

    if (!debitLedger || !creditLedger) {
      const error = new Error(
        "Required ledgers are missing. Sync party ledgers and verify posting-rule control ledgers"
      );
      error.statusCode = 400;
      throw error;
    }

    const invoiceAmount = Number(dispatch.invoiceAmount || 0);
    if (!(invoiceAmount > 0)) {
      const error = new Error("Dispatch invoice value must be positive for receivable posting");
      error.statusCode = 400;
      throw error;
    }

    const derivedInvoiceDate = String(dispatch.invoiceDate || dispatch.dispatchDate || dueDate).slice(0, 10);
    if (String(dueDate).trim() < derivedInvoiceDate) {
      const error = new Error("dueDate cannot be before invoice date");
      error.statusCode = 400;
      throw error;
    }

    const voucher = await createVoucher({
      companyId: normalizedCompanyId,
      voucherType: rule.voucherType,
      voucherDate: derivedInvoiceDate,
      approvalStatus: rule.requiresApproval ? "pending" : "approved",
      narration: `Dispatch receivable posting for dispatch #${dispatch.id}`,
      sourceModule: "dispatch",
      sourceRecordId: dispatch.id,
      sourceEvent: "dispatch_to_receivable",
      createdByUserId: userId,
      lines: [
        {
          accountId: rule.debitAccountId,
          ledgerId: debitLedger.id,
          partyId: dispatch.partyId,
          plantId: dispatch.plantId || null,
          vehicleId: dispatch.vehicleId || null,
          debit: invoiceAmount,
          credit: 0,
          lineNarration: `Receivable for dispatch #${dispatch.id}`,
        },
        {
          accountId: rule.creditAccountId,
          ledgerId: creditLedger.id,
          partyId: dispatch.partyId,
          plantId: dispatch.plantId || null,
          vehicleId: dispatch.vehicleId || null,
          debit: 0,
          credit: invoiceAmount,
          lineNarration: `Revenue recognition for dispatch #${dispatch.id}`,
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

    const receivableInsert = await db.query(
      `
      INSERT INTO receivables (
        company_id,
        party_id,
        dispatch_report_id,
        invoice_number,
        invoice_date,
        due_date,
        voucher_id,
        amount,
        outstanding_amount,
        status,
        notes,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING
        id,
        party_id AS "partyId",
        dispatch_report_id AS "dispatchReportId",
        invoice_number AS "invoiceNumber",
        invoice_date AS "invoiceDate",
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
        dispatch.partyId,
        dispatch.id,
        dispatch.invoiceNumber || null,
        derivedInvoiceDate,
        String(dueDate).trim(),
        postedVoucher.id,
        invoiceAmount,
        invoiceAmount,
        "open",
        String(notes || "").trim() || null,
        userId || null,
        userId || null,
      ]
    );

    const sourceLink = await upsertFinanceSourceLink({
      companyId: normalizedCompanyId,
      sourceModule: "dispatch",
      sourceRecordId: dispatch.id,
      sourceEvent: "dispatch_to_receivable",
      postingRuleCode: rule.ruleCode,
      voucherId: postedVoucher.id,
      postingStatus: postedVoucher.status === "posted" ? "posted" : "pending",
      metadata: {
        receivableId: receivableInsert.rows[0]?.id || null,
      },
      db,
    });

    await db.query(
      `
      UPDATE dispatch_reports
      SET
        finance_status = 'posted',
        can_post_to_finance = FALSE,
        finance_posting_state = $1,
        finance_source_link_id = $2,
        finance_last_voucher_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND company_id = $5
      `,
      [postedVoucher.status === "posted" ? "posted" : "queued", sourceLink?.id || null, postedVoucher.id, dispatch.id, normalizedCompanyId]
    );

    return {
      receivable: receivableInsert.rows[0] || null,
      voucher: postedVoucher,
      sourceLink,
    };
  });
};

const settleReceivable = async ({
  companyId,
  receivableId,
  amount,
  settlementDate,
  referenceNumber = "",
  notes = "",
  bankLedgerId = null,
  userId = null,
}) => {
  const normalizedCompanyId = requireCompanyId(companyId);
  const normalizedReceivableId = Number(receivableId || 0) || null;
  const normalizedAmount = Number(amount || 0);

  if (!normalizedReceivableId) {
    const error = new Error("Valid receivableId is required");
    error.statusCode = 400;
    throw error;
  }

  if (!(normalizedAmount > 0)) {
    const error = new Error("Settlement amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(settlementDate || "").trim())) {
    const error = new Error("settlementDate must use YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(async (db) => {
    const receivableResult = await db.query(
      `
      SELECT
        id,
        party_id AS "partyId",
        dispatch_report_id AS "dispatchReportId",
        outstanding_amount AS "outstandingAmount",
        status,
        voucher_id AS "voucherId"
      FROM receivables
      WHERE id = $1 AND company_id = $2
      LIMIT 1
      `,
      [normalizedReceivableId, normalizedCompanyId]
    );

    const receivable = receivableResult.rows[0] || null;
    if (!receivable) {
      const error = new Error("Receivable not found");
      error.statusCode = 404;
      throw error;
    }

    if (!["open", "partial"].includes(receivable.status)) {
      const error = new Error("Only open/partial receivables can be settled");
      error.statusCode = 409;
      throw error;
    }

    if (receivable.voucherId) {
      const voucherState = await db.query(
        `
        SELECT status
        FROM vouchers
        WHERE id = $1 AND company_id = $2
        LIMIT 1
        `,
        [receivable.voucherId, normalizedCompanyId]
      );
      const sourceVoucherStatus = String(voucherState.rows[0]?.status || "").toLowerCase();
      if (sourceVoucherStatus !== "posted" && sourceVoucherStatus !== "reversed") {
        const error = new Error("Receivable source voucher is not posted yet; settlement blocked");
        error.statusCode = 409;
        throw error;
      }
    }

    if (normalizedAmount > Number(receivable.outstandingAmount || 0)) {
      const error = new Error("Settlement amount exceeds outstanding receivable");
      error.statusCode = 400;
      throw error;
    }

    const rule = await findPostingRule({
      companyId: normalizedCompanyId,
      sourceModule: "accounts_receivable",
      eventName: "receipt_settlement",
      db,
    });

    if (!rule) {
      const error = new Error("No active finance posting rule for receipt_settlement");
      error.statusCode = 400;
      throw error;
    }

    const debitLedger = bankLedgerId
      ? await getLedgerForAccount({
          companyId: normalizedCompanyId,
          accountId: rule.debitAccountId,
          ledgerId: Number(bankLedgerId),
          db,
        })
      : await getLedgerForAccount({
          companyId: normalizedCompanyId,
          accountId: rule.debitAccountId,
          db,
        });

    const creditLedger = await getLedgerForAccount({
      companyId: normalizedCompanyId,
      accountId: rule.creditAccountId,
      partyId: receivable.partyId,
      db,
    });

    if (!debitLedger || !creditLedger) {
      const error = new Error("Settlement ledgers missing. Verify receipt posting rule and party ledgers");
      error.statusCode = 400;
      throw error;
    }

    const voucher = await createVoucher({
      companyId: normalizedCompanyId,
      voucherType: "receipt",
      voucherDate: String(settlementDate).trim(),
      approvalStatus: rule.requiresApproval ? "pending" : "approved",
      narration: `Receipt settlement against receivable #${receivable.id}`,
      sourceModule: "accounts_receivable",
      sourceRecordId: receivable.id,
      createdByUserId: userId,
      lines: [
        {
          accountId: rule.debitAccountId,
          ledgerId: bankLedgerId || debitLedger.id,
          debit: normalizedAmount,
          credit: 0,
          partyId: receivable.partyId,
          lineNarration: `Receipt collection for receivable #${receivable.id}`,
        },
        {
          accountId: rule.creditAccountId,
          ledgerId: creditLedger.id,
          debit: 0,
          credit: normalizedAmount,
          partyId: receivable.partyId,
          lineNarration: `AR settlement for receivable #${receivable.id}`,
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

    const settlementInsert = await db.query(
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
      VALUES ($1,'receipt',$2,'receivable',$3,$4,$5,$6,$7,$8)
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
        String(settlementDate).trim(),
        receivable.id,
        postedVoucher.id,
        normalizedAmount,
        String(referenceNumber || "").trim() || null,
        String(notes || "").trim() || null,
        userId || null,
      ]
    );

    const nextOutstanding = Number(receivable.outstandingAmount || 0) - normalizedAmount;
    const nextStatus = nextOutstanding <= 0 ? "settled" : "partial";

    await db.query(
      `
      UPDATE receivables
      SET
        outstanding_amount = $1,
        status = $2,
        updated_by_user_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND company_id = $5
      `,
      [Math.max(nextOutstanding, 0), nextStatus, userId || null, receivable.id, normalizedCompanyId]
    );

    if (receivable.dispatchReportId) {
      await db.query(
        `
        UPDATE dispatch_reports
        SET
          finance_status = $1,
          finance_posting_state = 'posted',
          finance_last_voucher_id = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND company_id = $4
        `,
        [nextStatus === "settled" ? "settled" : "partially_settled", postedVoucher.id, receivable.dispatchReportId, normalizedCompanyId]
      );
    }

    await upsertFinanceSourceLink({
      companyId: normalizedCompanyId,
      sourceModule: "accounts_receivable",
      sourceRecordId: receivable.id,
      sourceEvent: `receipt_settlement:${settlementInsert.rows[0]?.id || "na"}`,
      postingRuleCode: rule.ruleCode,
      voucherId: postedVoucher.id,
      postingStatus: postedVoucher.status === "posted" ? "posted" : "pending",
      metadata: {
        settlementId: settlementInsert.rows[0]?.id || null,
        amount: normalizedAmount,
      },
      db,
    });

    return {
      settlement: settlementInsert.rows[0] || null,
      voucher: postedVoucher,
      receivableStatus: nextStatus,
      outstandingAmount: Math.max(nextOutstanding, 0),
    };
  });
};

module.exports = {
  listReceivables,
  markDispatchReadyForFinance,
  createReceivableFromDispatch,
  settleReceivable,
};
