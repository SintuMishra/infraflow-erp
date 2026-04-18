const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_NAME = process.env.DB_NAME || 'construction_erp_db';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const { pool } = require('../src/config/db');
const {
  bootstrapDefaultAccounts,
  syncPartyAndVendorLedgers,
  updateAccountingPeriodStatus,
} = require('../src/modules/accounts_masters/accounts_masters.service');
const {
  createReceivableFromDispatch,
  settleReceivable,
} = require('../src/modules/accounts_receivable/accounts_receivable.service');
const {
  createVoucher,
  submitVoucher,
  approveVoucher,
  postVoucher,
  getVoucherById,
} = require('../src/modules/general_ledger/general_ledger.model');

const ACCOUNTING_TEST_DATE = '2026-04-18';
const ACCOUNTING_TEST_DUE_DATE = '2026-04-30';

const makeCode = (prefix) =>
  `${prefix}${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 6)}`
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 20);

const ensurePhase4Prerequisites = async (t) => {
  const integrationEnabled = ["1", "true", "yes"].includes(
    String(process.env.FINANCE_DB_INTEGRATION_TESTS || "").trim().toLowerCase()
  );
  if (!integrationEnabled) {
    t.skip("Set FINANCE_DB_INTEGRATION_TESTS=true to run DB concurrency tests");
    return false;
  }

  let check;
  try {
    check = await pool.query(
      `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'vouchers'
            AND column_name = 'submitted_by_user_id'
        ) AS "hasVoucherActors",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'finance_transition_logs'
        ) AS "hasTransitionLogs",
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = 'finance_policy_controls'
        ) AS "hasPolicyControls"
      `
    );
  } catch (error) {
    t.skip(`DB integration is not reachable in this environment (${error.code || "unknown"})`);
    return false;
  }

  if (
    !check.rows[0]?.hasVoucherActors ||
    !check.rows[0]?.hasTransitionLogs ||
    !check.rows[0]?.hasPolicyControls
  ) {
    t.skip('Phase-4 migrations are not applied in local DB');
    return false;
  }

  return true;
};

const createCompanyFixture = async () => {
  const code = makeCode('FIN');
  const companyResult = await pool.query(
    `
    INSERT INTO companies (company_code, company_name, is_active)
    VALUES ($1, $2, TRUE)
    RETURNING id
    `,
    [code, `Finance Test ${code}`]
  );
  const companyId = companyResult.rows[0].id;

  await bootstrapDefaultAccounts({ companyId, userId: 1 });

  const yearResult = await pool.query(
    `
    INSERT INTO financial_years (company_id, fy_code, fy_name, start_date, end_date, is_closed, is_active)
    VALUES ($1, $2, $3, DATE '2026-04-01', DATE '2027-03-31', FALSE, TRUE)
    RETURNING id
    `,
    [companyId, makeCode('FY26'), `FY ${code}`]
  );

  await pool.query(
    `
    INSERT INTO accounting_periods (
      company_id,
      financial_year_id,
      period_code,
      period_name,
      period_start,
      period_end,
      status
    )
    VALUES ($1, $2, $3, $4, DATE '2026-04-01', DATE '2027-03-31', 'open')
    `,
    [companyId, yearResult.rows[0].id, makeCode('P26'), `Period ${code}`]
  );

  const partyResult = await pool.query(
    `
    INSERT INTO party_master (company_id, party_name, party_type, is_active)
    VALUES ($1, $2, 'customer', TRUE)
    RETURNING id
    `,
    [companyId, `Party ${code}`]
  );

  await syncPartyAndVendorLedgers({ companyId });

  return {
    companyId,
    partyId: partyResult.rows[0].id,
    cleanup: async () => {},
  };
};

const getAccountId = async (companyId, accountCode) => {
  const result = await pool.query(
    `SELECT id FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 LIMIT 1`,
    [companyId, accountCode]
  );
  return result.rows[0]?.id || null;
};

