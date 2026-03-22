import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MaximoJobCard {
  maximo_job_id: string;
  rake_id: string;
  title: string;
  description?: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'closed' | 'deferred';
  work_type?: string;
  assigned_to?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_at?: string;
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

    const { job_cards } = await req.json() as { job_cards: MaximoJobCard[] };

    if (!job_cards || !Array.isArray(job_cards)) {
      return new Response(JSON.stringify({ error: 'job_cards array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch trainset mappings
    const rakeIds = [...new Set(job_cards.map(j => j.rake_id))];
    const { data: trainsets, error: trainsetError } = await supabase
      .from('trainsets')
      .select('id, rake_id')
      .in('rake_id', rakeIds);

    if (trainsetError) {
      throw new Error(`Failed to fetch trainsets: ${trainsetError.message}`);
    }

    const trainsetMap = new Map(trainsets?.map(t => [t.rake_id, t.id]) || []);
    
    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const jobCard of job_cards) {
      const trainsetId = trainsetMap.get(jobCard.rake_id);
      
      if (!trainsetId) {
        results.skipped++;
        results.errors.push(`Trainset not found for rake_id: ${jobCard.rake_id}`);
        continue;
      }

      // Check if job card exists
      const { data: existing } = await supabase
        .from('job_cards')
        .select('id')
        .eq('maximo_job_id', jobCard.maximo_job_id)
        .single();

      const jobData = {
        trainset_id: trainsetId,
        maximo_job_id: jobCard.maximo_job_id,
        title: jobCard.title,
        description: jobCard.description,
        criticality: jobCard.criticality,
        status: jobCard.status,
        work_type: jobCard.work_type,
        assigned_to: jobCard.assigned_to,
        estimated_hours: jobCard.estimated_hours,
        actual_hours: jobCard.actual_hours,
        due_date: jobCard.due_date,
        completed_at: jobCard.completed_at
      };

      if (existing) {
        const { error } = await supabase
          .from('job_cards')
          .update(jobData)
          .eq('id', existing.id);

        if (error) {
          results.errors.push(`Failed to update ${jobCard.maximo_job_id}: ${error.message}`);
        } else {
          results.updated++;
        }
      } else {
        const { error } = await supabase
          .from('job_cards')
          .insert(jobData);

        if (error) {
          results.errors.push(`Failed to import ${jobCard.maximo_job_id}: ${error.message}`);
        } else {
          results.imported++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
