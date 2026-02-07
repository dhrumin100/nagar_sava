import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],
          // Router
          'router': ['react-router-dom'],
          // UI libraries - Radix UI components
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip'
          ],
          // Animation library
          'framer-motion': ['framer-motion'],
          // Charts
          'charts': ['recharts'],
          // Maps
          'maps': ['leaflet', 'react-leaflet'],
          // Forms and validation
          'forms': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'input-otp'
          ],
          // Data fetching
          'query': ['@tanstack/react-query'],
          // Utilities
          'utils': [
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'date-fns',
            'cmdk',
            'sonner'
          ],
          // Carousel and other heavy components
          'heavy-components': [
            'embla-carousel-react',
            'react-day-picker',
            'react-resizable-panels',
            'vaul'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 600, // Increase warning limit slightly
  },
}));
