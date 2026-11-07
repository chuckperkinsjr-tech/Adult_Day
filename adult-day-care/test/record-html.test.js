const assert = require('assert');
const { recordHtml, ageOf, fmtDate, safeFileName } = require('../record-html');

assert.strictEqual(fmtDate('1941-03-07'), '03/07/1941');
assert.strictEqual(fmtDate(''), '');
const now = new Date(2026, 10, 5); // 5 Nov 2026
assert.strictEqual(ageOf('1941-11-05', now), 85); // birthday today
assert.strictEqual(ageOf('1941-11-06', now), 84); // birthday tomorrow
assert.strictEqual(ageOf('nonsense', now), null);

const html = recordHtml({
  firstName: 'Ada', lastName: 'O\'Neil <script>', dob: '1941-03-07', phone: '555-0100',
  allergies: [{ allergen: 'Penicillin', reaction: 'Hives & swelling' }],
  medications: [{ name: 'Lisinopril', dose: '10 mg', schedule: 'Morning' }],
  history: 'Hypertension\nType 2 diabetes', log: [{ date: '2026-10-01', entry: 'Fall, no injury' }],
}, now);
assert(!html.includes('<script>'), 'user text must be escaped');
assert(html.includes('Hives &amp; swelling'));
assert(html.includes('03/07/1941 (age 85)'));
assert(html.includes('10/01/2026'));
const empty = recordHtml({ firstName: 'B', lastName: 'C' }, now);
assert(empty.includes('No known allergies recorded.') && empty.includes('Not provided'));
assert(/^[\w-]+$/.test(safeFileName({ firstName: 'Ana María', lastName: "O'Neil" })));
console.log('record-html tests passed');
