import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Routinely — small habits, thoughtfully kept',
    description:
      'A quieter way to keep your routines. Flexible reminders, checklists, notes, and a little perspective on your progress.',
    permissions: ['storage', 'alarms', 'tabs'],
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          // Zod mentions @__PURE__ in prose; Rollup mistakes those comments for annotations.
          if (
            warning.code === 'INVALID_ANNOTATION' &&
            /\/zod\/v4\/core\/(regexes|util)\.js$/.test(warning.id ?? '') &&
            (warning.message.includes('esbuild will not drop') ||
              warning.message.includes('Wrapped in a `@__PURE__` IIFE'))
          )
            return;
          defaultHandler(warning);
        },
      },
    },
  }),
});
