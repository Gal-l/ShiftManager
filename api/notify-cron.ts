import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:hello@pickoshifts.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export default async function handler(req: any, res: any) {
  // Only allow GET/POST (Cron jobs in Vercel are usually GET/POST, but mostly GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check for cron (Optional: verify Vercel Cron Secret if needed)
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('Unauthorized cron invocation attempt');
    // For local testing we might want to bypass this if CRON_SECRET isn't set
  }

  try {
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscriptions found' });
    }

    const payload = JSON.stringify({
      title: 'Reminder',
      body: 'To have opportunity to determine your future, just do it!',
      url: '/'
    });

    const sendPromises = subscriptions.map(sub => {
      return webpush.sendNotification(sub.subscription, payload).catch(err => {
        console.error(`Error sending to ${sub.employee}:`, err);
        // If subscription is invalid/expired (status 410 or 404), we might want to delete it from DB
        if (err.statusCode === 404 || err.statusCode === 410) {
           return supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      });
    });

    await Promise.all(sendPromises);

    return res.status(200).json({ success: true, message: `Sent to ${subscriptions.length} users` });
  } catch (error) {
    console.error('Error sending cron notifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
