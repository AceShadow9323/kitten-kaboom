import {avatarId} from '../game/avatars.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {html} from '../game/ui.mjs';
import {action, view, advanceBots, maxPlayers, drawKey} from '../game/game.mjs';
import {HttpError} from './storage.mjs';
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z2-9]{6}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ART_DIR = new URL('../artwork/', import.meta.url);
const JSON_HEADERS = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'};
function reply(res, status, data, headers = JSON_HEADERS) { res.writeHead(status, headers); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); }
async function readBody(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send JSON for game actions.');
  let size = 0;
  const chunks = [];
  for await (const part of req) { size += part.length; if (size > 16384) throw new HttpError(413, 'Request is too large.'); chunks.push(part); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
  catch { throw new HttpError(400, 'Invalid JSON request.'); }
}
export function createApp({store, trustProxy = false, rateLimit = true} = {}) {
  if (!store) throw new Error('Room storage is required.');
  const assets = new Map();
  const counters = new Map();
  function checkRate(req, path) {
    if (!rateLimit) return;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
    const ip = trustProxy && forwarded.length ? forwarded.at(-1) : req.socket.remoteAddress;
    const key = (path === '/api/create' ? 'create:' : 'api:') + ip;
    const now = Date.now(); let counter = counters.get(key);
    if (!counter || now - counter.start >= 60000) { counter = {start: now, count: 0}; counters.set(key, counter); }
    if (++counter.count > (path === '/api/create' ? 10 : 1200)) throw new HttpError(429, 'Too many requests. Please wait a moment.');
    if (counters.size > 5000) for (const [k,v] of counters) if (now - v.start > 60000) counters.delete(k);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/healthz') {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
        await store.health(); reply(res, 200, {ok: true}); return;
      }
      if (['/','/play','/play/'].includes(url.pathname) && ['GET', 'HEAD'].includes(req.method)) { reply(res, 200, req.method === 'HEAD' ? '' : html, {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache'}); return; }
      const previewFiles={'/preview/explosion':'explosion.html','/preview/explosion/':'explosion.html','/preview/cards':'cards.html','/preview/cards/':'cards.html'};
      if (Object.hasOwn(previewFiles,url.pathname) && ['GET','HEAD'].includes(req.method)) { const preview = await readFile(new URL('../previews/'+previewFiles[url.pathname],import.meta.url),'utf8'); reply(res,200,req.method==='HEAD'?'':preview,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}); return; }
      const artwork = /^\/art\/([a-z]+)\.(jpg|png)$/.exec(url.pathname);
      if (artwork && ['GET','HEAD'].includes(req.method)) {
        const assetName = artwork[1]+'.'+artwork[2];
        let bytes = assets.get(assetName);
        if (!bytes) { try { bytes = await readFile(new URL(assetName, ART_DIR)); } catch (e) { if (e.code === 'ENOENT') throw new HttpError(404, 'Card image not found.'); throw e; } assets.set(assetName, bytes); }
        reply(res, 200, req.method === 'HEAD' ? '' : bytes, {'content-type': artwork[2]==='png'?'image/png':'image/jpeg', 'cache-control': 'public, max-age=86400'}); return;
      }
      const path = url.pathname;
      if (!['/api/create', '/api/join', '/api/move', '/api/state'].includes(path)) throw new HttpError(404, 'Not found.');
      checkRate(req, path);
      if (req.method !== (path === '/api/state' ? 'GET' : 'POST')) throw new HttpError(405, 'Method not allowed.');
      // Cross-origin browser game actions are unnecessary. Normal same-origin fetches work without a CORS grant.
      if (req.headers.origin) {
        let originHost; try { originHost = new URL(req.headers.origin).host; } catch { throw new HttpError(403, 'Invalid request origin.'); }
        if (originHost !== req.headers.host) throw new HttpError(403, 'Open the game directly to play.');
      }
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      if (!TOKEN.test(token)) throw new HttpError(401, 'Missing player identity. Reload the game.');
      const body = req.method === 'POST' ? await readBody(req) : {};
      if (['/api/create','/api/join'].includes(url.pathname)) { try { avatarId(body.avatar); } catch (e) { throw new HttpError(400,e.message); } }
      const name = typeof body.name === 'string' ? body.name.trim().slice(0,20) : '';
      if (path === '/api/create') {
        if (!name) throw new HttpError(400, 'Enter your nickname.');
        const mode = body.mode ?? 'original';
        if (!['original','party'].includes(mode)) throw new HttpError(400, 'Choose Original or Party Pack.');
        for (let i=0; i<5; i++) {
          const code = [...randomBytes(6)].map(x=>ALPHABET[x % ALPHABET.length]).join('');
          const room = {code, host: token, mode, turnSeconds:30, phase: 'lobby', players: [{id:token, name, avatar:avatarId(body.avatar), ready:false}], log: [], rev: 0};
          if (await store.create(room)) { reply(res,200,view(room,token)); return; }
        }
        throw new HttpError(503, 'Could not create a room. Please try again.');
      }
      const code = String(body.code ?? url.searchParams.get('code') ?? '').toUpperCase();
      if (!CODE.test(code)) throw new HttpError(400, 'Enter a six-character room code.');
      const data = await store.withRoom(code, room => {
        const member = room.players.some(p=>p.id === token);
        if (!member && path !== '/api/join') throw new HttpError(403, 'Join this room first.');
        const requestId = path === '/api/move' ? body.requestId : undefined;
        if (requestId !== undefined && !TOKEN.test(requestId)) throw new HttpError(400, 'Invalid action identity.');
        if (requestId && room.appliedMoves?.some(m=>m.token===token&&m.id===requestId)) return {changed:false,reply:view(room,token)};
        if (path === '/api/move' && body.roundId !== undefined && body.roundId !== room.roundId) throw new HttpError(409, 'The round changed. Refresh the table before playing.');
        if (path === '/api/move' && ['play','give'].includes(body.action) && body.handKey !== undefined && body.handKey !== JSON.stringify(room.players.find(p=>p.id===token)?.hand)) throw new HttpError(409, 'Your hand changed. Select your card again.');
        let changed = true;
        if (path === '/api/state') changed = advanceBots(room);
        else if (path === '/api/join') {
          if (member) changed = false;
          else {
            if (!name) throw new HttpError(400, 'Enter your nickname.');
            if (room.phase !== 'lobby') throw new HttpError(400, 'This game has already started.');
            if (room.players.length >= maxPlayers(room)) throw new HttpError(400, 'This room is full.');
            room.players.push({id: token, name, avatar:avatarId(body.avatar), ready:false});
          }
        } else if (body.action === 'leave') {
          if (room.phase === 'playing') throw new HttpError(400, 'Finish this round or request an end-round vote before leaving.');
          room.players = room.players.filter(p=>p.id !== token);
          if (room.host === token) room.host = room.players.find(p=>!p.bot)?.id ?? '';
        } else {
          const move = {...body};
          if (['play','removebot'].includes(move.action) && /^player-\d+$/.test(move.target || '')) move.target = room.players[Number(move.target.split('-')[1])]?.id;
          // A click from an already completed draw step must not consume the next owed draw.
          if (move.action === 'draw' && move.drawKey !== undefined && move.drawKey !== drawKey(room)) changed = false;
          else { try { action(room, token, move); } catch (error) { throw new HttpError(400, error.message); } }
        }
        if (requestId) {
          (room.appliedMoves??=[]).push({token,id:requestId});
          room.appliedMoves=room.appliedMoves.slice(-128);
          changed=true;
        }
        if (changed) room.rev = (room.rev ?? 0) + 1;
        return {changed, reply: view(room,token)};
      });
      reply(res,200,data);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : req.url === '/healthz' ? 503 : 500;
      if (status >= 500) console.error('Request could not be completed:', error instanceof HttpError ? error.message : 'server or storage error');
      if (!res.headersSent) reply(res,status,{error: error instanceof HttpError ? error.message : 'Server temporarily unavailable. Please try again.'});
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
