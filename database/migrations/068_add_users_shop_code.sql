-- Migration 068: Add shop_code column to users table
-- Fixes: Auth middleware and user model reference shop_code for shop-scoped authorization.
-- Shop-role users have an assigned shop_code that limits their data access to that shop.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS shop_code VARCHAR(50) DEFAULT NULL;

-- Index for looking up users by shop
CREATE INDEX IF NOT EXISTS idx_users_shop_code ON users(shop_code) WHERE shop_code IS NOT NULL;

-- Fix demo data: ensure lessee_name matches lessee_code for golden thread car
UPDATE cars
SET lessee_name = 'Archer Daniels Midland'
WHERE car_number = 'UTLX123456'
  AND lessee_code = 'ADM'
  AND lessee_name != 'Archer Daniels Midland';
