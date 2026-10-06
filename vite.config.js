import { writeFileSync } from 'fs';
import { join } from 'path';
import { defineConfig } from 'vite';

const base = process.env.VITE_BASE || '/';
const noindex = process.env.VITE_NOINDEX === '1';
const siteBuild = base.includes('/demos/surrey');

const HTACCESS = `# Applies only inside this directory. Do not copy to the site root.
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json application/geo+json image/svg+xml
</IfModule>
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/css text/javascript application/javascript application/json application/geo+json image/svg+xml
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.(?:js|css|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(?:json|geojson|svg|png|webp)$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>
</IfModule>
`;

export default defineConfig({
  base,
  plugins: [
    {
      name: 'site-noindex',
      transformIndexHtml(html) {
        let next = html;
        if (noindex && !next.includes('name="robots"')) {
          next = next.replace(
            '<meta charset="UTF-8">',
            '<meta charset="UTF-8">\n  <meta name="robots" content="noindex">',
          );
        }
        if (!next.includes('property="og:title"')) {
          const image = siteBuild
            ? 'https://parallexlabs.ca/demos/surrey/og.png'
            : `${base}og.png`;
          const tags = [
            '<meta property="og:type" content="website">',
            '<meta property="og:title" content="Surrey Development Visualization">',
            '<meta property="og:description" content="A map of public development applications in three Surrey pilot areas.">',
            `<meta property="og:image" content="${image}">`,
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="twitter:title" content="Surrey Development Visualization">',
            '<meta name="twitter:description" content="A map of public development applications in three Surrey pilot areas.">',
            `<meta name="twitter:image" content="${image}">`,
          ].join('\n  ');
          next = next.replace('</head>', `  ${tags}\n</head>`);
        }
        return next;
      },
    },
    {
      name: 'site-htaccess',
      apply: 'build',
      closeBundle() {
        if (!siteBuild) return;
        const outDir = process.env.VITE_OUT_DIR || 'dist';
        writeFileSync(join(outDir, '.htaccess'), HTACCESS);
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
