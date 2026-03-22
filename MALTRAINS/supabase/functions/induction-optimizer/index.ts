import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TrainsetData {
  id: string;
  rake_id: string;
  total_mileage_km: number;
  current_status: string;
  current_bay: string | null;
  route: string | null;
  branding_client: string | null;
  branding_priority: number;
  branding_exposure_hours: number;
  branding_sla_hours_required: number;
  depot_id: string | null;
  fitness_certificates: FitnessCertificate[];
  job_cards: JobCard[];
  cleaning_slots: CleaningSlot[];
}

interface CleaningSlot {
  id: string;
  slot_date: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
}

interface StablingBay {
  id: string;
  bay_number: string;
  is_available: boolean;
  is_ibl: boolean;
  geometry_order: number;
}

interface FitnessCertificate {
  certificate_type: string;
  expiry_date: string;
  is_valid: boolean;
}

interface JobCard {
  id: string;
  title: string;
  criticality: string;
  status: string;
}

interface InductionDecision {
  trainset_id: string;
  rake_id: string;
  decision: 'inducted' | 'standby' | 'ibl_routed' | 'held';
  rank_order: number;
  confidence_score: number;
  fitness_compliance: object;
  maintenance_status: object;
  mileage_rationale: object;
  branding_consideration: object;
  stabling_impact: object;
  cleaning_status: object;
  explanation_text: string;
}

// Check if all fitness certificates are valid
function checkFitnessCompliance(trainset: TrainsetData): { compliant: boolean; details: object } {
  const requiredTypes = ['rolling_stock', 'signalling', 'telecom'];
  const certificates = trainset.fitness_certificates || [];

  const today = new Date().toISOString().split('T')[0];
  const compliance: Record<string, boolean> = {};
  let allValid = true;

  for (const type of requiredTypes) {
    const cert = certificates.find(c => c.certificate_type === type);
    if (!cert || cert.expiry_date < today) {
      compliance[type] = false;
      allValid = false;
    } else {
      compliance[type] = true;
    }
  }

  return {
    compliant: allValid,
    details: {
      certificates: compliance,
      message: allValid ? 'All fitness certificates valid' : 'One or more certificates expired or missing'
    }
  };
}

// Check maintenance status from job cards
function checkMaintenanceStatus(trainset: TrainsetData): { clear: boolean; details: object } {
  const jobCards = trainset.job_cards || [];
  const openCritical = jobCards.filter(j => j.status !== 'closed' && j.criticality === 'critical');
  const openHigh = jobCards.filter(j => j.status !== 'closed' && j.criticality === 'high');
  const openOther = jobCards.filter(j => j.status !== 'closed' && !['critical', 'high'].includes(j.criticality));

  return {
    clear: openCritical.length === 0,
    details: {
      critical_jobs: openCritical.length,
      high_jobs: openHigh.length,
      other_jobs: openOther.length,
      blocking_jobs: openCritical.map(j => ({ id: j.id, title: j.title })),
      message: openCritical.length === 0
        ? 'No critical maintenance pending'
        : `${openCritical.length} critical job(s) blocking induction`
    }
  };
}

// Calculate mileage score (lower mileage = higher priority for balancing)
function calculateMileageScore(trainset: TrainsetData, fleetAvgMileage: number): { score: number; details: object } {
  const mileage = trainset.total_mileage_km;
  const deviation = mileage - fleetAvgMileage;
  const percentDeviation = fleetAvgMileage > 0 ? (deviation / fleetAvgMileage) * 100 : 0;

  // Higher score for lower mileage (needs more service)
  const score = Math.max(0, 100 - (percentDeviation + 50));

  return {
    score: Math.round(score),
    details: {
      current_mileage: mileage,
      fleet_average: Math.round(fleetAvgMileage),
      deviation_percent: Math.round(percentDeviation),
      message: deviation < 0
        ? `${Math.abs(Math.round(percentDeviation))}% below fleet average - prioritize for service`
        : `${Math.round(percentDeviation)}% above fleet average - can defer`
    }
  };
}