const getLedgerId = async ({ companyId, accountId, partyId = null }) => {
  const result = await pool.query(
    `
    SELECT id
    FROM ledgers
    WHERE company_id = $1
      AND account_id = $2
      AND ($3::bigint IS NULL OR party_id = $3)
      AND is_active = TRUE
    ORDER BY id ASC
    LIMIT 1
    `,
    [companyId, accountId, partyId]
  );
  return result.rows[0]?.id || null;
};

const insertDispatchReady = async ({ companyId, partyId, amount = 1200 }) => {
  const result = await pool.query(
    `
    INSERT INTO dispatch_reports (
      dispatch_date,
      source_type,
      source_name,
      material_type,
      vehicle_number,
      destination_name,
      quantity_tons,
      company_id,
      status,
      party_id,
      invoice_number,
      invoice_date,
      invoice_value,
      total_invoice_value,
      finance_status,
      can_post_to_finance,
      finance_posting_state
    )
    VALUES (
      $1::date,
      'plant',
      'Plant A',
      'Aggregate',
      'MH12AA0001',
      'Site A',
      10,
      $2,
      'completed',
      $3,
      $4,
      $1::date,
      $5,
      $5,
      'ready',
      TRUE,
      'queued'
    )
    RETURNING id
    `,
    [ACCOUNTING_TEST_DATE, companyId, partyId, `INV-${makeCode('D')}`, amount]
  );
  return result.rows[0].id;
};

