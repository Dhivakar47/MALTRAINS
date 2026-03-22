import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MileageEntry {
  rake_id: string;
  mileage_km: number;
  route?: string;
  recorded_date?: string;
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
    const method = req.method;

    if (method === 'GET') {
      const url = new URL(req.url);
      const rakeId = url.searchParams.get('rake_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      let query = supabase
        .from('mileage_history')
        .select('*, trainsets(rake_id)')
        .order('recorded_date', { ascending: false });

      if (rakeId) {
        const { data: trainset } = await supabase
          .from('trainsets')
          .select('id')
          .eq('rake_id', rakeId)
          .single();

        if (trainset) {
          query = query.eq('trainset_id', trainset.id);
        }
      }

      if (startDate) {
        query = query.gte('recorded_date', startDate);
      }
      if (endDate) {
        query = query.lte('recorded_date', endDate);
      }

      const { data: history, error } = await query.limit(100);

      if (error) {
        throw new Error(`Failed to fetch mileage history: ${error.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        history
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST') {
      const { entries } = await req.json() as { entries: MileageEntry[] };

      if (!entries || !Array.isArray(entries)) {
        return new Response(JSON.stringify({ error: 'entries array is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const results = {
        recorded: 0,
        errors: [] as string[]
      };

      for (const entry of entries) {
        // Get trainset
        const { data: trainset, error: trainsetError } = await supabase
          .from('trainsets')
          .select('id, total_mileage_km')
          .eq('rake_id', entry.rake_id)
          .single();

        if (trainsetError || !trainset) {
          results.errors.push(`Trainset not found: ${entry.rake_id}`);
          continue;
        }

        // Add mileage to history
        const { error: historyError } = await supabase
          .from('mileage_history')
          .insert({
            trainset_id: trainset.id,
            recorded_date: entry.recorded_date || new Date().toISOString().split('T')[0],
            mileage_km: entry.mileage_km,
            route: entry.route,
            recorded_by: userId
          });

        if (historyError) {
          results.errors.push(`Failed to record for ${entry.rake_id}: ${historyError.message}`);
          continue;
        }

        // Update total mileage on trainset
        const newTotal = Number(trainset.total_mileage_km) + entry.mileage_km;
        const { error: updateError } = await supabase
          .from('trainsets')
          .update({ 
            total_mileage_km: newTotal,
            route: entry.route || undefined 
          })
          .eq('id', trainset.id);

        if (updateError) {
          results.errors.push(`Failed to update total for ${entry.rake_id}: ${updateError.message}`);
        } else {
          results.recorded++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Mileage error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
