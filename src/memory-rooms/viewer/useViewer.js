/* React bindings for a RoomViewer instance's state (useSyncExternalStore, so
   a page never misses an event fired before it subscribed). */

import { useCallback, useSyncExternalStore } from 'react';

const IDLE_STATE = { state: 'loading', progress: 0, error: null, mode: 'model', baseMode: 'model', hasScan: false, isGroup: false };
const IDLE_VIEWPOINT = { photo: null, blend: 1, flying: false };
const noop = () => {};

function useViewerStore(viewer, event, read, fallback) {
  const subscribe = useCallback((cb) => (viewer ? viewer.on(event, cb) : noop), [viewer, event]);
  const get = () => (viewer ? read(viewer) || fallback : fallback);
  return useSyncExternalStore(subscribe, get, get);
}

/** { state, progress, error, mode, baseMode, hasScan, isGroup } */
export function useViewerState(viewer) {
  return useViewerStore(viewer, 'state', (v) => v.getState(), IDLE_STATE);
}

/** { photo, blend, flying } — photo is null while orbiting. */
export function useViewpoint(viewer) {
  return useViewerStore(viewer, 'viewpoint', (v) => v.getViewpoint(), IDLE_VIEWPOINT);
}
