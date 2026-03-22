-- Seed real-world Kerala train data for college presentation demo
-- Vande Bharat (Rake-06) near threshold
UPDATE public.trainsets
SET 
  total_mileage_km = 4990,
  current_status = 'service_ready'
WHERE rake_id = 'Rake-06';

-- Venad Express (Rake-12) standard operational state
UPDATE public.trainsets
SET 
  total_mileage_km = 1200,
  current_status = 'service_ready'
WHERE rake_id = 'Rake-12';

-- Ensure these trains have no active maintenance alerts for a fresh start
DELETE FROM public.alerts 
WHERE title LIKE '%Rake-06%' OR title LIKE '%Rake-12%';
