export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;
    
    // Fallbacks to maintain current behavior before environment variables are set in Vercel
    const userPass = process.env.USER_PASSWORD || '2727';
    const adminPass = process.env.ADMIN_PASSWORD || '727272';

    if (password === userPass) {
      return res.status(200).json({ success: true, isAdmin: false });
    } else if (password === adminPass) {
      return res.status(200).json({ success: true, isAdmin: true });
    } else {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
