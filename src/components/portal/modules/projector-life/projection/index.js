/* PROJECTOR LIFE — projection/ entry. STUB by the lead so the tab renders; the
   projection agent replaces this file (contract: CONTRACTS.md §5). */
export function createProjection({ values }) {
  return {
    attach() {},
    setPatches() {},
    setParams() {},
    update() {},
    beforeRender() {},
    outputs: () => [],
    projectorView: () => ({ position: [values['p0.x'], values['p0.y'], values['p0.z']], target: [2.18, 1, 2.18], fov: 40 }),
    coverage: () => null,
    drawNet() {},
    dispose() {},
  };
}
