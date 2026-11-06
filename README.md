# Watt Check – Smart Energy Advisor

A small, accessible web app that helps a household understand its approximate electricity cost.
Built for the INFO-3130 *The Emerging Interface* practical midterm (scenario 05: Smart Energy Advisor).

- **Live site:** https://vraj747.github.io/energy-advisor/
- **Figma (desktop + mobile):** https://www.figma.com/design/173LeukpOBh3cQmnueeLMu/Portfolio?node-id=6211-2 (page "Midterm-Energy Advisor": tokens and components, D1 to D6 desktop, M1 to M6 mobile, user flow, accessibility notes)

## What it does

One complete flow in three states:

1. **Your usage** – enter monthly electricity use (kWh) and the rate (¢ per kWh). Empty, non-numeric and out-of-range values show an error summary and inline messages.
2. **Estimate** – shows the cost per month, per year and per day, with the formula used.
3. **Compare** – try a savings scenario (use X% less electricity, optionally at a different rate) and see the difference as a sentence, bars and a table.

Tip: press **Use example household** (750 kWh at 12.0¢) to see a worked example: $90.00 a month, $1,080.00 a year; 20% less saves $18.00 a month.

## Run it locally

No build step and no dependencies.

```bash
git clone https://github.com/Vraj747/energy-advisor.git
cd energy-advisor
python -m http.server 8000      # or open index.html directly
# then visit http://localhost:8000
```

Run the unit tests for the calculation logic (Node 18+):

```bash
node tests/calc.test.js
```

## Project structure

```
index.html          page markup (3 states in one page)
css/styles.css      design tokens + mobile-first styles
js/calc.js          pure calculation + validation functions (unit tested)
js/app.js           UI wiring, focus management, rendering
tests/calc.test.js  37 unit tests with hand-calculated expected values
docs/screenshots/   desktop and mobile screenshots used in the report
```

## Accessibility

Skip link, one `h1` per state with focus moved to it on each step change, visible labels and hints tied to inputs with `aria-describedby`, an error summary that takes focus with links to each field, `aria-invalid` and a ⚠ prefix on errors (never colour alone), a `role="status"` live result summary, a real `<table>` alongside decorative bars (the scenario bar is striped, not only a different colour), 3px focus ring, touch targets of at least 44 px, WCAG AA contrast, `prefers-reduced-motion` and forced-colors support. The full keyboard path (Tab, Enter, Space) works without a mouse.

## Limitations

- Estimates only. Real bills include delivery charges, taxes and fixed monthly fees that are **not** modelled.
- No accounts, storage or backend: inputs live in memory and are cleared on reload.
- Cost = kWh × rate. There is no time-of-use pricing, utility API, real-time rates or prediction (out of scope for this brief).
- Sanity limits (1–10,000 kWh, 0.1–100¢) exist to catch typos, not utility rules.
- Automated checks (axe-core) and my own keyboard testing do not prove full WCAG 2.2 compliance; screen-reader testing with NVDA/VoiceOver was not done.
- The Figma file uses Inter; the live site uses the visitor's system UI font to avoid loading a third-party font. The Figma frames are plain frames and groups (no Auto Layout or Figma variables).

## Credits

No third-party code, images or icons. The logo bolt is a hand-drawn SVG. Fonts are system fonts.
Built by Vraj Joshi with AI assistance (Claude Code); see the submitted report for the human–AI delegation table and verification evidence.
