/* ============================================================================
   ARCADE — shared client room module
   ----------------------------------------------------------------------------
   Every arcade game imports this and gets, for free:
     • the landing screen (type your name, start a night, or join with a code)
     • create / join over /api/arcade/<slug>/…
     • the WebSocket, with exponential backoff reconnect and a keepalive ping
     • session persistence, so a refresh or a backgrounded phone returns to the
       SAME seat instead of arriving as a ghost player
     • the share link and the connection banner

   A game never writes networking code. It calls mountArcade() and renders
   whatever arrives in onState.

   Session keys
     arcade:name                  your name, once, for the whole arcade
     arcade:sess:<slug>:<CODE>    the room token — this is what makes reconnect
                                  return you to your own seat and score
   ========================================================================== */

const NAME_KEY = 'arcade:name';
const PING_MS = 25000;
const BACKOFF_MIN = 600;
const BACKOFF_MAX = 8000;

// ── storage (private mode / blocked cookies must not break the arcade) ───────
function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private window — the game still works, it just won't remember */
  }
}

export function getName() {
  return lsGet(NAME_KEY) || '';
}
export function setName(name) {
  lsSet(NAME_KEY, name);
}

const sessKey = (slug, code) => `arcade:sess:${slug}:${code}`;

function getSession(slug, code) {
  try {
    return JSON.parse(lsGet(sessKey(slug, code)) || 'null');
  } catch {
    return null;
  }
}
function saveSession(slug, code, data) {
  lsSet(sessKey(slug, code), JSON.stringify(data));
}

// ── REST ─────────────────────────────────────────────────────────────────────
async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const createRoom = (slug, name) => api(`/api/arcade/${slug}/create`, { name });
export const joinRoom = (slug, code, name, token) =>
  api(`/api/arcade/${slug}/room/${code}/join`, { name, token });

export function shareLink(slug, code) {
  return `${location.origin}/arcade/${slug}/?c=${code}`;
}

// ── mountArcade ──────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.slug        game slug, must match the server registry
 * @param {string} opts.title       shown on the landing screen
 * @param {string} opts.tagline     one line under the title
 * @param {string} [opts.soloNote]  explains what playing alone does
 * @param {HTMLElement} opts.gateEl container for the landing screen
 * @param {(msg:object)=>void} opts.onState  every server state broadcast
 * @param {()=>void} [opts.onJoined]         fired once, when the room is live
 * @returns {{send:(m:object)=>void, code:()=>string, seat:()=>number}}
 */
