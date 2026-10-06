export const VIEW_IDS = ['overview', 'city_centre', 'fleetwood', 'campbell_heights'];

export function parseLocationHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const view = params.get('view');
  const project = params.get('project');
  return {
    view: VIEW_IDS.includes(view) ? view : null,
    project: project || null,
  };
}

export function resolveHashTarget(parsed, features) {
  const view = parsed?.view && VIEW_IDS.includes(parsed.view) ? parsed.view : null;
  const project = parsed?.project || null;
  const feature = project
    ? (features || []).find((item) => item?.properties?.PROJECT_NO === project) || null
    : null;
  if (feature) return { kind: 'project', view, feature, missingProject: false };
  if (view) return { kind: 'view', view, feature: null, missingProject: Boolean(project) };
  return { kind: 'none', view: null, feature: null, missingProject: Boolean(project) };
}

export function sameRecordId(id, selectedId) {
  return String(id) === String(selectedId);
}

export function buildLocationHash({ view, project } = {}) {
  const params = new URLSearchParams();
  if (view && VIEW_IDS.includes(view)) params.set('view', view);
  if (project) params.set('project', project);
  const text = params.toString();
  return text ? `#${text}` : '';
}
