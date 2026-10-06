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

export function buildLocationHash({ view, project } = {}) {
  const params = new URLSearchParams();
  if (view && VIEW_IDS.includes(view)) params.set('view', view);
  if (project) params.set('project', project);
  const text = params.toString();
  return text ? `#${text}` : '';
}
