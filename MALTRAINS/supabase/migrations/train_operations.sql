-- ============================================
-- 1. FIX MISSING TABLES (resolves the 400 Bad Request error)
-- ============================================
CREATE TABLE IF NOT EXISTS public.risk_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    failure_probability DECIMAL(5, 2),
    remaining_useful_life_days INTEGER,
    risk_score DECIMAL(5, 2),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(5, 2),
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    prediction_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view risk_predictions" ON public.risk_predictions;
CREATE POLICY "Allow all authenticated users to view risk_predictions" ON public.risk_predictions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.daily_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_revenue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated users to view revenue" ON public.daily_revenue;
CREATE POLICY "Allow all authenticated users to view revenue" ON public.daily_revenue FOR SELECT TO authenticated USING (true);

-- Insert dummy data if empty to prevent UI 404/Empty states
INSERT INTO public.daily_revenue (date, amount)
VALUES (CURRENT_DATE, 150000)
ON CONFLICT (date) DO NOTHING;

-- ============================================
-- 2. CREATE NEW TRAIN OPERATIONS LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.train_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainset_id UUID REFERENCES public.trainsets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    user_email TEXT NOT NULL, -- Storing email directly for easy querying by admin
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active' or 'completed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies for train_runs
ALTER TABLE public.train_runs ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
DROP POLICY IF EXISTS "Admins can manage train_runs" ON public.train_runs;
CREATE POLICY "Admins can manage train_runs" ON public.train_runs FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert and update their own runs
DROP POLICY IF EXISTS "Users can view all train_runs" ON public.train_runs;
CREATE POLICY "Users can view all train_runs" ON public.train_runs FOR SELECT 
TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert their own runs" ON public.train_runs;
CREATE POLICY "Users can insert their own runs" ON public.train_runs FOR INSERT 
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own runs" ON public.train_runs;
CREATE POLICY "Users can update their own runs" ON public.train_runs FOR UPDATE 
TO authenticated USING (auth.uid() = user_id);
