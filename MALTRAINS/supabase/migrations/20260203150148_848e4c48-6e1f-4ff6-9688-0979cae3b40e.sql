-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.is_certificate_valid(cert_expiry_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT cert_expiry_date >= CURRENT_DATE
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_decision_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.decision IS DISTINCT FROM NEW.decision THEN
        INSERT INTO public.decision_audit_log (
            decision_id, plan_id, trainset_id, action, old_value, new_value, changed_by, change_reason
        ) VALUES (
            NEW.id,
            NEW.plan_id,
            NEW.trainset_id,
            'decision_changed',
            jsonb_build_object('decision', OLD.decision, 'confidence_score', OLD.confidence_score),
            jsonb_build_object('decision', NEW.decision, 'confidence_score', NEW.confidence_score, 'is_override', NEW.is_override),
            NEW.override_by,
            NEW.override_reason
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;