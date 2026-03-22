-- ============================================
-- RISK PREDICTIONS UNIQUENESS
-- ============================================

-- Ensure only one (latest) prediction exists per trainset
ALTER TABLE public.risk_predictions 
ADD CONSTRAINT risk_predictions_trainset_id_key UNIQUE (trainset_id);
