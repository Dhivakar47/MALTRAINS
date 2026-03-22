import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SimulationParams {
  simulation_name: string;
  base_plan_id?: string;
  parameters: {
    exclude_trainsets?: string[];
    force_induct?: string[];
    force_standby?: string[];
    max_inducted?: number;
    min_mileage_priority?: boolean;
    ignore_branding?: boolean;
  };
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
    const { simulation_name, base_plan_id, parameters } = await req.json() as SimulationParams;

    if (!simulation_name || !parameters) {
      return new Response(JSON.stringify({ 
        error: 'simulation_name and parameters are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch trainsets
    let query = supabase
      .from('trainsets')
      .select(`
        *,
        fitness_certificates (*),
        job_cards (*)
      `);

    if (parameters.exclude_trainsets?.length) {
      query = query.not('rake_id', 'in', `(${parameters.exclude_trainsets.join(',')})`);
    }

    const { data: trainsets, error: trainsetError } = await query;

    if (trainsetError) {
      throw new Error(`Failed to fetch trainsets: ${trainsetError.message}`);
    }

    // Run simulation with modified parameters
    const today = new Date().toISOString().split('T')[0];
    const fleetAvgMileage = trainsets!.reduce((sum, t) => sum + Number(t.total_mileage_km), 0) / trainsets!.length;

    const simulatedDecisions = trainsets!.map(trainset => {
      const rakeId = trainset.rake_id;
      
      // Check fitness
      const requiredTypes = ['rolling_stock', 'signalling', 'telecom'];
      const certificates = trainset.fitness_certificates || [];
      let fitnessValid = true;
      
      for (const type of requiredTypes) {
        const cert = certificates.find((c: any) => c.certificate_type === type);
        if (!cert || cert.expiry_date < today) {
          fitnessValid = false;
          break;
        }
      }

      // Check maintenance
      const jobCards = trainset.job_cards || [];
      const criticalJobs = jobCards.filter((j: any) => j.status !== 'closed' && j.criticality === 'critical');
      const maintenanceClear = criticalJobs.length === 0;

      // Calculate mileage score
      const mileageDeviation = Number(trainset.total_mileage_km) - fleetAvgMileage;
      let mileageScore = Math.max(0, 100 - ((mileageDeviation / fleetAvgMileage) * 100 + 50));
      
      if (parameters.min_mileage_priority) {
        mileageScore = mileageScore * 1.5; // Boost low-mileage priority
      }

      // Calculate branding priority
      let brandingPriority = 0;
      if (!parameters.ignore_branding && trainset.branding_client) {
        const deficit = Number(trainset.branding_sla_hours_required) - Number(trainset.branding_exposure_hours);
        brandingPriority = deficit > 0 ? Math.min(100, (deficit / Number(trainset.branding_sla_hours_required)) * 100) : 0;
      }

      // Determine decision
      let decision: string;
      let confidence: number;

      // Apply forced decisions
      if (parameters.force_induct?.includes(rakeId)) {
        decision = 'inducted';
        confidence = 100;
      } else if (parameters.force_standby?.includes(rakeId)) {
        decision = 'standby';
        confidence = 100;
      } else if (!fitnessValid) {
        decision = 'held';
        confidence = 95;
      } else if (!maintenanceClear) {
        decision = 'ibl_routed';
        confidence = 90;
      } else {
        const compositeScore = (mileageScore * 0.4) + (brandingPriority * 0.3) + 30;
        decision = compositeScore >= 60 ? 'inducted' : 'standby';
        confidence = Math.min(95, 70 + compositeScore * 0.25);
      }

      return {
        trainset_id: trainset.id,
        rake_id: rakeId,
        decision,
        confidence_score: Math.round(confidence),
        mileage_km: trainset.total_mileage_km,
        fitness_valid: fitnessValid,
        maintenance_clear: maintenanceClear,
        branding_priority: brandingPriority
      };
    });

    // Apply max_inducted limit if specified
    if (parameters.max_inducted) {
      let inductedCount = 0;
      for (const d of simulatedDecisions) {
        if (d.decision === 'inducted') {
          inductedCount++;
          if (inductedCount > parameters.max_inducted) {
            d.decision = 'standby';
          }
        }
      }
    }

    // Calculate comparison metrics
    const summary = {
      total: simulatedDecisions.length,
      inducted: simulatedDecisions.filter(d => d.decision === 'inducted').length,
      standby: simulatedDecisions.filter(d => d.decision === 'standby').length,
      ibl_routed: simulatedDecisions.filter(d => d.decision === 'ibl_routed').length,
      held: simulatedDecisions.filter(d => d.decision === 'held').length,
      avg_confidence: Math.round(simulatedDecisions.reduce((sum, d) => sum + d.confidence_score, 0) / simulatedDecisions.length)
    };

    // Fetch base plan for comparison if provided
    let comparison = null;
    if (base_plan_id) {
      const { data: baseDecisions } = await supabase
        .from('induction_decisions')
        .select('trainset_id, decision')
        .eq('plan_id', base_plan_id);

      if (baseDecisions) {
        const changes = simulatedDecisions.filter(sim => {
          const base = baseDecisions.find(b => b.trainset_id === sim.trainset_id);
          return base && base.decision !== sim.decision;
        });

        comparison = {
          base_plan_id,
          total_changes: changes.length,
          changes: changes.map(c => ({
            rake_id: c.rake_id,
            from: baseDecisions.find(b => b.trainset_id === c.trainset_id)?.decision,
            to: c.decision
          }))
        };
      }
    }

    // Save simulation
    const { data: simulation, error: simError } = await supabase
      .from('simulations')
      .insert({
        simulation_name,
        base_plan_id,
        parameters,
        results: { decisions: simulatedDecisions, summary },
        comparison_metrics: comparison,
        created_by: userId
      })
      .select()
      .single();

    if (simError) {
      throw new Error(`Failed to save simulation: ${simError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      simulation_id: simulation.id,
      simulation_name,
      parameters,
      summary,
      decisions: simulatedDecisions,
      comparison
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Simulation error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
