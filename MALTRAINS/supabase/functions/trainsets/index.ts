import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Trainset {
  id: string;
  rake_id: string;
  depot_id: string | null;
  car_count: number;
  total_mileage_km: number;
  current_status: string;
  current_bay: string | null;
  route: string | null;
  branding_client: string | null;
  branding_priority: number;
  branding_exposure_hours: number;
  branding_sla_hours_required: number;
  last_service_date: string | null;
  next_scheduled_maintenance: string | null;
  created_at: string;
  updated_at: string;
  depots?: { name: string; code: string } | null;
  fitness_certificates?: FitnessCertificate[];
  job_cards?: JobCard[];
  fitness_status?: Record<string, boolean>;
  all_fit?: boolean;
  open_critical_jobs?: number;
}

interface FitnessCertificate {
  id: string;
  trainset_id: string;
  certificate_type: string;
  issue_date: string;
  expiry_date: string;
  issuing_authority: string | null;
  certificate_number: string | null;
  notes: string | null;
}

interface JobCard {
  id: string;
  status: string;
  criticality: string;
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

    const method = req.method;
    const url = new URL(req.url);

    if (method === 'GET') {
      const rakeId = url.searchParams.get('rake_id');
      const status = url.searchParams.get('status');
      const withDetails = url.searchParams.get('details') === 'true';

      if (rakeId) {
        // Get specific trainset - fetch base data first
        const { data: baseData, error: baseError } = await supabase
          .from('trainsets')
          .select('*')
          .eq('rake_id', rakeId)
          .single();

        if (baseError || !baseData) {
          return new Response(JSON.stringify({ error: 'Trainset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const trainset = baseData as unknown as Trainset;

        if (withDetails) {
          // Fetch related data separately
          const [certsResult, jobsResult, depotResult] = await Promise.all([
            supabase.from('fitness_certificates').select('*').eq('trainset_id', trainset.id),
            supabase.from('job_cards').select('*').eq('trainset_id', trainset.id),
            trainset.depot_id 
              ? supabase.from('depots').select('name, code').eq('id', trainset.depot_id).single()
              : Promise.resolve({ data: null, error: null })
          ]);

          trainset.fitness_certificates = (certsResult.data || []) as FitnessCertificate[];
          trainset.job_cards = (jobsResult.data || []) as JobCard[];
          trainset.depots = depotResult.data as { name: string; code: string } | null;

          // Add computed fitness status
          const today = new Date().toISOString().split('T')[0];
          trainset.fitness_status = {
            rolling_stock: !!trainset.fitness_certificates.find(c => c.certificate_type === 'rolling_stock' && c.expiry_date >= today),
            signalling: !!trainset.fitness_certificates.find(c => c.certificate_type === 'signalling' && c.expiry_date >= today),
            telecom: !!trainset.fitness_certificates.find(c => c.certificate_type === 'telecom' && c.expiry_date >= today)
          };
          trainset.all_fit = Object.values(trainset.fitness_status).every(v => v);
          trainset.open_critical_jobs = trainset.job_cards?.filter(j => j.status !== 'closed' && j.criticality === 'critical').length || 0;
        }

        return new Response(JSON.stringify({
          success: true,
          trainset
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // List all trainsets
      let query = supabase
        .from('trainsets')
        .select('*')
        .order('rake_id');

      if (status) {
        query = query.eq('current_status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch trainsets: ${error.message}`);
      }

      const trainsets = (data || []) as unknown as Trainset[];

      // Add computed fields for each trainset if details requested
      if (withDetails && trainsets.length > 0) {
        const trainsetIds = trainsets.map(t => t.id);
        
        const [certsResult, jobsResult] = await Promise.all([
          supabase.from('fitness_certificates').select('*').in('trainset_id', trainsetIds),
          supabase.from('job_cards').select('id, trainset_id, status, criticality').in('trainset_id', trainsetIds)
        ]);

        const certsByTrainset = new Map<string, FitnessCertificate[]>();
        const jobsByTrainset = new Map<string, JobCard[]>();

        for (const cert of (certsResult.data || []) as (FitnessCertificate & { trainset_id: string })[]) {
          if (!certsByTrainset.has(cert.trainset_id)) {
            certsByTrainset.set(cert.trainset_id, []);
          }
          certsByTrainset.get(cert.trainset_id)!.push(cert);
        }

        for (const job of (jobsResult.data || []) as (JobCard & { trainset_id: string })[]) {
          if (!jobsByTrainset.has(job.trainset_id)) {
            jobsByTrainset.set(job.trainset_id, []);
          }
          jobsByTrainset.get(job.trainset_id)!.push(job);
        }

        const today = new Date().toISOString().split('T')[0];
        for (const trainset of trainsets) {
          trainset.fitness_certificates = certsByTrainset.get(trainset.id) || [];
          trainset.job_cards = jobsByTrainset.get(trainset.id) || [];
          
          trainset.fitness_status = {
            rolling_stock: !!trainset.fitness_certificates.find(c => c.certificate_type === 'rolling_stock' && c.expiry_date >= today),
            signalling: !!trainset.fitness_certificates.find(c => c.certificate_type === 'signalling' && c.expiry_date >= today),
            telecom: !!trainset.fitness_certificates.find(c => c.certificate_type === 'telecom' && c.expiry_date >= today)
          };
          trainset.all_fit = Object.values(trainset.fitness_status).every(v => v);
          trainset.open_critical_jobs = trainset.job_cards?.filter(j => j.status !== 'closed' && j.criticality === 'critical').length || 0;
        }
      }

      // Calculate fleet summary
      const summary = {
        total: trainsets.length,
        service_ready: trainsets.filter(t => t.current_status === 'service_ready').length,
        standby: trainsets.filter(t => t.current_status === 'standby').length,
        maintenance: trainsets.filter(t => t.current_status === 'maintenance').length,
        ibl_routed: trainsets.filter(t => t.current_status === 'ibl_routed').length,
        out_of_service: trainsets.filter(t => t.current_status === 'out_of_service').length,
        avg_mileage: Math.round(trainsets.reduce((sum, t) => sum + Number(t.total_mileage_km), 0) / (trainsets.length || 1))
      };

      return new Response(JSON.stringify({
        success: true,
        summary,
        trainsets
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const { rake_id, ...updates } = await req.json();

      if (!rake_id) {
        return new Response(JSON.stringify({ error: 'rake_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: trainset, error } = await supabase
        .from('trainsets')
        .update(updates)
        .eq('rake_id', rake_id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update trainset: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        trainset
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Trainsets error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
