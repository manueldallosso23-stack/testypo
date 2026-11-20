import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS is required for DeviceOrientation on iOS Safari / Android Chrome.
// `npm run dev` serves https://<your-LAN-IP>:5173 for testing on a phone.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { host: true },
  preview: { host: true },
});