// Check cleaning availability
function checkCleaningStatus(trainset: TrainsetData, planDate: string): { status: string; details: object } {
  const slots = trainset.cleaning_slots || [];
  const planDateSlot = slots.find(s => s.slot_date === planDate);

  if (planDateSlot && planDateSlot.status === 'booked') {
    return {
      status: 'scheduled',
      details: { message: 'Cleaning scheduled for today' }
    };
  }

  return {
    status: 'pending',
    details: { message: 'No cleaning slot booked for today' }
  };
}

// Check stabling impact
function checkStablingImpact(trainset: TrainsetData, bays: StablingBay[]): { score: number; details: object } {
  const depotBays = bays.filter(b => !b.is_ibl);
  const availableBays = depotBays.filter(b => b.is_available);

  if (availableBays.length === 0) {
    return {
      score: 0,
      details: { message: 'Critical: No standard stabling bays available in depot' }
    };
  }

  // Prefer bays with lower geometry order for easier stabling
  const bestBay = availableBays.sort((a, b) => a.geometry_order - b.geometry_order)[0];

  return {
    score: 80,
    details: {
      message: `Bay ${bestBay.bay_number} available`,
      suggested_bay_id: bestBay.id,
      available_count: availableBays.length
    }
  };
}

// Check branding requirements
function checkBrandingRequirements(trainset: TrainsetData): { priority: number; details: object } {
  if (!trainset.branding_client) {
    return {
      priority: 0,
      details: { message: 'No branding contract' }
    };
  }

  const hoursDeficit = trainset.branding_sla_hours_required - trainset.branding_exposure_hours;
  const urgency = hoursDeficit > 0 ? Math.min(100, (hoursDeficit / trainset.branding_sla_hours_required) * 100) : 0;

  return {
    priority: Math.round(urgency),
    details: {
      client: trainset.branding_client,
      exposure_hours: trainset.branding_exposure_hours,
      required_hours: trainset.branding_sla_hours_required,
      deficit_hours: Math.max(0, hoursDeficit),
      message: hoursDeficit > 0
        ? `Needs ${Math.round(hoursDeficit)} more hours for SLA compliance`
        : 'SLA requirements met'
    }
  };
}

