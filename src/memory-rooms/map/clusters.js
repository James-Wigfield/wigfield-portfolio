/* Screen-space clustering: points closer than `radius` px at the current zoom
   become one numbered dot. Greedy and stable (input order = newest first), which
   is plenty for a few hundred spots. */

export const CLUSTER_PX = 20;

/** Drawn radius of a cluster disc for n spots. */
export const clusterRadius = (n, base = 11) => base + Math.min(7, Math.log2(n) * 2.2);

/**
 * points: [{ id, x, y, wx, wy, spot }] (x/y screen, wx/wy world)
 * → [{ type: 'spot', point } | { type: 'cluster', id, x, y, members: [point…] }]
 */
export function clusterPoints(points, radius = CLUSTER_PX) {
  const r2 = radius * radius;
  const used = new Uint8Array(points.length);
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const members = [points[i]];
    let sx = points[i].x;
    let sy = points[i].y;
    // Grow from the running centroid so a chain of near points ends up together.
    for (let pass = 0; pass < 2; pass++) {
      for (let j = i + 1; j < points.length; j++) {
        if (used[j]) continue;
        const cx = sx / members.length;
        const cy = sy / members.length;
        const dx = points[j].x - cx;
        const dy = points[j].y - cy;
        if (dx * dx + dy * dy < r2) {
          used[j] = 1;
          members.push(points[j]);
          sx += points[j].x;
          sy += points[j].y;
        }
      }
    }
    if (members.length === 1) out.push({ type: 'spot', point: members[0] });
    else
      out.push({
        type: 'cluster',
        id: `c:${members.map((m) => m.id).join(',')}`,
        x: sx / members.length,
        y: sy / members.length,
        members,
      });
  }
  return out;
}

/** World-space bounding box of some points. */
export function worldBox(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.wx);
    y0 = Math.min(y0, p.wy);
    x1 = Math.max(x1, p.wx);
    y1 = Math.max(y1, p.wy);
  }
  return { x0, y0, x1, y1 };
}
