-- ============================================
-- MALTRAINS INDUCTION PLANNING SYSTEM SCHEMA
-- ============================================

-- 1. Create role enum for RBAC
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'planner');

-- 2. Create trainset status enum
CREATE TYPE public.trainset_status AS ENUM ('service_ready', 'standby', 'maintenance', 'ibl_routed', 'out_of_service');

-- 3. Create fitness certificate type enum
CREATE TYPE public.certificate_type AS ENUM ('rolling_stock', 'signalling', 'telecom');

-- 4. Create job card criticality enum
CREATE TYPE public.job_criticality AS ENUM ('critical', 'high', 'medium', 'low');

-- 5. Create job card status enum
CREATE TYPE public.job_status AS ENUM ('open', 'in_progress', 'closed', 'deferred');

-- 6. Create induction decision enum
CREATE TYPE public.induction_decision AS ENUM ('inducted', 'standby', 'ibl_routed', 'held');

-- 7. Create cleaning slot status enum
CREATE TYPE public.cleaning_status AS ENUM ('available', 'booked', 'completed', 'cancelled');

-- ============================================
-- USER ROLES TABLE (for RBAC)
-- ============================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- ============================================
-- DEPOTS TABLE
-- ============================================
CREATE TABLE public.depots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    location TEXT,
    total_bays INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.depots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRAINSETS TABLE
-- ============================================
CREATE TABLE public.trainsets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rake_id TEXT NOT NULL UNIQUE,
    depot_id UUID REFERENCES public.depots(id),
    car_count INTEGER NOT NULL DEFAULT 4,
    total_mileage_km DECIMAL(12, 2) NOT NULL DEFAULT 0,
    current_status trainset_status NOT NULL DEFAULT 'standby',
    current_bay TEXT,
    route TEXT,
    branding_client TEXT,
    branding_priority INTEGER DEFAULT 0,
    branding_exposure_hours DECIMAL(10, 2) DEFAULT 0,
    branding_sla_hours_required DECIMAL(10, 2) DEFAULT 0,
    last_service_date DATE,
    next_scheduled_maintenance DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trainsets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FITNESS CERTIFICATES TABLE (without generated column)
-- ============================================
CREATE TABLE public.fitness_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    certificate_type certificate_type NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    issuing_authority TEXT,
    certificate_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trainset_id, certificate_type)
);

ALTER TABLE public.fitness_certificates ENABLE ROW LEVEL SECURITY;

-- Function to check certificate validity (computed at query time)
CREATE OR REPLACE FUNCTION public.is_certificate_valid(cert_expiry_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT cert_expiry_date >= CURRENT_DATE
$$;

-- ============================================
-- JOB CARDS TABLE (from IBM Maximo)
-- ============================================
CREATE TABLE public.job_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    maximo_job_id TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    criticality job_criticality NOT NULL DEFAULT 'medium',
    status job_status NOT NULL DEFAULT 'open',
    work_type TEXT,
    assigned_to TEXT,
    estimated_hours DECIMAL(6, 2),
    actual_hours DECIMAL(6, 2),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STABLING BAYS TABLE
-- ============================================
CREATE TABLE public.stabling_bays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    depot_id UUID REFERENCES public.depots(id) ON DELETE CASCADE NOT NULL,
    bay_number TEXT NOT NULL,
    bay_type TEXT DEFAULT 'standard',
    is_ibl BOOLEAN DEFAULT false,
    capacity INTEGER DEFAULT 1,
    current_occupancy INTEGER DEFAULT 0,
    geometry_order INTEGER,
    adjacent_bays TEXT[],
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (depot_id, bay_number)
);

ALTER TABLE public.stabling_bays ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CLEANING SLOTS TABLE
-- ============================================
CREATE TABLE public.cleaning_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    depot_id UUID REFERENCES public.depots(id) ON DELETE CASCADE NOT NULL,
    slot_date DATE NOT NULL,
    slot_time_start TIME NOT NULL,
    slot_time_end TIME NOT NULL,
    slot_type TEXT DEFAULT 'standard',
    status cleaning_status NOT NULL DEFAULT 'available',
    trainset_id UUID REFERENCES public.trainsets(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_slots ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INDUCTION PLANS TABLE
-- ============================================
CREATE TABLE public.induction_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_date DATE NOT NULL,
    execution_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_nightly_run BOOLEAN DEFAULT true,
    status TEXT NOT NULL DEFAULT 'draft',
    total_trains_inducted INTEGER DEFAULT 0,
    total_trains_standby INTEGER DEFAULT 0,
    total_trains_ibl INTEGER DEFAULT 0,
    optimizer_score DECIMAL(5, 2),
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.induction_plans ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INDUCTION DECISIONS TABLE
-- ============================================
CREATE TABLE public.induction_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES public.induction_plans(id) ON DELETE CASCADE NOT NULL,
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    decision induction_decision NOT NULL,
    rank_order INTEGER,
    confidence_score DECIMAL(5, 2),
    assigned_bay_id UUID REFERENCES public.stabling_bays(id),
    assigned_route TEXT,
    fitness_compliance JSONB,
    maintenance_status JSONB,
    mileage_rationale JSONB,
    branding_consideration JSONB,
    stabling_impact JSONB,
    cleaning_status JSONB,
    explanation_text TEXT,
    is_override BOOLEAN DEFAULT false,
    override_by UUID REFERENCES auth.users(id),
    override_reason TEXT,
    override_at TIMESTAMPTZ,
    original_decision induction_decision,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (plan_id, trainset_id)
);

