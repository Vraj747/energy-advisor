/*
 * Watt Check – UI wiring.
 * Three states of one flow: usage (form) → estimate (result) → compare (scenario).
 * All maths and validation live in calc.js; this file only reads inputs, shows results
 * and manages focus.
 */
(function () {
  "use strict";

  var C = window.WattCalc;
  var $ = function (id) { return document.getElementById(id); };

  var SAMPLE = { kwh: "750", rate: "12.0" }; // example household shown by the "Use example" button
  var state = { kwh: null, rate: null }; // validated numbers from step 1

  var money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
  var fmtMoney = function (cents) { return money.format(cents / 100); };
  var fmtKwh = function (n) { return n.toLocaleString("en-CA", { maximumFractionDigits: 2 }); };
  var fmtRate = function (n) { return n.toLocaleString("en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 2 }); };
  var fmtPct = function (n) { return n.toLocaleString("en-CA", { maximumFractionDigits: 1 }); };

  /* ---------- views and progress ---------- */

  var VIEWS = {
    usage: { el: $("view-usage"), heading: $("h-usage"), title: "Step 1 of 3: Your usage" },
    estimate: { el: $("view-estimate"), heading: $("h-estimate"), title: "Step 2 of 3: Your estimate" },
    compare: { el: $("view-compare"), heading: $("h-compare"), title: "Step 3 of 3: Compare a scenario" },
  };
  var ORDER = ["usage", "estimate", "compare"];

  function showView(name) {
    ORDER.forEach(function (key) { VIEWS[key].el.hidden = key !== name; });
    document.querySelectorAll(".steps__item").forEach(function (li) {
      var idx = ORDER.indexOf(li.dataset.step);
      li.classList.toggle("is-current", li.dataset.step === name);
      li.classList.toggle("is-done", idx < ORDER.indexOf(name));
      if (li.dataset.step === name) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    document.title = VIEWS[name].title + " – Watt Check";
    window.scrollTo(0, 0);
    // Move focus to the new heading so keyboard and screen-reader users start at the top of the new state.
    VIEWS[name].heading.focus();
  }

  /* ---------- error handling shared by both forms ---------- */

  var FIELD_ID = { kwh: "kwh", rate: "rate", reduction: "reduction", scenarioRate: "scenario-rate" };

  function clearErrors(summaryEl, fields) {
    summaryEl.hidden = true;
    summaryEl.textContent = "";
    fields.forEach(function (key) {
      var input = $(FIELD_ID[key]);
      var msg = $(FIELD_ID[key] + "-error");
      input.removeAttribute("aria-invalid");
      input.closest(".field").classList.remove("has-error");
      msg.hidden = true;
      msg.textContent = "";
    });
  }

  function showErrors(summaryEl, errors) {
    var heading = document.createElement("p");
    heading.className = "error-summary__title";
    heading.textContent = errors.length === 1 ? "There is 1 problem to fix" : "There are " + errors.length + " problems to fix";
    var list = document.createElement("ul");
    errors.forEach(function (err) {
      var input = $(FIELD_ID[err.field]);
      var msg = $(FIELD_ID[err.field] + "-error");
      input.setAttribute("aria-invalid", "true");
      input.closest(".field").classList.add("has-error");
      msg.textContent = err.message;
      msg.hidden = false;

      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + FIELD_ID[err.field];
      a.textContent = err.message;
      a.addEventListener("click", function (e) { e.preventDefault(); input.focus(); });
      li.appendChild(a);
      list.appendChild(li);
    });
    summaryEl.textContent = "";
    summaryEl.appendChild(heading);
    summaryEl.appendChild(list);
    summaryEl.hidden = false;
    summaryEl.focus();
  }

  /* ---------- state 1: usage ---------- */

  $("usage-form").addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors($("usage-errors"), ["kwh", "rate"]);
    var result = C.validateUsage($("kwh").value, $("rate").value);
    if (!result.valid) return showErrors($("usage-errors"), result.errors);

    state.kwh = result.kwh;
    state.rate = result.rate;
    renderEstimate();
    showView("estimate");
  });

  $("use-sample").addEventListener("click", function () {
    clearErrors($("usage-errors"), ["kwh", "rate"]);
    $("kwh").value = SAMPLE.kwh;
    $("rate").value = SAMPLE.rate;
    $("kwh").focus();
  });

  /* ---------- state 2: estimate ---------- */

  function renderEstimate() {
    var est = C.estimate(state.kwh, state.rate);
    $("estimate-formula").textContent =
      fmtKwh(state.kwh) + " kWh × " + fmtRate(state.rate) + "¢ per kWh = " + fmtMoney(est.monthlyCents) + " a month.";
    $("est-month").textContent = fmtMoney(est.monthlyCents);
    $("est-year").textContent = fmtMoney(est.yearlyCents);
    $("est-day").textContent = fmtMoney(est.dailyCents);
  }

  $("edit-usage").addEventListener("click", function () { showView("usage"); $("kwh").focus(); });
  $("go-compare").addEventListener("click", function () {
    clearErrors($("scenario-errors"), ["reduction", "scenarioRate"]);
    $("scenario-rate").placeholder = fmtRate(state.rate);
    runComparison();
    showView("compare");
  });

  /* ---------- state 3: compare ---------- */

  function runComparison() {
    var check = C.validateScenario($("reduction").value, $("scenario-rate").value, state.rate);
    var details = document.querySelectorAll("#compare-result .bars, #compare-result .compare-table");
    if (!check.valid) {
      // Withdraw the old result: showing it next to an invalid input would be misleading.
      $("compare-summary").textContent = "Fix the highlighted field to see an updated comparison.";
      details.forEach(function (el) { el.hidden = true; });
      return check;
    }
    details.forEach(function (el) { el.hidden = false; });

    var cmp = C.compareScenario(state.kwh, state.rate, check.reduction, check.rate);
    var now = cmp.base, scn = cmp.scenario;

    var summary;
    if (cmp.direction === "save") {
      summary = "You would save " + fmtMoney(cmp.savedMonthlyCents) + " a month (" + fmtMoney(cmp.savedYearlyCents) +
        " a year), about " + fmtPct(cmp.savedPercent) + "% less.";
    } else if (cmp.direction === "cost") {
      summary = "This scenario would cost " + fmtMoney(-cmp.savedMonthlyCents) + " more a month (" +
        fmtMoney(-cmp.savedYearlyCents) + " more a year).";
    } else {
      summary = "No change: both options cost " + fmtMoney(now.monthlyCents) + " a month.";
    }
    $("compare-summary").textContent = summary;

    // Bars are a visual aid only; the same numbers are in the summary and the table.
    var max = Math.max(now.monthlyCents, scn.monthlyCents);
    var pct = function (c) { return max === 0 ? 0 : Math.max(2, Math.round((c / max) * 100)); };
    $("bar-now").style.width = pct(now.monthlyCents) + "%";
    $("bar-scn").style.width = scn.monthlyCents === 0 ? "0%" : pct(scn.monthlyCents) + "%";
    $("bar-now-val").textContent = fmtMoney(now.monthlyCents);
    $("bar-scn-val").textContent = fmtMoney(scn.monthlyCents);

    $("t-kwh-now").textContent = fmtKwh(now.kwh);
    $("t-kwh-scn").textContent = fmtKwh(scn.kwh);
    $("t-rate-now").textContent = fmtRate(now.rate);
    $("t-rate-scn").textContent = fmtRate(scn.rate);
    $("t-month-now").textContent = fmtMoney(now.monthlyCents);
    $("t-month-scn").textContent = fmtMoney(scn.monthlyCents);
    $("t-year-now").textContent = fmtMoney(now.yearlyCents);
    $("t-year-scn").textContent = fmtMoney(scn.yearlyCents);
    return check;
  }

  // On phones the result card sits below the form, off-screen after a tap on Compare or a chip.
  // Bring it into view (no animation if the user prefers reduced motion); focus stays on the control.
  function revealResult() {
    var card = $("compare-result");
    if (card.getBoundingClientRect().top < window.innerHeight * 0.6) return; // side-by-side layout: already visible
    var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  }

  function submitScenario() {
    clearErrors($("scenario-errors"), ["reduction", "scenarioRate"]);
    var check = runComparison();
    if (!check.valid) showErrors($("scenario-errors"), check.errors);
    else revealResult();
  }

  $("scenario-form").addEventListener("submit", function (e) {
    e.preventDefault();
    submitScenario();
  });

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      $("reduction").value = chip.dataset.reduction;
      submitScenario();
    });
  });

  $("back-estimate").addEventListener("click", function () { showView("estimate"); });
  $("start-over").addEventListener("click", function () {
    $("usage-form").reset();
    $("reduction").value = "10";
    $("scenario-rate").value = "";
    clearErrors($("usage-errors"), ["kwh", "rate"]);
    clearErrors($("scenario-errors"), ["reduction", "scenarioRate"]);
    state.kwh = state.rate = null;
    showView("usage");
    $("kwh").focus();
  });
})();
