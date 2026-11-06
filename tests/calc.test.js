// Run with: node tests/calc.test.js   (uses only Node's built-in assert; no install needed)
// Expected values were worked out by hand (kWh × ¢/kWh ÷ 100), not copied from the code's output.
const assert = require("node:assert/strict");
const C = require("../js/calc.js");

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

console.log("parseNumber");
test("plain integer", () => assert.deepEqual(C.parseNumber("750"), { ok: true, value: 750 }));
test("decimal", () => assert.deepEqual(C.parseNumber("12.5"), { ok: true, value: 12.5 }));
test("surrounding spaces", () => assert.equal(C.parseNumber("  600 ").value, 600));
test("comma thousands", () => assert.equal(C.parseNumber("1,250").value, 1250));
test("empty string", () => assert.equal(C.parseNumber("").reason, "empty"));
test("whitespace only", () => assert.equal(C.parseNumber("   ").reason, "empty"));
test("letters rejected", () => assert.equal(C.parseNumber("abc").reason, "format"));
test("exponent rejected", () => assert.equal(C.parseNumber("1e3").reason, "format"));
test("double dot rejected", () => assert.equal(C.parseNumber("12..5").reason, "format"));
test("negative rejected", () => assert.equal(C.parseNumber("-5").reason, "format"));
test("bad comma grouping rejected", () => assert.equal(C.parseNumber("12,34").reason, "format"));

console.log("validateUsage");
test("valid sample household", () => {
  const r = C.validateUsage("750", "12");
  assert.equal(r.valid, true); assert.equal(r.kwh, 750); assert.equal(r.rate, 12);
});
test("both empty → two errors", () => {
  const r = C.validateUsage("", "");
  assert.equal(r.valid, false); assert.deepEqual(r.errors.map((e) => e.field), ["kwh", "rate"]);
});
test("zero kWh rejected", () => assert.equal(C.validateUsage("0", "12").errors[0].field, "kwh"));
test("kWh over limit rejected", () => assert.equal(C.validateUsage("10001", "12").valid, false));
test("kWh at limit accepted", () => assert.equal(C.validateUsage("10000", "12").valid, true));
test("rate over 100¢ rejected", () => assert.equal(C.validateUsage("750", "101").errors[0].field, "rate"));
test("only the bad field is reported", () => {
  const r = C.validateUsage("750", "abc");
  assert.equal(r.errors.length, 1); assert.equal(r.errors[0].field, "rate");
});

console.log("estimate (hand-calculated)");
test("750 kWh × 12¢ = $90.00 / month", () => assert.equal(C.estimate(750, 12).monthlyCents, 9000));
test("…$1,080.00 / year", () => assert.equal(C.estimate(750, 12).yearlyCents, 108000));
test("…$2.96 / day (1080 ÷ 365 = 2.9589)", () => assert.equal(C.estimate(750, 12).dailyCents, 296));
test("900 kWh × 13.4¢ = $120.60", () => assert.equal(C.estimate(900, 13.4).monthlyCents, 12060));
test("333 kWh × 9.8¢ = 3263.4¢ → $32.63", () => assert.equal(C.estimate(333, 9.8).monthlyCents, 3263));
test("half-cent rounds up: 1 kWh × 12.5¢ → 13¢", () => assert.equal(C.estimate(1, 12.5).monthlyCents, 13));
test("no float drift: 3 kWh × 0.1¢ = 0.3¢ → 0¢", () => assert.equal(C.estimate(3, 0.1).monthlyCents, 0));

console.log("compareScenario (hand-calculated)");
test("20% less at the same rate: 600 kWh → $72.00, saves $18.00 / month", () => {
  const r = C.compareScenario(750, 12, 20, 12);
  assert.equal(r.scenario.monthlyCents, 7200); assert.equal(r.savedMonthlyCents, 1800);
  assert.equal(r.savedYearlyCents, 21600); assert.equal(r.savedPercent, 20); assert.equal(r.direction, "save");
});
test("0% change, same rate → no change", () => {
  const r = C.compareScenario(750, 12, 0, 12);
  assert.equal(r.savedMonthlyCents, 0); assert.equal(r.direction, "same");
});
test("cheaper rate only: 750 kWh at 10¢ = $75.00 → saves $15.00", () => {
  const r = C.compareScenario(750, 12, 0, 10);
  assert.equal(r.scenario.monthlyCents, 7500); assert.equal(r.savedMonthlyCents, 1500);
});
test("reduction + cheaper rate: 10% less (675 kWh) at 11¢ = $74.25", () => {
  const r = C.compareScenario(750, 12, 10, 11);
  assert.equal(r.scenario.monthlyCents, 7425); assert.equal(r.savedMonthlyCents, 1575);
});
test("higher scenario rate costs more", () => {
  const r = C.compareScenario(750, 12, 0, 15);
  assert.equal(r.savedMonthlyCents, -2250); assert.equal(r.direction, "cost");
});
test("100% reduction → $0.00", () => assert.equal(C.compareScenario(750, 12, 100, 12).scenario.monthlyCents, 0));

console.log("validateScenario");
test("blank scenario rate keeps the current rate", () => {
  const r = C.validateScenario("10", "", 12);
  assert.equal(r.valid, true); assert.equal(r.rate, 12); assert.equal(r.reduction, 10);
});
test("custom scenario rate is used", () => assert.equal(C.validateScenario("10", "9.8", 12).rate, 9.8));
test("0% reduction is allowed", () => assert.equal(C.validateScenario("0", "", 12).valid, true));
test("empty reduction rejected", () => assert.equal(C.validateScenario("", "", 12).errors[0].field, "reduction"));
test("reduction over 100 rejected", () => assert.equal(C.validateScenario("101", "", 12).valid, false));
test("bad scenario rate rejected", () => assert.equal(C.validateScenario("10", "x", 12).errors[0].field, "scenarioRate"));

console.log(`\n${passed} tests passed`);
