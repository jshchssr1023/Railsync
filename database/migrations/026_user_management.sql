-- Migration 026: Enhanced User Management
-- Adds customer scoping, permissions, and groups

-- ============================================================================
-- ADD CUSTOMER SCOPING TO USERS
-- ============================================================================

-- Add customer_id to users table for customer portal access
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Add additional user fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;

-- Index for customer portal access
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed permissions
INSERT INTO permissions (code, name, description, category) VALUES
-- Contracts Management
('contracts.view', 'View Contracts', 'View contracts overview and car details', 'Contracts'),
('contracts.edit', 'Edit Contracts', 'Modify contracts data and car assignments', 'Contracts'),
('contracts.admin', 'Administer Contracts', 'Full contracts administration including bulk operations', 'Contracts'),

-- Shop Management
('shops.view', 'View Shops', 'View shop list and details', 'Shops'),
('shops.edit', 'Edit Shops', 'Modify shop data and designations', 'Shops'),
('shops.admin', 'Administer Shops', 'Full shop administration', 'Shops'),

-- Planning
('planning.view', 'View Planning', 'View allocations and capacity', 'Planning'),
('planning.edit', 'Edit Planning', 'Create and modify allocations', 'Planning'),
('planning.approve', 'Approve Planning', 'Approve plans and service events', 'Planning'),
('planning.admin', 'Administer Planning', 'Full planning administration', 'Planning'),

-- Budget
('budget.view', 'View Budget', 'View budget data and reports', 'Budget'),
('budget.edit', 'Edit Budget', 'Modify budget entries', 'Budget'),
('budget.admin', 'Administer Budget', 'Full budget administration', 'Budget'),

-- Invoices
('invoices.view', 'View Invoices', 'View invoices and comparisons', 'Invoices'),
('invoices.edit', 'Edit Invoices', 'Create and modify invoices', 'Invoices'),
('invoices.approve', 'Approve Invoices', 'Approve invoices for SAP', 'Invoices'),
('invoices.admin', 'Administer Invoices', 'Full invoice administration', 'Invoices'),

-- Reports
('reports.view', 'View Reports', 'View reports and analytics', 'Reports'),
('reports.export', 'Export Reports', 'Export report data', 'Reports'),
('reports.admin', 'Administer Reports', 'Manage report configurations', 'Reports'),

-- Users
('users.view', 'View Users', 'View user list', 'Users'),
('users.edit', 'Edit Users', 'Modify user data', 'Users'),
('users.admin', 'Administer Users', 'Full user administration including role changes', 'Users'),

-- System
('system.settings', 'System Settings', 'Modify system settings', 'System'),
('system.audit', 'View Audit Logs', 'View system audit logs', 'System'),
('system.admin', 'System Admin', 'Full system administration', 'System')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- ROLE PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
);

-- Admin gets all permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Operator permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'operator', id FROM permissions
WHERE code IN (
    'contracts.view', 'contracts.edit',
    'shops.view', 'shops.edit',
    'planning.view', 'planning.edit', 'planning.approve',
    'budget.view', 'budget.edit',
    'invoices.view', 'invoices.edit', 'invoices.approve',
    'reports.view', 'reports.export'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE code IN (
    'contracts.view',
    'shops.view',
    'planning.view',
    'budget.view',
    'invoices.view',
    'reports.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- USER GROUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    customer_id UUID REFERENCES customers(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- USER GROUP MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

-- ============================================================================
-- GROUP PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_permissions (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, permission_id)
);

-- ============================================================================
-- USER CUSTOM PERMISSIONS TABLE (overrides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT TRUE, -- false = explicitly denied
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission_id)
);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User with effective permissions view
CREATE OR REPLACE VIEW v_user_permissions AS
WITH role_perms AS (
    SELECT rp.role, p.code as permission_code
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
),
group_perms AS (
    SELECT ugm.user_id, p.code as permission_code
    FROM user_group_members ugm
    JOIN group_permissions gp ON ugm.group_id = gp.group_id
    JOIN permissions p ON gp.permission_id = p.id
),
user_overrides AS (
    SELECT up.user_id, p.code as permission_code, up.granted
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
)
SELECT DISTINCT
    u.id as user_id,
    u.email,
    u.role,
    COALESCE(rp.permission_code, gp.permission_code) as permission_code,
    CASE
        WHEN uo.granted = FALSE THEN FALSE
        ELSE TRUE
    END as has_permission
FROM users u
LEFT JOIN role_perms rp ON u.role = rp.role
LEFT JOIN group_perms gp ON u.id = gp.user_id
LEFT JOIN user_overrides uo ON u.id = uo.user_id
    AND COALESCE(rp.permission_code, gp.permission_code) = uo.permission_code
WHERE COALESCE(rp.permission_code, gp.permission_code) IS NOT NULL;

-- User summary view
CREATE OR REPLACE VIEW v_user_summary AS
SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.first_name || ' ' || u.last_name as full_name,
    u.role,
    u.organization,
    u.job_title,
    u.department,
    u.customer_id,
    c.customer_name as customer_name,
    u.is_active,
    u.last_login,
    u.last_activity_at,
    u.created_at,
    (SELECT COUNT(*) FROM user_group_members ugm WHERE ugm.user_id = u.id) as group_count,
    (SELECT COUNT(*) FROM user_permissions up WHERE up.user_id = u.id) as custom_permission_count
FROM users u
LEFT JOIN customers c ON u.customer_id = c.id;

-- User groups summary view
CREATE OR REPLACE VIEW v_user_groups_summary AS
SELECT
    g.id,
    g.name,
    g.description,
    g.customer_id,
    c.customer_name as customer_name,
    (SELECT COUNT(*) FROM user_group_members ugm WHERE ugm.group_id = g.id) as member_count,
    (SELECT COUNT(*) FROM group_permissions gp WHERE gp.group_id = g.id) as permission_count,
    g.created_at
FROM user_groups g
LEFT JOIN customers c ON g.customer_id = c.id;

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Create a demo customer user (password: customer123)
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, customer_id)
SELECT
    'customer@demo.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.K4.z3AelqfVuui',
    'Demo',
    'Customer',
    'viewer',
    'Demo Corp',
    (SELECT id FROM customers LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'customer@demo.com');
