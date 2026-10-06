import { defineConfig } from 'vite';

const base = process.env.VITE_BASE || '/';
const noindex = process.env.VITE_NOINDEX === '1';

export default defineConfig({
  base,
  plugins: [
    {
      name: 'site-noindex',
      transformIndexHtml(html) {
        if (!noindex || html.includes('name="robots"')) return html;
        return html.replace(
          '<meta charset="UTF-8">',
          '<meta charset="UTF-8">\n  <meta name="robots" content="noindex">',
        );
      },
    },
  ],
  build: {
    outDir: process.env.VITE_OUT_DIR || 'dist',
    sourcemap: true,
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
  },
});
