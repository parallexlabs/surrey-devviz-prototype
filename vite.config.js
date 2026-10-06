import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { renderStaticSummary } from './src/staticSummary.js';
import { absoluteOgImage } from './src/siteMeta.js';

const root = dirname(fileURLToPath(import.meta.url));

function gitBuildId() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

function staticSummaryHtml() {
  const read = (name) => JSON.parse(readFileSync(join(root, 'public/data', name), 'utf8'));
  return renderStaticSummary({
    projects: read('development_projects.geojson'),
    skytrain: read('skytrain.geojson'),
    civic: read('civic_places.json'),
  });
}

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

const PAGE_TITLE = "Explore Surrey's development and destinations";
const PAGE_DESCRIPTION =
  'Approved development projects alongside civic investments, transit and places to visit in three Surrey pilot areas.';

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(gitBuildId()),
  },
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
          const image = absoluteOgImage(base);
          const tags = [
            '<meta property="og:type" content="website">',
            `<meta property="og:title" content="${PAGE_TITLE}">`,
            `<meta property="og:description" content="${PAGE_DESCRIPTION}">`,
            `<meta property="og:image" content="${image}">`,
            '<meta name="twitter:card" content="summary_large_image">',
            `<meta name="twitter:title" content="${PAGE_TITLE}">`,
            `<meta name="twitter:description" content="${PAGE_DESCRIPTION}">`,
            `<meta name="twitter:image" content="${image}">`,
          ].join('\n  ');
          next = next.replace('</head>', `  ${tags}\n</head>`);
        }
        return next.split('<!--SURREY_STATIC_SUMMARY-->').join(staticSummaryHtml());
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
