import pg from 'pg';
const TTL_MS = 24 * 60 * 60 * 1000;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export class MemoryStore {
  constructor({maxRooms = 1000} = {}) { this.rooms = new Map(); this.locks = new Map(); this.maxRooms = maxRooms; }
  async initialize() {}
  async create(room) {
    this.cleanup();
    if (this.rooms.has(room.code)) return false;
    if (this.rooms.size >= this.maxRooms) throw new HttpError(503, 'The server is full. Please try again later.');
    this.rooms.set(room.code, {room: structuredClone(room), updated: Date.now()});
    return true;
  }
  async withRoom(code, fn) {
    const previous = this.locks.get(code) ?? Promise.resolve();
    let release;
    const held = new Promise(resolve => { release = resolve; });
    this.locks.set(code, held);
    await previous;
    try {
      const entry = this.rooms.get(code);
      if (!entry || Date.now() - entry.updated > TTL_MS) throw new HttpError(404, 'Room not found. Check the code or create a new room.');
      const room = structuredClone(entry.room);
      const result = await fn(room);
      if (result.changed) this.rooms.set(code, {room, updated: Date.now()});
      return result.reply;
    } finally {
      release();
      if (this.locks.get(code) === held) this.locks.delete(code);
    }
  }
  cleanup() { for (const [code, row] of this.rooms) if (Date.now() - row.updated > TTL_MS) this.rooms.delete(code); }
  async health() { return true; }
  async close() {}
}
export class PostgresStore {
  constructor({connectionString, ssl} = {}) {
    if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL storage.');
    this.pool = new pg.Pool({connectionString, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, ...(ssl ? {ssl: {rejectUnauthorized: true}} : {})});
    this.pool.on('error', () => console.error('An idle database connection failed. New connections will be retried.'));
  }
  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS game_rooms (
      code VARCHAR(6) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS game_rooms_updated_at_idx ON game_rooms(updated_at)');
  }
  async create(room) {
    const res = await this.pool.query('INSERT INTO game_rooms (code, data) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING', [room.code, JSON.stringify(room)]);
    return res.rowCount === 1;
  }
  async withRoom(code, fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query("SELECT data FROM game_rooms WHERE code = $1 AND updated_at > NOW() - INTERVAL '24 hours' FOR UPDATE", [code]);
      if (!found.rowCount) throw new HttpError(404, 'Room not found. Check the code or create a new room.');
      const room = found.rows[0].data;
      const result = await fn(room);
      if (result.changed) await client.query('UPDATE game_rooms SET data = $2::jsonb, updated_at = NOW() WHERE code = $1', [code, JSON.stringify(room)]);
      await client.query('COMMIT');
      return result.reply;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  async cleanup() { await this.pool.query("DELETE FROM game_rooms WHERE updated_at < NOW() - INTERVAL '24 hours'"); }
  async health() { await this.pool.query('SELECT 1'); return true; }
  async close() { await this.pool.end(); }
}
export function createStore(env = process.env) {
  const type = env.ROOM_STORE || (env.DATABASE_URL ? 'postgres' : 'memory');
  if (type === 'memory') return new MemoryStore();
  if (type === 'postgres') return new PostgresStore({connectionString: env.DATABASE_URL, ssl: env.PGSSLMODE === 'require'});
  throw new Error('ROOM_STORE must be memory or postgres.');
}
