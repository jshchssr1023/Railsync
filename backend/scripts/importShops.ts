import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { query } from '../src/config/database';

interface ShopRow {
  [key: string]: string;
}

async function importShops() {
  const csvPath = path.join(__dirname, '../../docs/cleaned shop locations.csv');

  console.log('Reading CSV from:', csvPath);
  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  // Remove BOM if present
  const cleanContent = fileContent.replace(/^\uFEFF/, '');

  const records: ShopRow[] = parse(cleanContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} records`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const row of records) {
    try {
      const id = row['Id'] || row['id'] || '';
      if (!id || id === '') continue;

      const shopCode = `SHOP-${id.toString().padStart(4, '0')}`;
      const shopName = row['ShopNameDisplay'] || row['ShopName'] || 'Unknown';
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

      const sql = `
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
      `;

      const result = await query(sql, [
        shopCode, shopName, railroad, region, city, state, laborRate, isAitx, isActive,
        isNaN(lat!) ? null : lat,
        isNaN(lng!) ? null : lng
      ]);

      if (result[0]?.is_insert) inserted++;
      else updated++;

    } catch (err) {
      errors++;
      if (errors < 5) console.error('Error:', err);
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);

  // Add capabilities for AITX shops
  await query(`
    INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
    SELECT shop_code, 'car_type', 'Tank', TRUE
    FROM shops WHERE is_preferred_network = TRUE
    ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING
  `);

  await query(`
    INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
    SELECT shop_code, 'material', 'Carbon Steel', TRUE
    FROM shops WHERE is_preferred_network = TRUE
    ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING
  `);

  console.log('Added capabilities for AITX shops');

  const stats = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_preferred_network) as aitx,
      COUNT(*) FILTER (WHERE is_active) as active
    FROM shops
  `);
  console.log('Final stats:', stats[0]);

  process.exit(0);
}

importShops().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
