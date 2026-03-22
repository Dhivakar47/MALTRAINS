-- ============================================
-- SCHEDURA REFINEMENT MIGRATION
-- ============================================

-- 1. Add 'user' role to app_role enum
ALTER TYPE public.app_role ADD VALUE 'user';

-- 2. Update handle_new_user_role to assign 'user' instead of 'planner' by default
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Create branding_status table
CREATE TABLE public.branding_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    campaign_name TEXT NOT NULL,
    company_name TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    target_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
    accumulated_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_status ENABLE ROW LEVEL SECURITY;

-- 4. Create risk_predictions table
CREATE TABLE public.risk_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    failure_probability DECIMAL(5, 2), -- 0.00 to 100.00
    remaining_useful_life_days INTEGER,
    risk_score DECIMAL(5, 2), -- Weighted score
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(5, 2),
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    prediction_data JSONB, -- For detailed metrics
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_predictions ENABLE ROW LEVEL SECURITY;

-- 5. Create audit_logs table (general purpose)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Indices for performance
CREATE INDEX idx_branding_trainset ON public.branding_status(trainset_id);
CREATE INDEX idx_risk_trainset ON public.risk_predictions(trainset_id);
CREATE INDEX idx_audit_record ON public.audit_logs(record_id);

-- 7. RLS POLICIES

-- Branding Status
CREATE POLICY "Authenticated users can view branding status"
ON public.branding_status FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners and above can manage branding status"
ON public.branding_status FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

-- Risk Predictions
CREATE POLICY "Authenticated users can view risk predictions"
ON public.risk_predictions FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "System can manage risk predictions"
ON public.risk_predictions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Audit Logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Updated AT Triggers
CREATE TRIGGER update_branding_status_updated_at BEFORE UPDATE ON public.branding_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
