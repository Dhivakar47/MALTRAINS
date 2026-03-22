const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'MALTRAINS/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing trainsets query...');
  const { data, error } = await supabase
    .from('trainsets')
    .select(`
      *,
      depots (name, code),
      risk_predictions (risk_level, risk_score),
      fitness_certificates (expiry_date)
    `)
    .order('rake_id');
  
  if (error) {
    console.error('TRAINSETS ERROR:', JSON.stringify(error, null, 2));
  } else {
    console.log('TRAINSETS SUCCESS', data?.length);
  }

  console.log('Testing revenue query...');
  const { data: revData, error: revError } = await supabase
    .from('daily_revenue')
    .select('*')
    .order('date', { ascending: false })
    .limit(30);

  if (revError) {
    console.error('REVENUE ERROR:', JSON.stringify(revError, null, 2));
  } else {
    console.log('REVENUE SUCCESS', revData?.length);
  }
}

testQuery();
