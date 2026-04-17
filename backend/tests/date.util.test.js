const test = require("node:test");
const assert = require("node:assert/strict");

const { formatDateOnly } = require("../src/utils/date.util");

test("formatDateOnly keeps YYYY-MM-DD strings unchanged", () => {
  assert.equal(formatDateOnly("2026-04-16"), "2026-04-16");
});

test("formatDateOnly returns local calendar date for Date objects", () => {
  const value = new Date(2026, 3, 16, 23, 45, 0);

  assert.equal(formatDateOnly(value), "2026-04-16");
});

test("formatDateOnly returns null for invalid input", () => {
  assert.equal(formatDateOnly("not-a-date"), null);
});