ALTER TABLE public.induction_decisions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DECISION AUDIT LOG TABLE
-- ============================================
CREATE TABLE public.decision_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID REFERENCES public.induction_decisions(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.induction_plans(id) ON DELETE CASCADE,
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decision_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SIMULATIONS TABLE
-- ============================================
CREATE TABLE public.simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_plan_id UUID REFERENCES public.induction_plans(id),
    simulation_name TEXT NOT NULL,
    parameters JSONB NOT NULL,
    results JSONB,
    comparison_metrics JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MILEAGE HISTORY TABLE
-- ============================================
CREATE TABLE public.mileage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    recorded_date DATE NOT NULL,
    mileage_km DECIMAL(10, 2) NOT NULL,
    route TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mileage_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STAFF ATTENDANCE TABLE
-- ============================================
CREATE TABLE public.staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_name TEXT NOT NULL,
    employee_id TEXT,
    role TEXT,
    depot_id UUID REFERENCES public.depots(id),
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    check_out_time TIMESTAMPTZ,
    status TEXT DEFAULT 'present',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_trainset_id UUID REFERENCES public.trainsets(id),
    related_plan_id UUID REFERENCES public.induction_plans(id),
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Depots policies
CREATE POLICY "Authenticated users can view depots"
ON public.depots FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Admins can manage depots"
ON public.depots FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trainsets policies
CREATE POLICY "Authenticated users can view trainsets"
ON public.trainsets FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners and above can update trainsets"
ON public.trainsets FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

CREATE POLICY "Admins can insert trainsets"
ON public.trainsets FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fitness certificates policies
CREATE POLICY "Authenticated users can view certificates"
ON public.fitness_certificates FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Supervisors and admins can manage certificates"
ON public.fitness_certificates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Job cards policies
CREATE POLICY "Authenticated users can view job cards"
ON public.job_cards FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners and above can manage job cards"
ON public.job_cards FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

-- Stabling bays policies
CREATE POLICY "Authenticated users can view stabling bays"
ON public.stabling_bays FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Admins can manage stabling bays"
ON public.stabling_bays FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Cleaning slots policies
CREATE POLICY "Authenticated users can view cleaning slots"
ON public.cleaning_slots FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners and above can manage cleaning slots"
ON public.cleaning_slots FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

-- Induction plans policies
CREATE POLICY "Authenticated users can view induction plans"
ON public.induction_plans FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners can create plans"
ON public.induction_plans FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

CREATE POLICY "Supervisors and admins can update plans"
ON public.induction_plans FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Induction decisions policies
CREATE POLICY "Authenticated users can view decisions"
ON public.induction_decisions FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners can create decisions"
ON public.induction_decisions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

CREATE POLICY "Supervisors can override decisions"
ON public.induction_decisions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'));

-- Decision audit log policies
CREATE POLICY "Authenticated users can view audit log"
ON public.decision_audit_log FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "System can insert audit logs"
ON public.decision_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));

-- Simulations policies
CREATE POLICY "Authenticated users can view simulations"
ON public.simulations FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners can create simulations"
ON public.simulations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

-- Mileage history policies
CREATE POLICY "Authenticated users can view mileage history"
ON public.mileage_history FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners can insert mileage records"
ON public.mileage_history FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

-- Staff attendance policies
CREATE POLICY "Authenticated users can view attendance"
ON public.staff_attendance FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Planners can manage attendance"
ON public.staff_attendance FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'planner'));

-- Alerts policies
CREATE POLICY "Authenticated users can view alerts"
ON public.alerts FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "System can manage alerts"
ON public.alerts FOR ALL
TO authenticated
USING (public.has_any_role(auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_depots_updated_at BEFORE UPDATE ON public.depots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trainsets_updated_at BEFORE UPDATE ON public.trainsets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fitness_certificates_updated_at BEFORE UPDATE ON public.fitness_certificates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_job_cards_updated_at BEFORE UPDATE ON public.job_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stabling_bays_updated_at BEFORE UPDATE ON public.stabling_bays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cleaning_slots_updated_at BEFORE UPDATE ON public.cleaning_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_induction_plans_updated_at BEFORE UPDATE ON public.induction_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_induction_decisions_updated_at BEFORE UPDATE ON public.induction_decisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit logging trigger
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_induction_decision_changes
AFTER UPDATE ON public.induction_decisions
FOR EACH ROW EXECUTE FUNCTION public.log_decision_changes();