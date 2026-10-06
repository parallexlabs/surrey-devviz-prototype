export function hooksAllowed(dev, flagged) {
  return Boolean(dev) || flagged === true;
}

export function testHooksEnabled() {
  const flagged = typeof window !== 'undefined' && window.__surreyTest === true;
  return hooksAllowed(import.meta.env?.DEV, flagged);
}
