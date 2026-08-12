import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'jsdom',
    include: ['apps/**/*.test.{ts,tsx}', 'sdks/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
    passWithNoTests: true,
  },
});
