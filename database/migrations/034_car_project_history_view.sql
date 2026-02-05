-- Migration 034: Car Project History View
-- Creates v_car_project_history for the GET /api/cars/:carNumber/project-history endpoint
-- Also adds project_id to demands.createDemand for demand-linked planning (Path 2)

-- View: Shows all projects a car has been part of, with planning details
DROP VIEW IF EXISTS v_car_project_history;
CREATE VIEW v_car_project_history AS
SELECT
  pc.car_number,
  pc.project_id,
  p.id,
  p.project_number,
  p.project_name,
  p.project_type,
  p.scope_of_work,
  p.status,
  p.priority,
  p.lessee_code,
  p.lessee_name,
  pc.id AS project_car_id,
  pc.status AS car_status,
  pc.added_at,
  pa.id AS assignment_id,
  pa.shop_code,
  pa.shop_name,
  pa.target_month,
  pa.target_date,
  pa.estimated_cost,
  pa.plan_state,
  pa.locked_at,
  pa.is_opportunistic,
  pa.created_at AS plan_created_at
FROM project_cars pc
JOIN projects p ON p.id = pc.project_id
LEFT JOIN project_assignments pa ON pa.project_car_id = pc.id
  AND pa.plan_state NOT IN ('Superseded', 'Cancelled')
ORDER BY pc.car_number, p.created_at DESC;

GRANT SELECT ON v_car_project_history TO railsync_app;
