export function absoluteOgImage(base, origin = 'https://parallexlabs.ca') {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return new URL('og.png', `${origin}${prefix}`).href;
}