// Main optimization function
function runOptimization(trainsets: TrainsetData[], planDate: string, bays: StablingBay[]): InductionDecision[] {
  const fleetAvgMileage = trainsets.reduce((sum, t) => sum + t.total_mileage_km, 0) / (trainsets.length || 1);

  const decisions: InductionDecision[] = trainsets.map((trainset) => {
    const fitness = checkFitnessCompliance(trainset);
    const maintenance = checkMaintenanceStatus(trainset);
    const mileage = calculateMileageScore(trainset, fleetAvgMileage);
    const branding = checkBrandingRequirements(trainset);
    const cleaning = checkCleaningStatus(trainset, planDate);
    const stabling = checkStablingImpact(trainset, bays.filter(b => b.is_ibl === false));

    // Decision logic
    let decision: 'inducted' | 'standby' | 'ibl_routed' | 'held';
    let confidence: number;
    let explanation: string;

    if (!fitness.compliant) {
      decision = 'held';
      confidence = 95;
      explanation = `HELD: Fitness compliance failure. ${(fitness.details as any).message}`;
    } else if (!maintenance.clear) {
      decision = 'ibl_routed';
      confidence = 90;
      explanation = `IBL ROUTED: Critical maintenance required. ${(maintenance.details as any).message}`;
    } else {
      // Calculate composite score for ranking
      // Weights: Mileage (30%), Branding (30%), Stabling (20%), Cleaning (20%)
      const stablingScore = stabling.score || 0;
      const cleaningScore = cleaning.status === 'scheduled' ? 100 : 50;

      const compositeScore = (mileage.score * 0.3) + (branding.priority * 0.3) + (stablingScore * 0.2) + (cleaningScore * 0.2);

      if (compositeScore >= 60) {
        decision = 'inducted';
        confidence = Math.min(95, 70 + compositeScore * 0.25);
        explanation = `INDUCTED: Fit for service. Score: ${Math.round(compositeScore)}. ${branding.priority > 0 ? 'Branding priority.' : ''} ${cleaning.status === 'scheduled' ? 'Cleaning confirmed.' : ''}`;
      } else {
        decision = 'standby';
        confidence = 75;
        explanation = `STANDBY: Fit but lower priority. Score: ${Math.round(compositeScore)}. ${(mileage.details as any).message}`;
      }
    }

    return {
      trainset_id: trainset.id,
      rake_id: trainset.rake_id,
      decision,
      rank_order: 0,
      confidence_score: Math.round(confidence),
      fitness_compliance: fitness.details,
      maintenance_status: maintenance.details,
      mileage_rationale: mileage.details,
      branding_consideration: branding.details,
      stabling_impact: stabling.details,
      cleaning_status: cleaning.details,
      explanation_text: explanation
    };
  });

  // Sort by decision priority and confidence
  const decisionOrder = { inducted: 0, standby: 1, ibl_routed: 2, held: 3 };
  decisions.sort((a, b) => {
    if (decisionOrder[a.decision] !== decisionOrder[b.decision]) {
      return decisionOrder[a.decision] - decisionOrder[b.decision];
    }
    return b.confidence_score - a.confidence_score;
  });

  // Assign rank order
  decisions.forEach((d, i) => d.rank_order = i + 1);

  return decisions;
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
    const { plan_date, is_simulation = false } = await req.json();

    if (!plan_date) {
      return new Response(JSON.stringify({ error: 'plan_date is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch all trainsets with their certificates, job cards, and cleaning slots
    const { data: trainsets, error: trainsetError } = await supabase
      .from('trainsets')
      .select(`
        *,
        fitness_certificates (*),
        job_cards (*),
        cleaning_slots (*)
      `);

    if (trainsetError) {
      throw new Error(`Failed to fetch trainsets: ${trainsetError.message}`);
    }

    // Fetch stabling bays
    const { data: bays, error: baysError } = await supabase
      .from('stabling_bays')
      .select('*');

    if (baysError) {
      throw new Error(`Failed to fetch stabling bays: ${baysError.message}`);
    }

    // Run optimization
    const decisions = runOptimization(trainsets as TrainsetData[], plan_date, bays as StablingBay[]);

    // Calculate summary
    const summary = {
      total_trains: decisions.length,
      inducted: decisions.filter(d => d.decision === 'inducted').length,
      standby: decisions.filter(d => d.decision === 'standby').length,
      ibl_routed: decisions.filter(d => d.decision === 'ibl_routed').length,
      held: decisions.filter(d => d.decision === 'held').length,
      optimizer_score: Math.round(decisions.reduce((sum, d) => sum + d.confidence_score, 0) / decisions.length)
    };

    if (is_simulation) {
      // Return results without persisting
      return new Response(JSON.stringify({
        success: true,
        simulation: true,
        plan_date,
        summary,
        decisions
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create induction plan
    const { data: plan, error: planError } = await supabase
      .from('induction_plans')
      .insert({
        plan_date,
        execution_time: new Date().toISOString(),
        is_nightly_run: false,
        status: 'draft',
        total_trains_inducted: summary.inducted,
        total_trains_standby: summary.standby,
        total_trains_ibl: summary.ibl_routed,
        optimizer_score: summary.optimizer_score,
        created_by: userId
      })
      .select()
      .single();

    if (planError) {
      throw new Error(`Failed to create plan: ${planError.message}`);
    }

    // Insert decisions
    const decisionsToInsert = decisions.map(d => ({
      plan_id: plan.id,
      trainset_id: d.trainset_id,
      decision: d.decision,
      rank_order: d.rank_order,
      confidence_score: d.confidence_score,
      fitness_compliance: d.fitness_compliance,
      maintenance_status: d.maintenance_status,
      mileage_rationale: d.mileage_rationale,
      branding_consideration: d.branding_consideration,
      stabling_impact: d.stabling_impact,
      cleaning_status: d.cleaning_status,
      explanation_text: d.explanation_text
    }));

    const { error: decisionsError } = await supabase
      .from('induction_decisions')
      .insert(decisionsToInsert);

    if (decisionsError) {
      throw new Error(`Failed to insert decisions: ${decisionsError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      plan_id: plan.id,
      plan_date,
      summary,
      decisions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Optimization error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
