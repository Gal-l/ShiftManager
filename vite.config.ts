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
          }
          next();
        });
      }
    }
  ],
  define: {
    __APP_VERSION__: JSON.stringify(`v1.${commitCount}`)
  }
})
