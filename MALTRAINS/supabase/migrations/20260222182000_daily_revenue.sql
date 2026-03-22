-- Create daily_revenue table
CREATE TABLE IF NOT EXISTS public.daily_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_revenue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.daily_revenue
    FOR SELECT USING (true);

CREATE POLICY "Enable insert/update for admins" ON public.daily_revenue
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    ));

-- Insert some mock data for the current week so the chart isn't empty
INSERT INTO public.daily_revenue (date, amount)
VALUES 
    (CURRENT_DATE - INTERVAL '6 days', 150000),
    (CURRENT_DATE - INTERVAL '5 days', 180000),
    (CURRENT_DATE - INTERVAL '4 days', 165000),
    (CURRENT_DATE - INTERVAL '3 days', 190000),
    (CURRENT_DATE - INTERVAL '2 days', 210000),
    (CURRENT_DATE - INTERVAL '1 day', 175000),
    (CURRENT_DATE, 205000)
ON CONFLICT (date) DO NOTHING;
