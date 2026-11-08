/* Dev-only harness: mounts the viewer agent's SpotPage / GroupPage without
   the Memory Rooms shell (gate, header), on a HashRouter, so they can be
   checked while the shell is being built:
     http://localhost:5192/tools/memory-rooms/dev-viewer/harness.html#/memories/<id>
   Expects localStorage mr:token to be set (shoot.mjs does it). */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import '../../../src/index.css';
import '../../../src/memory-rooms/memory-rooms.css';
import SpotPage from '../../../src/memory-rooms/pages/SpotPage.jsx';
import GroupPage from '../../../src/memory-rooms/pages/GroupPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <div className="mr" data-page="harness">
        <Routes>
          <Route path="/memories/group/:group" element={<GroupPage />} />
          <Route path="/memories/:spotId" element={<SpotPage />} />
          <Route path="*" element={<p className="mr-label">harness: open #/memories/&lt;id&gt;</p>} />
        </Routes>
      </div>
    </HashRouter>
  </StrictMode>,
);