test('concurrency: duplicate dispatch to receivable remains idempotent', async (t) => {
  if (!(await ensurePhase4Prerequisites(t))) {
    return;
  }
  const fx = await createCompanyFixture();
  try {
    const dispatchId = await insertDispatchReady({
      companyId: fx.companyId,
      partyId: fx.partyId,
      amount: 2500,
    });

    const [first, second] = await Promise.all([
      createReceivableFromDispatch({
        companyId: fx.companyId,
        dispatchId,
        dueDate: ACCOUNTING_TEST_DUE_DATE,
        userId: 11,
      }),
      createReceivableFromDispatch({
        companyId: fx.companyId,
        dispatchId,
        dueDate: ACCOUNTING_TEST_DUE_DATE,
        userId: 12,
      }),
    ]);

    assert.equal(Boolean(first.receivable?.id), true);
    assert.equal(Boolean(second.receivable?.id), true);

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM receivables WHERE company_id = $1 AND dispatch_report_id = $2`,
      [fx.companyId, dispatchId]
    );
    assert.equal(Number(countRes.rows[0].total), 1);
  } finally {
    await fx.cleanup();
  }
});

test('concurrency: two users settling same receivable cannot oversettle', async (t) => {
  if (!(await ensurePhase4Prerequisites(t))) {
    return;
  }
  const fx = await createCompanyFixture();
  try {
    const receivableInsert = await pool.query(
      `
      INSERT INTO receivables (
        company_id, party_id, invoice_number, invoice_date, due_date, amount, outstanding_amount, status, created_by_user_id
      )
      VALUES ($1, $2, $3, $4::date, $5::date, 1000, 1000, 'open', 1)
      RETURNING id
      `,
      [fx.companyId, fx.partyId, `AR-${makeCode('R')}`, ACCOUNTING_TEST_DATE, ACCOUNTING_TEST_DUE_DATE]
    );

    const receivableId = receivableInsert.rows[0].id;

    const outcomes = await Promise.allSettled([
      settleReceivable({
        companyId: fx.companyId,
        receivableId,
        amount: 700,
        settlementDate: ACCOUNTING_TEST_DATE,
        referenceNumber: `RCPT-${makeCode('A')}`,
        userId: 21,
      }),
      settleReceivable({
        companyId: fx.companyId,
        receivableId,
        amount: 700,
        settlementDate: ACCOUNTING_TEST_DATE,
        referenceNumber: `RCPT-${makeCode('B')}`,
        userId: 22,
      }),
    ]);

    const fulfilled = outcomes.filter((item) => item.status === 'fulfilled').length;
    const rejected = outcomes.filter((item) => item.status === 'rejected').length;

    assert.equal(fulfilled, 1);
    assert.equal(rejected, 1);

    const stateRes = await pool.query(
      `SELECT outstanding_amount AS "outstandingAmount" FROM receivables WHERE id = $1 AND company_id = $2`,
      [receivableId, fx.companyId]
    );

    assert.equal(Number(stateRes.rows[0].outstandingAmount), 300);
  } finally {
    await fx.cleanup();
  }
});

test('concurrency: two users posting same voucher results in one posted voucher', async (t) => {
  if (!(await ensurePhase4Prerequisites(t))) {
    return;
  }
  const fx = await createCompanyFixture();
  try {
    const arAccountId = await getAccountId(fx.companyId, 'AR_CONTROL');
    const revAccountId = await getAccountId(fx.companyId, 'REV_DISPATCH');
    const arLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: arAccountId, partyId: fx.partyId });
    const revLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: revAccountId });

    const voucher = await createVoucher({
      companyId: fx.companyId,
      voucherType: 'journal',
      voucherDate: ACCOUNTING_TEST_DATE,
      approvalStatus: 'draft',
      narration: 'Concurrency post test',
      createdByUserId: 31,
      lines: [
        { accountId: arAccountId, ledgerId: arLedgerId, partyId: fx.partyId, debit: 500, credit: 0 },
        { accountId: revAccountId, ledgerId: revLedgerId, credit: 500, debit: 0 },
      ],
    });

    await submitVoucher({
      voucherId: voucher.id,
      companyId: fx.companyId,
      submittedByUserId: 31,
    });

    await approveVoucher({
      voucherId: voucher.id,
      companyId: fx.companyId,
      approvedByUserId: 32,
      approvalNotes: 'approved',
    });

    const [first, second] = await Promise.all([
      postVoucher({ voucherId: voucher.id, companyId: fx.companyId, postedByUserId: 33 }),
      postVoucher({ voucherId: voucher.id, companyId: fx.companyId, postedByUserId: 34 }),
    ]);

    assert.equal(first.status, 'posted');
    assert.equal(second.status, 'posted');

    const postedState = await getVoucherById({ voucherId: voucher.id, companyId: fx.companyId });
    assert.equal(postedState.status, 'posted');

    const logCountRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM finance_transition_logs
      WHERE company_id = $1
        AND entity_type = 'voucher'
        AND entity_id = $2
        AND action = 'post'
      `,
      [fx.companyId, voucher.id]
    );
    assert.equal(Number(logCountRes.rows[0].total), 1);
  } finally {
    await fx.cleanup();
  }
});

test('maker-checker: maker cannot approve own submitted voucher by default', async (t) => {
  if (!(await ensurePhase4Prerequisites(t))) {
    return;
  }
  const fx = await createCompanyFixture();
  try {
    const arAccountId = await getAccountId(fx.companyId, 'AR_CONTROL');
    const revAccountId = await getAccountId(fx.companyId, 'REV_DISPATCH');
    const arLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: arAccountId, partyId: fx.partyId });
    const revLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: revAccountId });

    const voucher = await createVoucher({
      companyId: fx.companyId,
      voucherType: 'journal',
      voucherDate: ACCOUNTING_TEST_DATE,
      approvalStatus: 'draft',
      narration: 'maker-checker test',
      createdByUserId: 41,
      lines: [
        { accountId: arAccountId, ledgerId: arLedgerId, partyId: fx.partyId, debit: 300, credit: 0 },
        { accountId: revAccountId, ledgerId: revLedgerId, debit: 0, credit: 300 },
      ],
    });

    await submitVoucher({
      voucherId: voucher.id,
      companyId: fx.companyId,
      submittedByUserId: 41,
    });

    await assert.rejects(
      () =>
        approveVoucher({
          voucherId: voucher.id,
          companyId: fx.companyId,
          approvedByUserId: 41,
          approvalNotes: 'self approve should fail',
        }),
      /cannot approve/i
    );
  } finally {
    await fx.cleanup();
  }
});

