// Builds the printable / PDF version of one patient record.
// Pure functions only (no Electron), so they can be tested with plain Node.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}

function ageOf(iso, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

function safeFileName(p) {
  const base = `${p.lastName || 'patient'}_${p.firstName || ''}_record`.replace(/[^\w-]+/g, '_').replace(/_+/g, '_');
  return `${base}_${new Date().toISOString().slice(0, 10)}`;
}

function table(items, cols, emptyText) {
  if (!items || !items.length) return `<p class="none">${esc(emptyText)}</p>`;
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = items
    .map((it) => `<tr>${cols.map((c) => `<td>${esc(c.date ? fmtDate(it[c.key]) : it[c.key])}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function field(label, value) {
  return `<div><dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="none">Not provided</span>'}</dd></div>`;
}

function recordHtml(p, now = new Date()) {
  const age = ageOf(p.dob, now);
  const dob = p.dob ? `${fmtDate(p.dob)}${age !== null ? ` (age ${age})` : ''}` : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(p.firstName)} ${esc(p.lastName)}</title>
<style>
  @page { size: Letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.4 -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  .org { font-size: 10pt; color: #555; margin: 0 0 4px; }
  h1 { font-size: 22pt; margin: 0 0 2px; }
  .sub { margin: 0 0 18px; color: #333; }
  h2 { font-size: 12pt; margin: 20px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #222; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 0; }
  dt { font-size: 9pt; color: #555; }
  dd { margin: 0; }
  dd, td { overflow-wrap: anywhere; }
  .wide { grid-column: 1 / -1; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 8px 5px 0; border-bottom: 1px solid #ccc; vertical-align: top; }
  th { font-size: 9pt; color: #555; font-weight: 600; }
  .none { color: #777; margin: 0; }
  .text { white-space: pre-wrap; margin: 0; }
  tr, .block { break-inside: avoid; }
  .allergy-box { border: 1.5px solid #222; padding: 4px 10px 8px; margin-top: 20px; }
  .allergy-box h2 { margin-top: 6px; }
  footer { margin-top: 28px; font-size: 9pt; color: #555; }
</style></head><body>
  <p class="org">Adult Day Care &ndash; Patient record</p>
  <h1>${esc(p.firstName)} ${esc(p.lastName)}</h1>
  <p class="sub">Date of birth: ${dob ? esc(dob) : 'Not provided'}</p>

  <h2>Contact information</h2>
  <dl>
    ${field('Phone', p.phone)}
    ${field('Email', p.email)}
    <div class="wide"><dt>Address</dt><dd>${p.address ? `<span class="text">${esc(p.address)}</span>` : '<span class="none">Not provided</span>'}</dd></div>
  </dl>

  <h2>Emergency contact</h2>
  <dl>
    ${field('Name', p.ecName)}
    ${field('Relationship', p.ecRelationship)}
    ${field('Phone', p.ecPhone)}
  </dl>

  <div class="allergy-box block">
    <h2>Allergies</h2>
    ${table(p.allergies, [{ key: 'allergen', label: 'Allergen' }, { key: 'reaction', label: 'Reaction or severity' }], 'No known allergies recorded.')}
  </div>

  <div class="block">
    <h2>Medications</h2>
    ${table(p.medications, [{ key: 'name', label: 'Medication' }, { key: 'dose', label: 'Dose' }, { key: 'schedule', label: 'Schedule' }], 'No medications recorded.')}
  </div>

  <h2>Medical history</h2>
  ${p.history ? `<p class="text">${esc(p.history)}</p>` : '<p class="none">No history recorded.</p>'}

  <h2>History log</h2>
  ${table(p.log, [{ key: 'date', label: 'Date', date: true }, { key: 'entry', label: 'Entry' }], 'No log entries.')}

  <footer>Confidential patient information. Printed ${esc(now.toLocaleDateString('en-US'))}${p.updatedAt ? `; record last updated ${esc(new Date(p.updatedAt).toLocaleDateString('en-US'))}` : ''}.</footer>
</body></html>`;
}

module.exports = { recordHtml, fmtDate, ageOf, safeFileName, esc };
