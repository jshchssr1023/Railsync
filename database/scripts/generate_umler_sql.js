const fs = require('fs');
const csv = fs.readFileSync('/tmp/umler.csv', 'utf8');
const lines = csv.split('\n');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const headers = parseCSVLine(lines[0]);
const idx = {};
['Mark', 'Number', 'Lessee Name', 'Car Mark', 'FMS Lessee Number', 'Contract',
 'Contract Expiration', 'Primary Commodity', 'Car Age', 'Car Type Level 2',
 'Jacketed', 'Lined', 'Lining Type', 'Interior Lining', 'Rule 88B ',
 'Safety Relief', 'Service Equipment ', 'Stub Sill', 'Tank Thickness',
 'Tank Qualification', 'Portfolio', 'Current Status', 'Adjusted Status', 'Plan Status'
].forEach(h => {
  idx[h] = headers.indexOf(h);
  if (idx[h] === -1) {
    // Try trimmed match
    idx[h] = headers.findIndex(hdr => hdr.trim() === h.trim());
  }
});

function esc(v, len) {
  return (v || '').replace(/'/g, "''").substring(0, len || 100);
}
function yr(v) {
  const n = parseInt(v);
  return isNaN(n) ? 'NULL' : String(n);
}
function dt(v) {
  if (!v) return 'NULL';
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return "'" + m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') + "'";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "'" + v.substring(0, 10) + "'";
  return 'NULL';
}

let sql = 'BEGIN;\n';
let count = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const v = parseCSVLine(line);
  const mark = (v[idx['Mark']] || '').trim();
  const num = (v[idx['Number']] || '').trim();
  if (!mark || !num) continue;

  const carNumber = mark + num.padStart(6, '0');
  const lesseeName = esc(v[idx['Lessee Name']], 100);
  const carMark = esc(v[idx['Car Mark']], 4);
  const lesseeCode = esc(v[idx['FMS Lessee Number']], 10);
  const contract = esc(v[idx['Contract']], 20);
  const contractExp = dt(v[idx['Contract Expiration']]);
  const commodity = esc(v[idx['Primary Commodity']], 100);
  const carAge = yr(v[idx['Car Age']]);
  const carType = esc(v[idx['Car Type Level 2']], 50);
  const jacketed = (v[idx['Jacketed']] || '').toLowerCase() === 'yes' ? 'true' : 'false';
  const lined = (v[idx['Lined']] || '').toLowerCase() === 'yes' ? 'true' : 'false';
  const liningType = esc(v[idx['Lining Type']], 50);
  const interior = yr(v[idx['Interior Lining']]);
  const rule88b = yr(v[idx['Rule 88B ']]);
  const safety = yr(v[idx['Safety Relief']]);
  const service = yr(v[idx['Service Equipment ']]);
  const stub = yr(v[idx['Stub Sill']]);
  const tankThick = yr(v[idx['Tank Thickness']]);
  const tankQual = yr(v[idx['Tank Qualification']]);
  const portfolio = esc(v[idx['Portfolio']], 20);
  const curStatus = esc(v[idx['Current Status']], 30);

  sql += `INSERT INTO cars (car_number, lessee_name, car_mark, lessee_code, contract_number, contract_expiration, commodity, car_age, car_type, is_jacketed, is_lined, lining_type, interior_lining_year, rule_88b_year, safety_relief_year, service_equipment_year, stub_sill_year, tank_thickness_year, tank_qual_year, portfolio_status, current_status) VALUES ('${carNumber}', '${lesseeName}', '${carMark}', '${lesseeCode}', '${contract}', ${contractExp}, '${commodity}', ${carAge}, '${carType}', ${jacketed}, ${lined}, '${liningType}', ${interior}, ${rule88b}, ${safety}, ${service}, ${stub}, ${tankThick}, ${tankQual}, '${portfolio}', '${curStatus}') ON CONFLICT (car_number) DO UPDATE SET lessee_name=EXCLUDED.lessee_name, car_mark=EXCLUDED.car_mark, lessee_code=EXCLUDED.lessee_code, contract_number=EXCLUDED.contract_number, contract_expiration=EXCLUDED.contract_expiration, commodity=EXCLUDED.commodity, car_age=EXCLUDED.car_age, car_type=EXCLUDED.car_type, is_jacketed=EXCLUDED.is_jacketed, is_lined=EXCLUDED.is_lined, lining_type=EXCLUDED.lining_type, interior_lining_year=EXCLUDED.interior_lining_year, rule_88b_year=EXCLUDED.rule_88b_year, safety_relief_year=EXCLUDED.safety_relief_year, service_equipment_year=EXCLUDED.service_equipment_year, stub_sill_year=EXCLUDED.stub_sill_year, tank_thickness_year=EXCLUDED.tank_thickness_year, tank_qual_year=EXCLUDED.tank_qual_year, portfolio_status=EXCLUDED.portfolio_status, current_status=EXCLUDED.current_status;\n`;
  count++;
}

sql += 'COMMIT;\n';
fs.writeFileSync('/tmp/umler_inserts.sql', sql);
console.log('Generated ' + count + ' INSERT statements');
