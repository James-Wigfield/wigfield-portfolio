/* A SAMPLE scene.json in the v1 shape the build prompt specifies — an invented
   bedroom, not James's. The plan page renders it live (DioramaPreview) and shows
   it as JSON, so "what Claude writes" and "what you see" sit side by side. */

export const SAMPLE_SCENE = {
  version: 1,
  kind: 'interior',
  title: 'Sample bedroom',
  style: { mood: 'evening', palette: ['#e9e2d4', '#a7774f', '#56677f'] },
  shell: {
    width: 3.6, depth: 4.1, height: 2.6,
    floor: { finish: 'timber', color: '#a7774f' },
    walls: { color: '#e9e2d4' },
    openings: [
      { wall: 'north', type: 'window', offset: 1.0, width: 1.6, height: 1.2, sill: 0.9 },
      { wall: 'west', type: 'door', offset: 3.0, width: 0.82, height: 2.04 },
    ],
  },
  objects: [
    { id: 'bed', kit: 'bed', size: [1.53, 0.5, 2.03], at: [2.6, 0, 2.9], rotY: 0, color: '#ddd6c8', accent: '#56677f' },
    { id: 'desk', kit: 'desk', size: [1.2, 0.75, 0.6], at: [1.8, 0, 0.35], rotY: 0, color: '#7a5a3c' },
    { id: 'chair', kit: 'chair', size: [0.45, 0.85, 0.45], at: [1.8, 0, 0.95], rotY: 0, color: '#3f4a5c' },
    { id: 'rug', kit: 'rug', size: [1.5, 0.01, 1.1], at: [1.3, 0, 2.4], color: '#c8a46a' },
    { id: 'shelf', kit: 'shelf', size: [0.8, 1.8, 0.32], at: [0.18, 0, 0.75], rotY: 90, color: '#8a6a4a' },
    { id: 'plant', kit: 'plant', size: [0.4, 0.9, 0.4], at: [3.3, 0, 0.35], color: '#4f7a4a', accent: '#b56a45' },
    { id: 'lamp', kit: 'lamp', size: [0.22, 0.45, 0.22], at: [2.2, 0.75, 0.22], color: '#f2e6c8' },
    { id: 'poster', kit: 'frame', size: [0.6, 0.8, 0.03], at: [0.02, 1.2, 1.95], rotY: 90, color: '#2d3340', accent: '#d9744a' },
  ],
  lights: [{ type: 'lamp', at: [2.2, 1.1, 0.25], color: '#ffd8a0', intensity: 1.0 }],
  pins: [{ at: [2.6, 1.0, 2.9], text: 'Where the whole trip got planned' }],
  cameras: [{ photo: 1, pos: [0.3, 1.5, 3.9], look: [2.4, 1.0, 0.6], fov: 68 }],
};

/** The part of the sample shown as JSON on the page (trimmed for reading). */
export const SAMPLE_JSON = JSON.stringify(
  {
    kind: SAMPLE_SCENE.kind,
    shell: { width: 3.6, depth: 4.1, height: 2.6, openings: ['window · north', 'door · west'] },
    objects: SAMPLE_SCENE.objects.slice(0, 3).map(({ id, kit, size, at }) => ({ id, kit, size, at })),
    pins: SAMPLE_SCENE.pins,
  },
  null,
  2,
)
  // keep number arrays on one line so the snippet stays short
  .replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, inner) => `[${inner.replace(/\s+/g, ' ')}]`)
  .replace(/\[\s+("[^"\]]+"(?:,\s+"[^"\]]+")*)\s+\]/g, (_, inner) => `[${inner.replace(/\s+/g, ' ')}]`);
