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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub;
    const method = req.method;
    const url = new URL(req.url);

    if (method === 'GET') {
      const planId = url.searchParams.get('plan_id');
      const planDate = url.searchParams.get('plan_date');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      if (planId) {
        // Get specific plan with decisions
        const { data: plan, error } = await supabase
          .from('induction_plans')
          .select(`
            *,
            induction_decisions (
              *,
              trainsets (rake_id, current_bay, route, total_mileage_km)
            )
          `)
          .eq('id', planId)
          .single();

        if (error) {
          throw new Error(`Failed to fetch plan: ${error.message}`);
        }

        // Sort decisions by rank
        if (plan?.induction_decisions) {
          plan.induction_decisions.sort((a: any, b: any) => a.rank_order - b.rank_order);
        }

        return new Response(JSON.stringify({
          success: true,
          plan
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // List plans
      let query = supabase
        .from('induction_plans')
        .select('*')
        .order('plan_date', { ascending: false })
        .limit(limit);

      if (planDate) {
        query = query.eq('plan_date', planDate);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data: plans, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch plans: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        plans
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const { plan_id, status: newStatus, notes } = await req.json();

      if (!plan_id) {
        return new Response(JSON.stringify({ error: 'plan_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const updateData: any = {};
      if (newStatus) {
        updateData.status = newStatus;
        if (newStatus === 'approved') {
          updateData.approved_by = userId;
          updateData.approved_at = new Date().toISOString();
        }
      }
      if (notes) {
        updateData.notes = notes;
      }

      const { data: plan, error } = await supabase
        .from('induction_plans')
        .update(updateData)
        .eq('id', plan_id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update plan: ${error.message}`);
      }

      // Create alert for status change
      if (newStatus) {
        await supabase.from('alerts').insert({
          alert_type: 'plan_status_change',
          severity: newStatus === 'approved' ? 'info' : 'warning',
          title: `Induction Plan ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
          message: `Plan for ${plan.plan_date} has been ${newStatus}`,
          related_plan_id: plan_id
        });
      }

      return new Response(JSON.stringify({
        success: true,
        plan
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Plans error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
