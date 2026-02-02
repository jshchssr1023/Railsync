# Shop Data Collection Templates

## Overview

This folder contains templates for shops to provide their data to Railsync.

## Templates

### 1. Shop_Attributes_Template.csv
Basic shop information and capabilities. Send this once, update when changes occur.

### 2. Shop_Capacity_Template.csv
Monthly capacity data. Send monthly (or more frequently if capacity changes).

## How to Use

### For Shops:
1. Fill out the templates with your data
2. Save as CSV (comma-separated values)
3. Email to [railsync-data@yourcompany.com] or upload via the Railsync portal

### For Railsync Admins:
1. Validate the CSV files
2. Run the import script: `npm run import:shops`
3. Or use the Admin UI to upload

## Data Ingestion Options

| Method | Frequency | Best For |
|--------|-----------|----------|
| Excel/CSV Email | Monthly | Shops without API |
| CSV Upload Portal | Weekly | Self-service shops |
| Direct API | Daily/Real-time | Tech-savvy shops |

## API Integration (Future)

Shops with modern systems can POST directly to:
- `POST /api/shops/import` - Shop attributes
- `POST /api/capacity/import` - Monthly capacity

See API documentation for details.
