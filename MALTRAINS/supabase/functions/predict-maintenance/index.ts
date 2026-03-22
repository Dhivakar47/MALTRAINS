import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Fetch all trainsets with history
        const { data: trainsets, error: trainsetError } = await supabase
            .from('trainsets')
            .select(`
        *,
        fitness_certificates (*),
        job_cards (*),
        mileage_history (*)
      `);

        if (trainsetError) throw trainsetError;

        const results = [];
        const today = new Date();

        for (const trainset of trainsets) {
            // 1. Calculate History-based risk
            const jobCards = trainset.job_cards || [];
            const criticalJobs = jobCards.filter((j: any) => j.criticality === 'critical' && j.status !== 'closed').length;
            const recentJobsCount = jobCards.filter((j: any) => {
                const createdDate = new Date(j.created_at);
                const diffDays = Math.ceil((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= 30;
            }).length;

            // 2. Mileage-based risk
            const totalMileage = Number(trainset.total_mileage_km) || 0;
            const mileageRisk = Math.min(40, (totalMileage % 5000) / 5000 * 40); // Arbitrary periodic risk every 5000km

            // 3. Fitness risk
            const certs = trainset.fitness_certificates || [];
            const expiringSoon = certs.some((c: any) => {
                const expiryDate = new Date(c.expiry_date);
                const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays <= 7;
            });

            // Simple Weighted Probability Model
            let probability = 10; // Baseline
            probability += (criticalJobs * 20);
            probability += (recentJobsCount * 5);
            probability += mileageRisk;
            if (expiringSoon) probability += 15;

            probability = Math.min(99, probability);

            // RUL Estimation (Placeholder Logic)
            // RUL decreases as probability increases
            let rul = Math.max(1, Math.floor((100 - probability) * 1.8));

            // Risk Level
            let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
            if (probability > 80 || criticalJobs > 0) level = 'critical';
            else if (probability > 50) level = 'high';
            else if (probability > 30) level = 'medium';

            results.push({
                trainset_id: trainset.id,
                failure_probability: probability,
                remaining_useful_life_days: rul,
                risk_score: probability,
                risk_level: level,
                confidence_score: 85, // Static confidence for this simple model
                prediction_data: {
                    factors: {
                        critical_jobs: criticalJobs,
                        recent_activity: recentJobsCount,
                        mileage_impact: Math.round(mileageRisk),
                        fitness_warning: expiringSoon
                    }
                }
            });
        }

        // Clear old predictions and insert new ones
        // We update rather than clear to maintain historical context if needed, 
        // but for "nightly update" we'll just insert/upsert.
        const { error: upsertError } = await supabase
            .from('risk_predictions')
            .upsert(results, { onConflict: 'trainset_id' }); // Assuming unique constraint on trainset_id if only latest is needed

        if (upsertError) throw upsertError;

        return new Response(JSON.stringify({
            success: true,
            count: results.length,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Maintenance prediction error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
