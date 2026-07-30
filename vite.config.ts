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
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`v1.${commitCount}`)
  }
})
