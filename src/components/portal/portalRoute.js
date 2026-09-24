/* ============================================================================
   PORTAL — DEEP LINKS
   ----------------------------------------------------------------------------
   The portal is mounted at `/portal/:toolId?/*` (see App.jsx). The URL is the
   single source of truth for which tool is open:

     /portal                      → the first module (Overview)
     /portal/<toolId>             → that tool
     /portal/<toolId>/<anything>  → that tool, with `<anything>` handed to it
                                    as its own sub-route (e.g. a record id)

   The gate never redirects, so a deep link survives sign-in: the URL is still
   there when the shell mounts. Any tool can read/write its sub-route with
   `usePortalRoute()`; the shell itself only needs `portalPath`.
   ========================================================================== */

import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export const PORTAL_BASE = '/portal';

/** Build a portal URL: portalPath('paper-rsvp', 'abc') → '/portal/paper-rsvp/abc'. */
export function portalPath(toolId, sub = '') {
  const tail = sub ? `/${String(sub).replace(/^\/+/, '')}` : '';
  return `${PORTAL_BASE}/${toolId}${tail}`;
}

/**
 * The active tool id and this tool's sub-route, plus a setter for the latter.
 *   const { sub, setSub } = usePortalRoute();
 *   setSub(paper.id);            // → /portal/<tool>/<paper.id>
 *   setSub('', { replace: true }) // → /portal/<tool>
 */
export function usePortalRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const toolId = params.toolId || null;
  const sub = params['*'] || '';
  const setSub = useCallback(
    (next, { replace = false } = {}) => {
      if (!toolId) return;
      navigate(portalPath(toolId, next), { replace });
    },
    [navigate, toolId],
  );
  return { toolId, sub, setSub };
}
