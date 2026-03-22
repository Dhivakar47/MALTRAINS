import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CertificateUpdate {
  rake_id: string;
  certificate_type: 'rolling_stock' | 'signalling' | 'telecom';
  issue_date: string;
  expiry_date: string;
  issuing_authority?: string;
  certificate_number?: string;
  notes?: string;
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
      // Get certificates with validity status
      const rakeId = url.searchParams.get('rake_id');
      
      let query = supabase
        .from('fitness_certificates')
        .select('*, trainsets(rake_id)');

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

      const { data: certificates, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch certificates: ${error.message}`);
      }

      // Add computed validity
      const today = new Date().toISOString().split('T')[0];
      const certificatesWithValidity = certificates?.map(cert => ({
        ...cert,
        is_valid: cert.expiry_date >= today,
        days_until_expiry: Math.ceil((new Date(cert.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }));

      return new Response(JSON.stringify({
        success: true,
        certificates: certificatesWithValidity
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (method === 'POST' || method === 'PUT') {
      const { certificates } = await req.json() as { certificates: CertificateUpdate[] };

      if (!certificates || !Array.isArray(certificates)) {
        return new Response(JSON.stringify({ error: 'certificates array is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const results = {
        updated: 0,
        created: 0,
        errors: [] as string[]
      };

      for (const cert of certificates) {
        // Get trainset ID
        const { data: trainset } = await supabase
          .from('trainsets')
          .select('id')
          .eq('rake_id', cert.rake_id)
          .single();

        if (!trainset) {
          results.errors.push(`Trainset not found: ${cert.rake_id}`);
          continue;
        }

        // Upsert certificate
        const { error } = await supabase
          .from('fitness_certificates')
          .upsert({
            trainset_id: trainset.id,
            certificate_type: cert.certificate_type,
            issue_date: cert.issue_date,
            expiry_date: cert.expiry_date,
            issuing_authority: cert.issuing_authority,
            certificate_number: cert.certificate_number,
            notes: cert.notes
          }, {
            onConflict: 'trainset_id,certificate_type'
          });

        if (error) {
          results.errors.push(`Failed to update ${cert.rake_id} ${cert.certificate_type}: ${error.message}`);
        } else {
          results.updated++;
        }
      }

      // Check for expiring certificates and create alerts
      const warningDays = 7;
      const today = new Date();
      const warningDate = new Date(today.getTime() + warningDays * 24 * 60 * 60 * 1000);

      const { data: expiringCerts } = await supabase
        .from('fitness_certificates')
        .select('*, trainsets(rake_id)')
        .lte('expiry_date', warningDate.toISOString().split('T')[0])
        .gte('expiry_date', today.toISOString().split('T')[0]);

      for (const cert of expiringCerts || []) {
        await supabase.from('alerts').insert({
          alert_type: 'certificate_expiring',
          severity: 'warning',
          title: `Certificate Expiring: ${cert.trainsets?.rake_id}`,
          message: `${cert.certificate_type} certificate expires on ${cert.expiry_date}`,
          related_trainset_id: cert.trainset_id
        });
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
    console.error('Certificate error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
