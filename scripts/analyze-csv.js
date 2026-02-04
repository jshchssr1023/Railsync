const fs = require('fs');
const csv = fs.readFileSync('docs/Qual Planner Master.csv', 'utf8');
const lines = csv.split('\n').filter(l => l.trim());
console.log('Total rows (incl header):', lines.length);

function parseCSVLine(line) {
  const r = [];
  let f = '', q = false;
  for (const c of line) {
    if (c === '"') { q = !q; }
    else if (c === ',' && !q) { r.push(f.trim()); f = ''; }
    else { f += c; }
  }
  r.push(f.trim());
  return r;
}

const header = parseCSVLine(lines[0]);
const rows = lines.slice(1).map(l => parseCSVLine(l));

const lessees = new Set(rows.map(r => r[0]).filter(Boolean));
console.log('Unique lessees:', lessees.size);

const marks = new Set(rows.map(r => r[1]).filter(Boolean));
console.log('Unique car marks:', marks.size);

const contracts = new Set(rows.map(r => r[3]).filter(Boolean));
console.log('Unique contracts:', contracts.size);

const commodities = new Set(rows.map(r => r[5]).filter(Boolean));
console.log('Unique commodities:', commodities.size);

const statuses = {};
rows.forEach(r => { const s = r[36] || 'empty'; statuses[s] = (statuses[s] || 0) + 1; });
console.log('Status distribution:');
Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ', k, ':', v));

const regions = {};
rows.forEach(r => { const s = r[10] || 'empty'; regions[s] = (regions[s] || 0) + 1; });
console.log('\n2026 Region distribution:');
Object.entries(regions).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ', k, ':', v));

console.log('\nSample lessees (first 30):');
[...lessees].slice(0, 30).forEach(l => console.log(' ', l));

console.log('\nSample commodities (first 20):');
[...commodities].slice(0, 20).forEach(c => console.log(' ', c));
