import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  // the voiceover engine runs in a module worker
  worker: { format: 'es' },
});
