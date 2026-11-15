import {createStore} from './storage.mjs';
import {createApp} from './app.mjs';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port number.');
const store = createStore();
await store.initialize();
const server = createApp({store, trustProxy: process.env.TRUST_PROXY === '1'});
server.listen(port,'0.0.0.0',()=>console.log('Kitten Kaboom listening on port', server.address().port, 'with', process.env.ROOM_STORE || (process.env.DATABASE_URL ? 'postgres' : 'memory'), 'room storage.'));
const cleanup = setInterval(()=>Promise.resolve(store.cleanup()).catch(()=>console.error('Room cleanup failed; it will retry later.')),15*60*1000);
cleanup.unref();
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true; clearInterval(cleanup);
  server.close(async()=>{ await store.close(); process.exit(0); });
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGTERM',stop);
process.on('SIGINT',stop);
