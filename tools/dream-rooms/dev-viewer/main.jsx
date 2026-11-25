/* Dream Rooms · the viewer's dev harness. `npx vite --port 5197 --strictPort`, then
   http://localhost:5197/tools/dream-rooms/dev-viewer/index.html?…

   A dream:
     ?world=/src/dream-rooms/contracts/fixtures/sample.world.json
       &glb=/dream-rooms-work/sample/build/draft.glb     (or &greybox=1)
       &autopilot=1  &still=1
   The corridor:
     ?corridor=1&rows=/tools/dream-rooms/samples/fixtures-nights.json   (rows=empty → no dreams)
       &at=<dream id>  &enter=<dream id>  &autopilot=1
       &kit=0 (grey-box kit) | &kit=<url> (default /dreams/corridor-kit.glb)
       &delay=<s>   pretend a door's dream takes this long to load (the grain on the white)
   A rendered door "loads" the world above with its GLB (or the grey box). */

import { createRoot } from 'react-dom/client';
import Harness from './Harness.jsx';

createRoot(document.getElementById('root')).render(<Harness />);
