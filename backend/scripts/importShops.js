// Shop Import Script - Plain JS version
// Run with: node scripts/importShops.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'railsync',
  user: process.env.DB_USER || 'railsync',
  password: process.env.DB_PASSWORD || 'railsync_password',
});

// Simple CSV parser that handles messy quoting
function parseCSV(content) {
  // Remove BOM
  content = content.replace(/^\uFEFF/, '');

  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Parse header - remove leading/trailing quotes
  let headerLine = lines[0];
  if (headerLine.startsWith('"')) headerLine = headerLine.substring(1);
  headerLine = headerLine.replace(/,*"?\s*$/, '');
  const headers = headerLine.split(',').map(h => h.trim());

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;

    // Remove only leading quote (the comma after it is the field separator for empty Action)
    if (line.startsWith('"')) line = line.substring(1);
    // Remove trailing ,,,," pattern
    line = line.replace(/,*"?\s*$/, '');

    // Simple split - handles most cases
    // For complex quoted fields with commas, we do a state machine parse
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const next = line[j + 1];

      if (ch === '"' && next === '"') {
        // Escaped quote
        current += '"';
        j++; // Skip next quote
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    // Create record object
    const record = {};
    for (let k = 0; k < headers.length; k++) {
      record[headers[k]] = values[k] || '';
    }
    records.push(record);
  }

  return records;
}

async function importShops() {
  const csvPath = path.join(__dirname, '../../docs/cleaned shop locations.csv');
  console.log('Reading CSV from:', csvPath);

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parseCSV(fileContent);

  console.log(`Parsed ${records.length} records`);
  if (records.length > 0) {
    console.log('Sample row keys:', Object.keys(records[0]));
    console.log('Sample row:', JSON.stringify(records[0]).substring(0, 300));
  }

  let inserted = 0, updated = 0, skipped = 0, errors = 0;
  const client = await pool.connect();

  try {
    for (const row of records) {
      const id = row['Id'] || '';
      if (!id || id === '') { skipped++; continue; }

      const shopCode = `SHOP-${id.toString().padStart(4, '0')}`;
      const shopName = (row['ShopNameDisplay'] || row['ShopName'] || 'Unknown').substring(0, 100);
      const city = row['City'] || null;
      const state = row['State'] || null;
      const laborRate = parseFloat(row['LaborRate']) || 75.0;
      const lat = parseFloat(row['Latitude']) || null;
      const lng = parseFloat(row['Longitude']) || null;
      const isAitx = (row['IsAITXShop'] || '').toLowerCase() === 'yes';
      const isActive = (row['ShopStatus'] || '').toLowerCase() === 'active';
      const deliveryLines = row['DeliveryLines'] || '';

      // Determine railroad
      let railroad = 'OTHER';
      if (deliveryLines.includes('UP')) railroad = 'UP';
      else if (deliveryLines.includes('BNSF')) railroad = 'BNSF';
      else if (deliveryLines.includes('CSX')) railroad = 'CSX';
      else if (deliveryLines.includes('NS')) railroad = 'NS';
      else if (deliveryLines.includes('CN')) railroad = 'CN';

      // Determine region
      let region = 'Central';
      if (['TX', 'OK', 'AR', 'LA'].includes(state)) region = 'Gulf';
      else if (['CA', 'AZ', 'NV', 'OR', 'WA', 'UT', 'CO', 'NM'].includes(state)) region = 'West';
      else if (['IL', 'IN', 'OH', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE'].includes(state)) region = 'Midwest';
      else if (['NY', 'PA', 'NJ', 'CT', 'MA', 'ME', 'NH', 'VT', 'RI'].includes(state)) region = 'Northeast';
      else if (['FL', 'GA', 'AL', 'MS', 'SC', 'NC', 'TN', 'KY', 'VA', 'WV', 'MD'].includes(state)) region = 'Southeast';

      try {
        const result = await client.query(`
          INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, labor_rate, material_multiplier, is_preferred_network, is_active, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 1.0, $8, $9, $10, $11)
          ON CONFLICT (shop_code) DO UPDATE SET
            shop_name = EXCLUDED.shop_name,
            primary_railroad = EXCLUDED.primary_railroad,
            region = EXCLUDED.region,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            labor_rate = EXCLUDED.labor_rate,
            is_preferred_network = EXCLUDED.is_preferred_network,
            is_active = EXCLUDED.is_active,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            updated_at = NOW()
          RETURNING (xmax = 0) as is_insert
        `, [shopCode, shopName, railroad, region, city, state, laborRate, isAitx, isActive,
            isNaN(lat) ? null : lat, isNaN(lng) ? null : lng]);

        if (result.rows[0]?.is_insert) inserted++;
        else updated++;
      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`Error on ${shopCode}:`, err.message);
      }
    }

    // Add capabilities for AITX shops
    await client.query(`
      INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
      SELECT shop_code, 'car_type', 'Tank', TRUE
      FROM shops WHERE is_preferred_network = TRUE
      ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING
    `);

    await client.query(`
      INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
      SELECT shop_code, 'material', 'Carbon Steel', TRUE
      FROM shops WHERE is_preferred_network = TRUE
      ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING
    `);

    const stats = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_preferred_network) as aitx,
             COUNT(*) FILTER (WHERE is_active) as active
      FROM shops
    `);

    console.log(`\nImport complete:`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log(`\nFinal stats:`, stats.rows[0]);

  } finally {
    client.release();
    await pool.end();
  }
}

importShops().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
