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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
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

    const { decision_id } = await req.json();

    if (!decision_id) {
      return new Response(JSON.stringify({ error: 'decision_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch decision with all context
    const { data: decision, error: decisionError } = await supabase
      .from('induction_decisions')
      .select(`
        *,
        trainsets (
          rake_id,
          total_mileage_km,
          branding_client,
          branding_priority,
          branding_exposure_hours,
          branding_sla_hours_required,
          current_bay,
          route
        ),
        induction_plans (
          plan_date,
          status
        )
      `)
      .eq('id', decision_id)
      .single();

    if (decisionError || !decision) {
      return new Response(JSON.stringify({ error: 'Decision not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate AI explanation
    const prompt = `You are a railway operations expert explaining induction decisions for metro trainsets. 

Generate a detailed, human-readable explanation for this induction decision:

Trainset: ${decision.trainsets?.rake_id}
Decision: ${decision.decision.toUpperCase()}
Confidence: ${decision.confidence_score}%
Rank: ${decision.rank_order}

Context:
- Fitness Compliance: ${JSON.stringify(decision.fitness_compliance)}
- Maintenance Status: ${JSON.stringify(decision.maintenance_status)}
- Mileage Data: ${JSON.stringify(decision.mileage_rationale)}
- Branding Requirements: ${JSON.stringify(decision.branding_consideration)}
- Stabling Impact: ${JSON.stringify(decision.stabling_impact)}
- Cleaning Status: ${JSON.stringify(decision.cleaning_status)}

${decision.is_override ? `This decision was manually overridden. Original decision: ${decision.original_decision}. Reason: ${decision.override_reason}` : ''}

Provide a clear explanation covering:
1. Summary of the decision
2. Fitness certificate status
3. Maintenance considerations
4. Mileage balancing rationale
5. Branding SLA impact (if applicable)
6. Overall recommendation

Keep the explanation professional, concise, and suitable for railway safety documentation.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a railway operations expert providing clear, professional explanations for trainset induction decisions.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      // Fall back to structured explanation if AI fails
      const structuredExplanation = generateStructuredExplanation(decision);
      return new Response(JSON.stringify({
        success: true,
        decision_id,
        trainset: decision.trainsets?.rake_id,
        decision: decision.decision,
        explanation: structuredExplanation,
        details: {
          fitness_compliance: decision.fitness_compliance,
          maintenance_status: decision.maintenance_status,
          mileage_rationale: decision.mileage_rationale,
          branding_consideration: decision.branding_consideration,
          stabling_impact: decision.stabling_impact,
          cleaning_status: decision.cleaning_status
        },
        is_override: decision.is_override,
        override_reason: decision.override_reason
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    const aiExplanation = aiData.choices?.[0]?.message?.content || decision.explanation_text;

    return new Response(JSON.stringify({
      success: true,
      decision_id,
      trainset: decision.trainsets?.rake_id,
      decision: decision.decision,
      confidence_score: decision.confidence_score,
      rank_order: decision.rank_order,
      explanation: aiExplanation,
      details: {
        fitness_compliance: decision.fitness_compliance,
        maintenance_status: decision.maintenance_status,
        mileage_rationale: decision.mileage_rationale,
        branding_consideration: decision.branding_consideration,
        stabling_impact: decision.stabling_impact,
        cleaning_status: decision.cleaning_status
      },
      is_override: decision.is_override,
      override_reason: decision.override_reason,
      plan_date: decision.induction_plans?.plan_date
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Explain error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateStructuredExplanation(decision: any): string {
  const parts: string[] = [];
  
  parts.push(`## Decision Summary\n`);
  parts.push(`Trainset ${decision.trainsets?.rake_id} has been marked as **${decision.decision.toUpperCase()}** with ${decision.confidence_score}% confidence.\n`);
  
  if (decision.fitness_compliance) {
    parts.push(`\n### Fitness Compliance\n`);
    parts.push((decision.fitness_compliance as any).message || 'Status checked.');
  }
  
  if (decision.maintenance_status) {
    parts.push(`\n### Maintenance Status\n`);
    parts.push((decision.maintenance_status as any).message || 'No pending critical jobs.');
  }
  
  if (decision.mileage_rationale) {
    parts.push(`\n### Mileage Analysis\n`);
    parts.push((decision.mileage_rationale as any).message || 'Mileage within acceptable range.');
  }
  
  if (decision.branding_consideration && (decision.branding_consideration as any).client) {
    parts.push(`\n### Branding Requirements\n`);
    parts.push((decision.branding_consideration as any).message || 'No branding constraints.');
  }
  
  if (decision.is_override) {
    parts.push(`\n### Override Notice\n`);
    parts.push(`This decision was manually overridden from ${decision.original_decision}. Reason: ${decision.override_reason}`);
  }
  
  return parts.join('\n');
}
