// Calculator maths (A16, B15, A19): node --test tests/calculators.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function load() {
    const context = { Math, Intl, isFinite, parseFloat, String };
    context.window = context;
    vm.runInNewContext(fs.readFileSync('calculators.js', 'utf8'), context);
    return context.r2vCalc;
}

const calc = load();
const near = (actual, expected, tolerance, label) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

test('EMI matches the standard formula', () => {
    near(calc.emi(100000, 12, 12), 8884.88, 0.01, 'EMI');
    near(calc.emi(120000, 0, 12), 10000, 1e-9, 'zero-rate EMI');
    const s = calc.loanSchedule(100000, 12, 12);
    near(s.totalInterest, 6618.55, 0.05, 'total interest');
    near(s.years[0].balance, 0, 0.01, 'closing balance');
});

test('IRR and NPV', () => {
    near(calc.irr([-100, 110]), 0.10, 1e-6, 'one-year IRR');
    near(calc.npv(0.1, [-100, 110]), 0, 1e-9, 'NPV at the IRR');
    assert.equal(calc.irr([-100, -10]), null);
});

test('ROI: payback, depreciation and loan repayments follow section 8.2', () => {
    const base = {
        kwp: 100, cost: 4000000, yield: 1450, degradation: 0, tariff: 8, tariffIncrease: 0, selfUse: 100,
        exportRate: 0, omCost: 0, omIncrease: 0, taxRate: 0, claimDepreciation: false, halfYear: false,
        loanAmount: 0, loanRate: 0, loanYears: 0, discountRate: 10
    };
    const r = calc.roi(base);
    // 145,000 units x Rs 8 = Rs 11,60,000 a year, so payback is 40,00,000 / 11,60,000 = 3.45 years.
    near(r.rows[0].savings, 1160000, 1e-6, 'year-1 savings');
    near(r.paybackYear, 4000000 / 1160000, 1e-9, 'payback');
    assert.equal(r.flows.length, 26);

    const taxed = calc.roi({ ...base, taxRate: 25, claimDepreciation: true, halfYear: true });
    near(taxed.rows[0].tax, 4000000 * 0.4 * 0.5 * 0.25, 1e-6, 'half-year depreciation tax saving');
    near(taxed.rows[1].tax, (4000000 - 800000) * 0.4 * 0.25, 1e-6, 'year-2 WDV tax saving');

    const loan = calc.roi({ ...base, loanAmount: 3000000, loanRate: 10, loanYears: 5 });
    near(loan.flows[0], -1000000, 1e-6, 'year 0 is cost minus loan');
    near(loan.rows[0].repayment, calc.emi(3000000, 10, 60) * 12, 1e-6, 'year-1 repayments');
    assert.equal(loan.rows[5].repayment, 0);
});

test('diesel cost per unit is price per litre over units per litre', () => {
    const d = calc.diesel(90, 3, 100, 20);
    near(d.perUnit, 30, 1e-9, 'per unit');
    near(d.costPerMonth, 2000 * 30, 1e-9, 'monthly cost');
});
