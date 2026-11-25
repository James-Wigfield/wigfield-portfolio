/* Picked files → processed photos, one at a time (keeps phone memory low). */

import { useCallback, useRef, useState } from 'react';
import { processPhoto } from '../lib/images.js';
import { MAX_PHOTOS } from './useDraft.js';

/** max: how many photos this capture takes (12 guided, 40 for old photos). */
export function usePhotoQueue({ count, addPhoto, max = MAX_PHOTOS }) {
  const [progress, setProgress] = useState(null); // { i, n }
  const [errors, setErrors] = useState([]);
  const [trimmed, setTrimmed] = useState(0);
  const busy = useRef(false);

  const addFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length || busy.current) return;
      busy.current = true;
      const take = files.slice(0, Math.max(0, max - count));
      setTrimmed(files.length - take.length);
      setErrors([]);
      const failed = [];
      for (let i = 0; i < take.length; i++) {
        setProgress({ i: i + 1, n: take.length });
        try {
          const out = await processPhoto(take[i]);
          await addPhoto(out, take[i].name);
        } catch (err) {
          console.warn('[memory-rooms] photo skipped', take[i].name, err);
          failed.push(take[i].name || `#${i + 1}`);
        }
      }
      setErrors(failed);
      setProgress(null);
      busy.current = false;
    },
    [count, addPhoto, max],
  );

  return { addFiles, progress, errors, trimmed, busy: Boolean(progress) };
}
