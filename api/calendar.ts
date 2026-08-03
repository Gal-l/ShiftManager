import { createClient } from '@supabase/supabase-js';

// Date utility helpers
function getSunday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day;
  return new Date(date.setDate(diff));
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatIcsDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Token validation
  const token = req.query.token;
  const validToken = process.env.CALENDAR_TOKEN || '2727';
  
  if (token !== validToken) {
    return res.status(401).send('Unauthorized. Invalid calendar token.');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).send('Supabase credentials not configured.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get weeks
  const today = new Date();
  const thisWeekId = formatDate(getSunday(today));
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekId = formatDate(getSunday(nextWeek));

  // Fetch shifts for both weeks
  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('*')
    .in('week', [thisWeekId, nextWeekId]);

  if (error) {
    console.error('Error fetching shifts:', error);
    return res.status(500).send('Error fetching schedule data.');
  }

  // Group by date
  // shifts have: week (e.g., "2026-07-26"), day (e.g., "Sunday"), employee (e.g., "Gal")
  const shiftsByDate: Record<string, string[]> = {};

  (shifts || []).forEach(shift => {
    const dayOffset = DAYS.indexOf(shift.day);
    if (dayOffset === -1) return;

    // Construct the actual date for this shift
    const baseDate = new Date(shift.week + 'T12:00:00Z'); // Use noon UTC to avoid timezone shift
    baseDate.setDate(baseDate.getDate() + dayOffset);
    
    const icsDate = formatIcsDate(baseDate);
    
    if (!shiftsByDate[icsDate]) {
      shiftsByDate[icsDate] = [];
    }
    shiftsByDate[icsDate].push(shift.employee);
  });

  // Generate ICS Feed
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PickoShift//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:PickoShift Schedule',
    'X-WR-TIMEZONE:Asia/Jerusalem',
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H', // Hint for calendar apps to refresh every 4 hours
    'X-PUBLISHED-TTL:PT4H'
  ].join('\r\n') + '\r\n';

  const now = new Date();
  const dtstamp = formatIcsDate(now) + 'T' + 
                  String(now.getUTCHours()).padStart(2, '0') + 
                  String(now.getUTCMinutes()).padStart(2, '0') + 
                  String(now.getUTCSeconds()).padStart(2, '0') + 'Z';

  Object.keys(shiftsByDate).forEach(dateStr => {
    const employees = shiftsByDate[dateStr].join(', ');
    
    // For all-day events, DTEND is exclusive (the day after DTSTART)
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    
    const endDate = new Date(Date.UTC(year, month, day));
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const dtendStr = formatIcsDate(endDate);

    icsContent += [
      'BEGIN:VEVENT',
      `UID:${dateStr}-shift@pickoshift.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dtendStr}`,
      `SUMMARY:Team Infield: ${employees}`,
      'END:VEVENT'
    ].join('\r\n') + '\r\n';
  });

  icsContent += 'END:VCALENDAR\r\n';

  // Send response
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pickoshift-schedule.ics"');
  res.setHeader('Cache-Control', 'no-store, max-age=0'); // Prevent Vercel caching
  res.status(200).send(icsContent);
}
