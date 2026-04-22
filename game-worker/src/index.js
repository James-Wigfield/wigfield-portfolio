// ── Word bank ─────────────────────────────────────────────────────────────────
const WORD_BANK = {
  Animals:     ['Elephant', 'Penguin', 'Platypus', 'Octopus', 'Flamingo', 'Narwhal', 'Capybara', 'Axolotl'],
  Food:        ['Spaghetti', 'Sushi', 'Croissant', 'Ramen', 'Paella', 'Dumpling', 'Fondue', 'Kimchi'],
  Places:      ['Antarctica', 'Sahara', 'Amazon', 'Machu Picchu', 'Stonehenge', 'Maldives', 'Iceland', 'Pompeii'],
  Movies:      ['Inception', 'Titanic', 'The Matrix', 'Parasite', 'Interstellar', 'Gladiator', 'Shrek', 'Alien'],
  Sports:      ['Surfing', 'Archery', 'Curling', 'Fencing', 'Bobsled', 'Lacrosse', 'Sumo', 'Polo'],
  Objects:     ['Telescope', 'Compass', 'Accordion', 'Periscope', 'Kazoo', 'Sundial', 'Abacus', 'Locket'],
  Professions: ['Surgeon', 'Astronaut', 'Locksmith', 'Sommelier', 'Cryptographer', 'Taxidermist', 'Falconer', 'Cartographer'],
  'Sci-Fi':    ['Lightsaber', 'Warp Drive', 'Teleporter', 'Hologram', 'Cyborg', 'Mech', 'Black Hole', 'Clone'],
};

const CATEGORY_NAMES = Object.keys(WORD_BANK);

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function corsHeaders(origin, allowedOrigin) {
  const allow = allowedOrigin === '*' ? '*' : (origin === allowedOrigin ? origin : null);
  if (!allow) return {};
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

// ── Routing Worker ────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin, env.ALLOWED_ORIGIN ?? '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 426 });
      }

      const name = url.searchParams.get('name')?.trim().slice(0, 24);
      if (!name) return new Response('Missing ?name', { status: 400 });

      let roomCode = url.searchParams.get('room')?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (!roomCode || roomCode.length < 4) roomCode = generateRoomCode();

      const doId = env.GAME_ROOM.idFromName(roomCode);
      const stub = env.GAME_ROOM.get(doId);

      const doUrl = new URL(request.url);
      doUrl.searchParams.set('room', roomCode);
      doUrl.searchParams.set('name', name);

      return stub.fetch(new Request(doUrl, request));
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);

    return new Response('Not found', { status: 404 });
  },
};

