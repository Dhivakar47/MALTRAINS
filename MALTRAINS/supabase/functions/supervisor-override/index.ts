import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OverrideRequest {
  decision_id: string;
  new_decision: 'inducted' | 'standby' | 'ibl_routed' | 'held';
  reason: string;
}

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
    const { decision_id, new_decision, reason } = await req.json() as OverrideRequest;

    if (!decision_id || !new_decision || !reason) {
      return new Response(JSON.stringify({ 
        error: 'decision_id, new_decision, and reason are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch current decision
    const { data: currentDecision, error: fetchError } = await supabase
      .from('induction_decisions')
      .select('*, trainsets(rake_id)')
      .eq('id', decision_id)
      .single();

    if (fetchError || !currentDecision) {
      return new Response(JSON.stringify({ error: 'Decision not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update with override
    const { data: updatedDecision, error: updateError } = await supabase
      .from('induction_decisions')
      .update({
        decision: new_decision,
        is_override: true,
        override_by: userId,
        override_reason: reason,
        override_at: new Date().toISOString(),
        original_decision: currentDecision.decision,
        explanation_text: `OVERRIDE: ${reason}. Original decision: ${currentDecision.decision}.`
      })
      .eq('id', decision_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update decision: ${updateError.message}`);
    }

    // Create alert for the override
    await supabase.from('alerts').insert({
      alert_type: 'decision_override',
      severity: 'warning',
      title: `Decision Override: ${currentDecision.trainsets?.rake_id || 'Unknown'}`,
      message: `Supervisor overrode ${currentDecision.decision} to ${new_decision}. Reason: ${reason}`,
      related_trainset_id: currentDecision.trainset_id,
      related_plan_id: currentDecision.plan_id
    });

    return new Response(JSON.stringify({
      success: true,
      original_decision: currentDecision.decision,
      new_decision,
      decision: updatedDecision
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Override error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
