import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    // Added because of "ReferenceError: require is not defined" error coming from ynab dependency
    // Source: https://stackoverflow.com/a/77543093/18265617
    commonjsOptions: {transformMixedEsModules: true}, // Change
  },
  plugins: [react()],
});
