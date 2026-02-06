-- Migration 046: Fix capacity trigger for NULL shop_code
-- The update_monthly_capacity_on_allocation() trigger crashes when
-- an allocation is inserted without a shop_code (e.g. unassigned
-- allocations added via master plan builder). Guard all branches.

CREATE OR REPLACE FUNCTION update_monthly_capacity_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
    is_old_confirmed BOOLEAN := FALSE;
    is_new_confirmed BOOLEAN := FALSE;
    is_old_planned BOOLEAN := FALSE;
    is_new_planned BOOLEAN := FALSE;
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Skip capacity tracking when no shop assigned
        IF NEW.shop_code IS NULL OR NEW.target_month IS NULL THEN
            RETURN NEW;
        END IF;

        -- Ensure capacity record exists
        INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity)
        VALUES (NEW.shop_code, NEW.target_month, 50)
        ON CONFLICT (shop_code, month) DO NOTHING;

        IF NEW.status IN ('Arrived', 'Complete') THEN
            UPDATE shop_monthly_capacity
            SET confirmed_railcars = confirmed_railcars + 1,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
        ELSIF NEW.status IN ('Planned Shopping', 'Enroute') THEN
            UPDATE shop_monthly_capacity
            SET planned_railcars = planned_railcars + 1,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
        END IF;
        RETURN NEW;
    END IF;

    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Status changed
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            is_old_confirmed := OLD.status IN ('Arrived', 'Complete');
            is_new_confirmed := NEW.status IN ('Arrived', 'Complete');
            is_old_planned := OLD.status IN ('Planned Shopping', 'Enroute');
            is_new_planned := NEW.status IN ('Planned Shopping', 'Enroute');

            -- Decrement old status count (only if old shop_code was set)
            IF OLD.shop_code IS NOT NULL AND OLD.target_month IS NOT NULL THEN
                IF is_old_confirmed THEN
                    UPDATE shop_monthly_capacity
                    SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
                ELSIF is_old_planned THEN
                    UPDATE shop_monthly_capacity
                    SET planned_railcars = GREATEST(0, planned_railcars - 1),
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
                END IF;
            END IF;

            -- Increment new status count (only if new shop_code is set)
            IF NEW.shop_code IS NOT NULL AND NEW.target_month IS NOT NULL THEN
                -- Ensure capacity record exists for new shop/month
                INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity)
                VALUES (NEW.shop_code, NEW.target_month, 50)
                ON CONFLICT (shop_code, month) DO NOTHING;

                IF is_new_confirmed THEN
                    UPDATE shop_monthly_capacity
                    SET confirmed_railcars = confirmed_railcars + 1,
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
                ELSIF is_new_planned THEN
                    UPDATE shop_monthly_capacity
                    SET planned_railcars = planned_railcars + 1,
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
                END IF;
            END IF;
        END IF;

        -- Shop changed (reassignment)
        IF OLD.shop_code IS DISTINCT FROM NEW.shop_code THEN
            -- Decrement old shop (only if old shop_code was set)
            IF OLD.shop_code IS NOT NULL AND OLD.target_month IS NOT NULL THEN
                IF OLD.status IN ('Arrived', 'Complete') THEN
                    UPDATE shop_monthly_capacity
                    SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
                ELSIF OLD.status IN ('Planned Shopping', 'Enroute') THEN
                    UPDATE shop_monthly_capacity
                    SET planned_railcars = GREATEST(0, planned_railcars - 1),
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
                END IF;
            END IF;

            -- Increment new shop (only if new shop_code is set)
            IF NEW.shop_code IS NOT NULL AND NEW.target_month IS NOT NULL THEN
                INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity)
                VALUES (NEW.shop_code, NEW.target_month, 50)
                ON CONFLICT (shop_code, month) DO NOTHING;

                IF NEW.status IN ('Arrived', 'Complete') THEN
                    UPDATE shop_monthly_capacity
                    SET confirmed_railcars = confirmed_railcars + 1,
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
                ELSIF NEW.status IN ('Planned Shopping', 'Enroute') THEN
                    UPDATE shop_monthly_capacity
                    SET planned_railcars = planned_railcars + 1,
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        IF OLD.shop_code IS NOT NULL AND OLD.target_month IS NOT NULL THEN
            IF OLD.status IN ('Arrived', 'Complete') THEN
                UPDATE shop_monthly_capacity
                SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
            ELSIF OLD.status IN ('Planned Shopping', 'Enroute') THEN
                UPDATE shop_monthly_capacity
                SET planned_railcars = GREATEST(0, planned_railcars - 1),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
            END IF;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