test('period lock: posting fails once period is closed', async (t) => {
  if (!(await ensurePhase4Prerequisites(t))) {
    return;
  }
  const fx = await createCompanyFixture();
  try {
    const periodRes = await pool.query(
      `
      SELECT id
      FROM accounting_periods
      WHERE company_id = $1
        AND period_start <= $2::date
        AND period_end >= $2::date
      LIMIT 1
      `,
      [fx.companyId, ACCOUNTING_TEST_DATE]
    );
    const periodId = periodRes.rows[0].id;

    const arAccountId = await getAccountId(fx.companyId, 'AR_CONTROL');
    const revAccountId = await getAccountId(fx.companyId, 'REV_DISPATCH');
    const arLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: arAccountId, partyId: fx.partyId });
    const revLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: revAccountId });

    const voucher = await createVoucher({
      companyId: fx.companyId,
      voucherType: 'journal',
      voucherDate: ACCOUNTING_TEST_DATE,
      accountingPeriodId: periodId,
      approvalStatus: 'draft',
      narration: 'period lock test',
      createdByUserId: 51,
      lines: [
        { accountId: arAccountId, ledgerId: arLedgerId, partyId: fx.partyId, debit: 450, credit: 0 },
        { accountId: revAccountId, ledgerId: revLedgerId, debit: 0, credit: 450 },
      ],
    });

    await submitVoucher({
      voucherId: voucher.id,
      companyId: fx.companyId,
      submittedByUserId: 51,
    });

    await approveVoucher({
      voucherId: voucher.id,
      companyId: fx.companyId,
      approvedByUserId: 52,
    });

    await updateAccountingPeriodStatus({
      companyId: fx.companyId,
      periodId,
      status: 'closed',
      statusNotes: 'close for posting lock test',
      userId: 53,
    });

    await assert.rejects(
      () => postVoucher({ voucherId: voucher.id, companyId: fx.companyId, postedByUserId: 54 }),
      /period is not open/i
    );
  } finally {
    await fx.cleanup();
  }
});

test('db trigger: maker-checker policy blocks direct same-user approve mutation', async (t) => {
  if (!(await ensurePhase4Prerequisites(t))) {
    return;
  }
  const fx = await createCompanyFixture();
  try {
    const arAccountId = await getAccountId(fx.companyId, 'AR_CONTROL');
    const revAccountId = await getAccountId(fx.companyId, 'REV_DISPATCH');
    const arLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: arAccountId, partyId: fx.partyId });
    const revLedgerId = await getLedgerId({ companyId: fx.companyId, accountId: revAccountId });

    const voucher = await createVoucher({
      companyId: fx.companyId,
      voucherType: 'journal',
      voucherDate: ACCOUNTING_TEST_DATE,
      approvalStatus: 'draft',
      narration: 'db policy trigger test',
      createdByUserId: 61,
      lines: [
        { accountId: arAccountId, ledgerId: arLedgerId, partyId: fx.partyId, debit: 220, credit: 0 },
        { accountId: revAccountId, ledgerId: revLedgerId, debit: 0, credit: 220 },
      ],
    });

    await submitVoucher({
      voucherId: voucher.id,
      companyId: fx.companyId,
      submittedByUserId: 61,
    });

    await assert.rejects(
      () =>
        pool.query(
          `
          UPDATE vouchers
          SET approval_status = 'approved',
              approved_by_user_id = $1,
              approved_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND company_id = $3
          `,
          [61, voucher.id, fx.companyId]
        ),
      /cannot approve|Submitter cannot approve/i
    );
  } finally {
    await fx.cleanup();
  }
});
