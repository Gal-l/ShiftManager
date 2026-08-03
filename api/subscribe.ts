import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { employee, subscription } = req.body;

    if (!employee || !subscription) {
      return res.status(400).json({ error: 'Missing employee or subscription data' });
    }

    // Upsert the subscription
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({ 
        employee,
        subscription
      }, { onConflict: 'employee' });

    if (error) {
      console.error('Supabase error saving subscription:', error);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
