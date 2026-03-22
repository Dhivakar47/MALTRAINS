-- Migration to add telemetry fields to trainsets

ALTER TABLE "public"."trainsets" 
ADD COLUMN IF NOT EXISTS "current_speed_kmh" double precision DEFAULT 0,
ADD COLUMN IF NOT EXISTS "current_station" text,
ADD COLUMN IF NOT EXISTS "next_station" text,
ADD COLUMN IF NOT EXISTS "delay_minutes" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "latitude" double precision,
ADD COLUMN IF NOT EXISTS "longitude" double precision;

-- Create an index to speed up telemetry queries
CREATE INDEX IF NOT EXISTS "idx_trainsets_telemetry" ON "public"."trainsets" ("current_speed_kmh", "delay_minutes");

-- Mock some initial telemetry data for the existing trains
UPDATE "public"."trainsets"
SET 
  current_speed_kmh = CASE 
    WHEN current_status = 'service_ready' THEN floor(random() * (120 - 40 + 1) + 40)::int
    ELSE 0 
  END,
  current_station = CASE 
    WHEN current_status = 'service_ready' THEN (ARRAY['Central Hub', 'North Station', 'East Terminal', 'West Depot', 'South Square'])[floor(random() * 5 + 1)]
    ELSE 'Depot' 
  END,
  next_station = CASE 
    WHEN current_status = 'service_ready' THEN (ARRAY['City Center', 'Airport Link', 'Harbor View', 'University', 'Tech Park'])[floor(random() * 5 + 1)]
    ELSE NULL 
  END,
  delay_minutes = CASE 
    WHEN current_status = 'service_ready' THEN floor(random() * 15)::int
    ELSE 0 
  END
WHERE current_status IN ('service_ready', 'maintenance', 'ibl_routed', 'out_of_service');