export function mountArcade(opts) {
  const { slug, gateEl, onState, onJoined } = opts;

  let code = null;
  let token = null;
  let seat = null;
  let ws = null;
  let backoff = BACKOFF_MIN;
  let pingTimer = null;
  let closed = false;

  const banner = document.createElement('div');
  banner.className = 'ar-conn';
  document.body.appendChild(banner);

  function setBanner(text) {
    if (!text) {
      banner.dataset.show = '0';
      return;
    }
    banner.textContent = text;
    banner.dataset.show = '1';
  }

  // ── socket ────────────────────────────────────────────────────────────────
  function connect() {
    if (closed) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/api/arcade/${slug}/room/${code}/ws?token=${encodeURIComponent(token)}`;

    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      backoff = BACKOFF_MIN;
      setBanner(null);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' }));
      }, PING_MS);
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === 'pong') return;
      if (msg.t === 'state') {
        seat = msg.seat;
        onState(msg);
      }
    });

    ws.addEventListener('close', () => {
      clearInterval(pingTimer);
      if (closed) return;
      // Every close is handled the same way: reconnect() re-asserts the seat over
      // REST first, which both refreshes a token the DO has forgotten (room aged
      // out and was rebuilt) and is a no-op when the token is still good.
      setBanner('Reconnecting…');
      setTimeout(reconnect, backoff);
      backoff = Math.min(BACKOFF_MAX, Math.round(backoff * 1.7 + Math.random() * 250));
    });

    ws.addEventListener('error', () => {
      /* close fires next and owns the retry */
    });
  }

  async function reconnect() {
    if (closed) return;
    try {
      // Re-assert the seat over REST first: if the token is still good this is a
      // no-op that returns the same seat, and if it isn't we get a working one.
      const res = await joinRoom(slug, code, getName(), token);
      token = res.token;
      seat = res.seat;
      saveSession(slug, code, { token, seat, name: res.name });
    } catch {
      /* server unreachable — the socket retry below will keep trying */
    }
    connect();
  }

  // A phone that has been in a pocket wakes up with a dead socket and no close
  // event. Check on the way back in.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!code || closed) return;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      backoff = BACKOFF_MIN;
      reconnect();
    }
  });

  function enter(res) {
    code = res.code;
    token = res.token;
    seat = res.seat;
    saveSession(slug, code, { token, seat, name: res.name });

    // Put the code in the URL so a refresh, or a link sent to the other phone,
    // lands back in the same room.
    const next = new URL(location.href);
    next.searchParams.set('c', code);
    history.replaceState(null, '', next);

    gateEl.hidden = true;
    connect();
    onJoined?.();
  }

  // ── landing screen ────────────────────────────────────────────────────────
  renderGate();

  function renderGate() {
    const urlCode = (new URLSearchParams(location.search).get('c') || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);

    gateEl.innerHTML = `
      <div class="ar-gate">
        <p class="ar-eyebrow">Wigfield Arcade</p>
        <h1 class="ar-wordmark">${escapeHtml(opts.title)}</h1>
        <p class="ar-sub">${escapeHtml(opts.tagline)}</p>

        <div class="ar-gate__panel">
          <div class="ar-field">
            <label class="ar-label" for="ar-name">Your name</label>
            <input class="ar-input" id="ar-name" maxlength="18" autocomplete="nickname"
                   placeholder="Who's on the rock?" value="${escapeHtml(getName())}" />
          </div>

          <button class="ar-btn" id="ar-create">Start a night</button>

          <div class="ar-or">or join a friend</div>

          <div class="ar-field">
            <input class="ar-input ar-input--code" id="ar-code" maxlength="5"
                   inputmode="latin" autocapitalize="characters" spellcheck="false"
                   placeholder="CODE" value="${urlCode}" />
          </div>
          <button class="ar-btn ar-btn--ghost" id="ar-join">Join</button>

          <p class="ar-error" id="ar-err"></p>
        </div>

        ${opts.soloNote ? `<p class="ar-sub">${escapeHtml(opts.soloNote)}</p>` : ''}
      </div>
    `;

    const nameEl = gateEl.querySelector('#ar-name');
    const codeEl = gateEl.querySelector('#ar-code');
    const errEl = gateEl.querySelector('#ar-err');
    const createBtn = gateEl.querySelector('#ar-create');
    const joinBtn = gateEl.querySelector('#ar-join');

    codeEl.addEventListener('input', () => {
      codeEl.value = codeEl.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    });

    function currentName() {
      const n = nameEl.value.trim().slice(0, 18);
      if (n) setName(n);
      return n;
    }

    async function run(fn, btn) {
      errEl.textContent = '';
      createBtn.disabled = joinBtn.disabled = true;
      const was = btn.textContent;
      btn.textContent = 'Connecting…';
      try {
        enter(await fn());
      } catch (err) {
        errEl.textContent = err.message || 'Something went wrong.';
        createBtn.disabled = joinBtn.disabled = false;
        btn.textContent = was;
      }
    }

    createBtn.addEventListener('click', () => {
      const name = currentName();
      if (!name) return void (errEl.textContent = 'Put a name in first.');
      run(() => createRoom(slug, name), createBtn);
    });

    joinBtn.addEventListener('click', () => {
      const name = currentName();
      if (!name) return void (errEl.textContent = 'Put a name in first.');
      const c = codeEl.value;
      if (c.length !== 5) return void (errEl.textContent = 'Room codes are five letters.');
      run(() => joinRoom(slug, c, name, getSession(slug, c)?.token || null), joinBtn);
    });

    codeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinBtn.click();
    });
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (codeEl.value.length === 5 ? joinBtn : createBtn).click();
    });

    // Arrived on a share link and we have been here before — rejoin silently.
    const saved = urlCode ? getSession(slug, urlCode) : null;
    if (saved?.token && getName()) {
      run(() => joinRoom(slug, urlCode, getName(), saved.token), joinBtn);
    }
  }

  return {
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    code: () => code,
    seat: () => seat,
    destroy() {
      closed = true;
      clearInterval(pingTimer);
      ws?.close();
    },
  };
}

// ── shared UI bits ───────────────────────────────────────────────────────────

/** Copy the share link, falling back to the native share sheet on mobile. */
export async function shareRoom(slug, code, title) {
  const url = shareLink(slug, code);
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `Join me — room ${code}`, url });
      return 'shared';
    } catch {
      /* user dismissed the sheet */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/** Deterministic PRNG — both phones must draw the SAME starfield from a seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
