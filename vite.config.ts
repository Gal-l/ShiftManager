import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

let commitCount = '0';
try {
  commitCount = execSync('git rev-list --count HEAD').toString().trim();
} catch (e) {
  console.warn('Could not get git commit count');
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'watch-git',
      configureServer(server) {
        server.watcher.add('.git/logs/HEAD');
        server.watcher.add('.git/HEAD');
        server.watcher.on('change', (file) => {
          if (file.includes('.git/logs/HEAD') || file.includes('.git/HEAD')) {
            server.restart();
          }
        });
      }
    },
    {
      name: 'api-mock',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/auth' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const { password } = JSON.parse(body);
                const userPass = process.env.USER_PASSWORD || '2727';
                const adminPass = process.env.ADMIN_PASSWORD || '727272';
                
                res.setHeader('Content-Type', 'application/json');
                if (password === userPass) {
                  res.end(JSON.stringify({ success: true, isAdmin: false }));
                } else if (password === adminPass) {
                  res.end(JSON.stringify({ success: true, isAdmin: true }));
                } else {
                  res.statusCode = 401;
                  res.end(JSON.stringify({ success: false, error: 'Invalid password' }));
                }
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
              }
            });
            return;
          } else if (req.url?.startsWith('/api/calendar') && req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');
            const validToken = process.env.CALENDAR_TOKEN || '2727';
            
            if (token !== validToken) {
              res.statusCode = 401;
              res.end('Unauthorized. Invalid calendar token.');
              return;
            }
            
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="pickoshift-schedule.ics"');
            res.end(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PickoShift//Calendar Feed//EN\r\nBEGIN:VEVENT\r\nUID:mock-shift@pickoshift.app\r\nDTSTAMP:20260803T000000Z\r\nDTSTART;VALUE=DATE:20260803\r\nDTEND;VALUE=DATE:20260804\r\nSUMMARY:Team Infield: Mock Dev User\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`);
            return;
          }
          next();
        });
      }
    }
  ],
  define: {
    __APP_VERSION__: JSON.stringify('v1.25')
  }
})
