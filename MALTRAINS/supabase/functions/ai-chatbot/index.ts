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
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!; 
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase environment variables are not correctly configured.');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        const { question } = await req.json();

        if (!question) {
            return new Response(JSON.stringify({ error: 'question is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Schema Context
        const schemaContext = `
You are an expert SQL assistant for the Schedura Metro Fleet Induction System.
Your task is to convert natural language questions into valid PostgreSQL queries.

TABLES:
- public.trainsets (id, rake_id, total_mileage_km, current_status, depot_id, branding_client, branding_priority)
- public.induction_plans (id, plan_date, status, total_trains_inducted, optimizer_score)
- public.induction_decisions (id, plan_id, trainset_id, decision, confidence_score, explanation_text, is_override, override_reason)
- public.fitness_certificates (id, trainset_id, certificate_type, issue_date, expiry_date)
- public.job_cards (id, trainset_id, title, criticality, status, due_date)
- public.risk_predictions (id, trainset_id, failure_probability, remaining_useful_life_days, risk_score, risk_level, confidence_score)
- public.branding_status (id, trainset_id, campaign_name, target_hours, accumulated_hours, is_active)

ENUMS:
- certificate_type: 'rolling_stock', 'signalling', 'telecom'
- induction_decision: 'inducted', 'standby', 'ibl_routed', 'held'
- job_criticality: 'critical', 'high', 'medium', 'low'
- job_status: 'open', 'in_progress', 'closed', 'deferred'

RULES:
1. Only return the SQL query. Do not include any explanation.
2. The user asking the question is authenticated.
3. Use joins where necessary (e.g., join trainsets with induction_decisions on trainset_id).
4. For 'rejected' trains, look for decision = 'held' or 'ibl_routed'.
5. For 'highest risk', look at risk_predictions ordered by risk_score DESC.
6. Return a maximum of 10 rows for list queries unless specified.
7. Always include rake_id in results if referring to a trainset.
`;

        // Logic to determine if we should use the AI or stay mock
        // Since we don't have a real AI API key here, we'll use the execute_ai_query RPC
        // with the SQL we generate via basic pattern matching for this activation phase.

        let sql = '';
        let answer = '';

        const lowerQuestion = question.toLowerCase();

        if (lowerQuestion.includes('risk') || lowerQuestion.includes('highest')) {
            sql = 'SELECT t.rake_id, r.risk_score, r.risk_level, r.failure_probability FROM public.trainsets t JOIN public.risk_predictions r ON t.id = r.trainset_id ORDER BY r.risk_score DESC LIMIT 5;';
            answer = "Here are the top 5 trainsets with the highest risk scores according to the predictive maintenance model.";
        } else if (lowerQuestion.includes('standby') || lowerQuestion.includes('held') || lowerQuestion.includes('rejected')) {
            sql = "SELECT t.rake_id, d.decision, d.explanation_text FROM public.trainsets t JOIN public.induction_decisions d ON t.id = d.trainset_id WHERE d.decision IN ('standby', 'held') LIMIT 5;";
            answer = "I found these trainsets currently marked as standby or held in the induction plans.";
        } else if (lowerQuestion.includes('mileage') || lowerQuestion.includes('total distance')) {
            sql = "SELECT rake_id, total_mileage_km, current_status FROM public.trainsets ORDER BY total_mileage_km DESC LIMIT 5;";
            answer = "Here are the trainsets with the highest recorded mileage.";
        } else if (lowerQuestion.includes('branding') || lowerQuestion.includes('campaign')) {
            sql = "SELECT t.rake_id, b.campaign_name, b.accumulated_hours, b.target_hours FROM public.trainsets t JOIN public.branding_status b ON t.id = b.trainset_id WHERE b.is_active = true LIMIT 5;";
            answer = "Tracking current branding campaign exposure for active trainsets.";
        } else {
            sql = "SELECT rake_id, current_status, route FROM public.trainsets LIMIT 5;";
            answer = "Here is an overview of the current fleet status. You can ask me about maintenance risks, standby trains, or branding exposure.";
        }

        // Execute the SQL via the secure RPC
        const { data: queryResult, error: queryError } = await supabaseAdmin.rpc('execute_ai_query', {
            sql_query: sql
        });

        if (queryError) {
            console.error('RPC Error:', queryError);
            throw queryError;
        }

        return new Response(JSON.stringify({
            success: true,
            question,
            answer,
            data: queryResult,
            sql_generated: sql
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Chatbot error:', error);
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
