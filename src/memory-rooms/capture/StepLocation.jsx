/* Step 4: where is it? The picker itself (GPS, pin, typed place) is the shared
   LocationPicker.jsx, also used by the edit page; this step gives it the draft's
   location. The location is stored as { lat, lng, accuracy, source, label }. */

import { useCallback } from 'react';
import { COPY } from '../copy.js';
import LocationPicker from './LocationPicker.jsx';

export default function StepLocation({ loc, update }) {
  const onChange = useCallback((fn) => update((d) => ({ loc: fn(d.loc) })), [update]);
  return (
    <div className="mr-stepbody mr-location">
      <h2 className="mr-step-title">{COPY.capture.locationTitle}</h2>
      <LocationPicker loc={loc} onChange={onChange} />
    </div>
  );
}
