/*
 * Watt Check – calculation and validation logic.
 * Pure functions with no DOM access so they can be unit-tested in Node
 * (see tests/calc.test.js) and reused by the browser UI (js/app.js).
 *
 * Money is handled in whole cents (integers) and only converted to dollars
 * for display, which avoids floating-point drift such as 0.1 + 0.2.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WattCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Sanity limits for a single household: they catch typos (e.g. an extra zero)
  // rather than enforcing a utility rule.
  var LIMITS = {
    kwh: { min: 1, max: 10000 }, // kWh per month
    rate: { min: 0.1, max: 100 }, // cents per kWh
    reduction: { min: 0, max: 100 }, // percent
  };

  /**
   * Turn what the user typed into a number.
   * Accepts "750", "12.5", " 1,250 " (comma thousands). Rejects "", "abc", "1e3", "12..5".
   * @returns {{ok:boolean, value?:number, reason?:"empty"|"format"}}
   */
  function parseNumber(raw) {
    var text = String(raw == null ? "" : raw).trim();
    if (text === "") return { ok: false, reason: "empty" };
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) text = text.replace(/,/g, "");
    if (!/^\d*\.?\d+$|^\d+\.$/.test(text)) return { ok: false, reason: "format" };
    return { ok: true, value: parseFloat(text) };
  }

  function checkRange(field, label, raw, limits, unit) {
    var parsed = parseNumber(raw);
    if (!parsed.ok) {
      return {
        field: field,
        message:
          parsed.reason === "empty"
            ? "Enter " + label + "."
            : label.charAt(0).toUpperCase() + label.slice(1) + " must be a number, like 750 or 12.5.",
      };
    }
    if (parsed.value < limits.min || parsed.value > limits.max) {
      return {
        field: field,
        message:
          label.charAt(0).toUpperCase() + label.slice(1) + " must be between " + limits.min + " and " +
          limits.max.toLocaleString("en-CA") + (unit === "%" ? "" : " ") + unit + ".",
      };
    }
    return { field: field, value: parsed.value };
  }

  /**
   * Validate the two main inputs.
   * @returns {{valid:boolean, errors:{field:string,message:string}[], kwh?:number, rate?:number}}
   */
  function validateUsage(kwhRaw, rateRaw) {
    var kwh = checkRange("kwh", "your monthly use in kWh", kwhRaw, LIMITS.kwh, "kWh");
    var rate = checkRange("rate", "your rate in cents per kWh", rateRaw, LIMITS.rate, "¢/kWh");
    var errors = [kwh, rate].filter(function (r) { return r.message; });
    if (errors.length) return { valid: false, errors: errors };
    return { valid: true, errors: [], kwh: kwh.value, rate: rate.value };
  }

  /**
   * Validate the savings scenario. The scenario rate is optional (blank = keep current rate).
   * @returns {{valid:boolean, errors:{field:string,message:string}[], reduction?:number, rate?:number}}
   */
  function validateScenario(reductionRaw, rateRaw, currentRate) {
    var reduction = checkRange("reduction", "a reduction percentage", reductionRaw, LIMITS.reduction, "%");
    var errors = [];
    if (reduction.message) errors.push(reduction);
    var rate = currentRate;
    if (String(rateRaw == null ? "" : rateRaw).trim() !== "") {
      var r = checkRange("scenarioRate", "the scenario rate in cents per kWh", rateRaw, LIMITS.rate, "¢/kWh");
      if (r.message) errors.push(r);
      else rate = r.value;
    }
    if (errors.length) return { valid: false, errors: errors };
    return { valid: true, errors: [], reduction: reduction.value, rate: rate };
  }

  /** Cost in whole cents for a given usage and rate (cents/kWh), rounded half-up. */
  function costCents(kwh, rateCentsPerKwh) {
    // Round the product to 6 decimals first so 12.5 * 0.5 style cases never land on x.4999999.
    return Math.round(Math.round(kwh * rateCentsPerKwh * 1e6) / 1e6);
  }

  /** Monthly, yearly and average daily cost in cents. Yearly is 12 × the rounded monthly cost. */
  function estimate(kwh, rate) {
    var monthly = costCents(kwh, rate);
    var yearly = monthly * 12;
    return { kwh: kwh, rate: rate, monthlyCents: monthly, yearlyCents: yearly, dailyCents: Math.round(yearly / 365) };
  }

  /**
   * Compare the current estimate with a scenario that cuts usage by `reduction` percent
   * and (optionally) uses a different rate.
   */
  function compareScenario(kwh, rate, reduction, scenarioRate) {
    var base = estimate(kwh, rate);
    var scenarioKwh = Math.round(kwh * (100 - reduction) * 1e4) / 1e6; // kWh * (1 - r/100), 4 d.p.
    var scenario = estimate(scenarioKwh, scenarioRate);
    var savedMonthly = base.monthlyCents - scenario.monthlyCents;
    return {
      base: base,
      scenario: scenario,
      savedMonthlyCents: savedMonthly,
      savedYearlyCents: base.yearlyCents - scenario.yearlyCents,
      savedPercent: base.monthlyCents === 0 ? 0 : Math.round((savedMonthly / base.monthlyCents) * 1000) / 10,
      direction: savedMonthly > 0 ? "save" : savedMonthly < 0 ? "cost" : "same",
    };
  }

  return {
    LIMITS: LIMITS,
    parseNumber: parseNumber,
    validateUsage: validateUsage,
    validateScenario: validateScenario,
    costCents: costCents,
    estimate: estimate,
    compareScenario: compareScenario,
  };
});
