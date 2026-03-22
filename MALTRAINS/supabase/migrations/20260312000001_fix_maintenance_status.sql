-- Bulk update to fix status for trains over mileage threshold
UPDATE public.trainsets
SET current_status = 'maintenance'
WHERE total_mileage_km >= 5000 
AND current_status = 'service_ready';

-- Ensure alerts exist for these trains if they don't already
INSERT INTO public.alerts (title, message, severity, alert_type, is_resolved)
SELECT 
  'Maintenance Required: ' || rake_id,
  'Status Alignment: Train ' || rake_id || ' is over 5000km limit. Status set to Maintenance.',
  'high',
  'maintenance',
  false
FROM public.trainsets
WHERE total_mileage_km >= 5000
AND NOT EXISTS (
  SELECT 1 FROM public.alerts 
  WHERE title LIKE '%' || rake_id || '%' 
  AND alert_type = 'maintenance' 
  AND is_resolved = false
);