// ── GameRoom Durable Object ───────────────────────────────────────────────────
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT)
    `);
  }

  // ── Connection handling ───────────────────────────────────────────────────

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url  = new URL(request.url);
    const room = url.searchParams.get('room');
    const name = url.searchParams.get('name');
    const id   = crypto.randomUUID().slice(0, 8);

    const { 0: client, 1: server } = new WebSocketPair();

    this.ctx.acceptWebSocket(server, [`id:${id}`, `name:${name}`]);

    if (!this.dbGet('room_code')) {
      this.dbSet('room_code',        room);
      this.dbSet('phase',            'lobby');
      this.dbSet('host_id',          id);
      this.dbSet('round_count',      '0');
      this.dbSet('config_category',  'random');
      this.dbSet('config_imposters', 'random');
    } else if (!this.dbGet('host_id')) {
      this.dbSet('host_id', id);
    }

    await this.broadcast();

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket Hibernation handlers ────────────────────────────────────────

  async webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    const playerId = this.getIdTag(ws);
    if (!playerId) return;

    switch (data.type) {
      case 'start':      await this.startGame(playerId);        break;
      case 'next_round': await this.nextRound(playerId);        break;
      case 'to_lobby':   await this.backToLobby(playerId);      break;
      case 'config':     await this.updateConfig(playerId, data); break;
      case 'ping':       ws.send(JSON.stringify({ type: 'pong' })); break;
    }
  }

  async webSocketClose(ws) {
    const playerId = this.getIdTag(ws);
    if (!playerId) return;

    if (this.dbGet('host_id') === playerId) {
      const next = this.ctx.getWebSockets().filter(w => w !== ws).find(Boolean);
      this.dbSet('host_id', next ? this.getIdTag(next) : '');
    }

    await this.broadcast();
  }

  async webSocketError(ws) {}

  // ── Game logic ────────────────────────────────────────────────────────────

  async startGame(requesterId) {
    if (this.dbGet('host_id') !== requesterId) return;
    const players = this.getActivePlayers();
    if (players.length < 2) return;
    await this.launchRound(players);
  }

  async nextRound(requesterId) {
    if (this.dbGet('host_id') !== requesterId) return;
    if (this.dbGet('phase') !== 'game') return;
    const players = this.getActivePlayers();
    if (players.length < 2) return;
    await this.launchRound(players);
  }

  async launchRound(players) {
    const configCat = this.dbGet('config_category') || 'random';
    const configImp = this.dbGet('config_imposters') || 'random';

    // Resolve category
    const categoryKey = (configCat === 'random' || !WORD_BANK[configCat])
      ? pickRandom(CATEGORY_NAMES)
      : configCat;

    const word = pickRandom(WORD_BANK[categoryKey]);

    // Resolve imposter count — re-rolled fresh every round when 'random'
    let impCount;
    if (configImp === 'random') {
      // 1 up to players.length - 1 (always at least one crew member)
      impCount = Math.floor(Math.random() * (players.length - 1)) + 1;
    } else {
      impCount = Math.min(parseInt(configImp, 10) || 1, players.length - 1);
    }
    impCount = Math.max(1, impCount);

    const imposterIds = shuffle(players).slice(0, impCount).map(p => p.id);
    const round       = parseInt(this.dbGet('round_count') || '0', 10) + 1;

    this.dbSet('phase',        'game');
    this.dbSet('word',         word);
    this.dbSet('category',     categoryKey);
    this.dbSet('imposter_ids', JSON.stringify(imposterIds));
    this.dbSet('round_count',  String(round));

    await this.broadcast();
  }

  async backToLobby(requesterId) {
    if (this.dbGet('host_id') !== requesterId) return;
    this.dbSet('phase',        'lobby');
    this.dbSet('word',         '');
    this.dbSet('category',     '');
    this.dbSet('imposter_ids', '[]');
    await this.broadcast();
  }

  async updateConfig(requesterId, data) {
    if (this.dbGet('host_id') !== requesterId) return;
    if (this.dbGet('phase') !== 'lobby') return;

    if (data.category !== undefined) {
      const cat = String(data.category);
      this.dbSet('config_category', (cat === 'random' || WORD_BANK[cat]) ? cat : 'random');
    }

    if (data.imposters !== undefined) {
      const imp = String(data.imposters);
      this.dbSet('config_imposters', imp === 'random' ? 'random' : String(Math.max(1, parseInt(imp, 10) || 1)));
    }

    await this.broadcast();
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────

  async broadcast() {
    const phase       = this.dbGet('phase')        || 'lobby';
    const roomCode    = this.dbGet('room_code')    || '';
    const word        = this.dbGet('word')         || '';
    const category    = this.dbGet('category')     || '';
    const hostId      = this.dbGet('host_id')      || '';
    const roundCount  = parseInt(this.dbGet('round_count') || '0', 10);
    const imposterIds = JSON.parse(this.dbGet('imposter_ids') || '[]');
    const configCat   = this.dbGet('config_category')  || 'random';
    const configImp   = this.dbGet('config_imposters') || 'random';

    const allPlayers = this.getActivePlayers();

    for (const ws of this.ctx.getWebSockets()) {
      const myId   = this.getIdTag(ws);
      const isHost = myId === hostId;

      let role           = null;
      let wordOut        = null;
      let catOut         = null;
      let fellowImposters = [];

      if (phase === 'game') {
        const amImposter = imposterIds.includes(myId);
        role   = amImposter ? 'imposter' : 'player';
        catOut = category;

        if (amImposter) {
          // Tell imposters who their fellow imposters are (by name)
          fellowImposters = allPlayers
            .filter(p => imposterIds.includes(p.id) && p.id !== myId)
            .map(p => p.name);
        } else {
          wordOut = word;
        }
      }

      try {
        ws.send(JSON.stringify({
          type:  'state',
          phase,
          roomCode,
          roundCount,
          players: allPlayers.map(p => ({
            id:     p.id,
            name:   p.name,
            isHost: p.id === hostId,
            isYou:  p.id === myId,
          })),
          isHost,
          config: { category: configCat, imposters: configImp },
          role,
          word:            wordOut,
          category:        catOut,
          fellowImposters,
          imposterCount:   phase === 'game' ? imposterIds.length : null,
        }));
      } catch {
        // closed socket — ignore
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getActivePlayers() {
    return this.ctx.getWebSockets().map(ws => {
      const tags = this.ctx.getTags(ws);
      const id   = tags.find(t => t.startsWith('id:'))?.slice(3)   || '';
      const name = tags.find(t => t.startsWith('name:'))?.slice(5) || 'Unknown';
      return { id, name };
    }).filter(p => p.id);
  }

  getIdTag(ws) {
    return this.ctx.getTags(ws).find(t => t.startsWith('id:'))?.slice(3) ?? null;
  }

  dbGet(key) {
    const rows = this.ctx.storage.sql.exec(
      'SELECT value FROM state WHERE key = ?', key
    ).toArray();
    return rows[0]?.value ?? null;
  }

  dbSet(key, value) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)', key, value
    );
  }
}
