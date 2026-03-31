/**
 * Metro-Nomedeul E2E Test Suite
 * 15 scenarios covering REST API, WebSocket, Metronome, and Edge Cases
 */
import { io } from 'socket.io-client';

const API_URL = 'https://api.metronomdeul.site';
const WS_URL = 'wss://api.metronomdeul.site';

let passed = 0;
let failed = 0;
const failures = [];

function log(status, name, detail = '') {
  const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
  if (status === 'PASS') passed++;
  else {
    failed++;
    failures.push({ name, detail });
  }
}

function connectSocket(roomUuid, userId = `test-${Date.now()}`, { waitInitial = false } = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      query: { roomUuid, userId },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    let initialState = null;
    // Always capture initialState so it's not missed
    socket.once('initialState', (data) => { initialState = data; });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, 8000);

    socket.on('connect', () => {
      clearTimeout(timer);
      if (waitInitial) {
        // Wait a bit for initialState to arrive
        const check = () => {
          if (initialState) resolve({ socket, initialState });
          else setTimeout(check, 50);
        };
        setTimeout(check, 50);
      } else {
        resolve({ socket, initialState: null });
      }
    });
    socket.on('connect_error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===================== REST API TESTS =====================

async function test1_health() {
  try {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    if (res.status === 200 && data.status === 'ok') {
      log('PASS', '1. GET /health');
    } else {
      log('FAIL', '1. GET /health', `status=${res.status}, body=${JSON.stringify(data)}`);
    }
  } catch (e) {
    log('FAIL', '1. GET /health', e.message);
  }
}

async function test2_createRoom() {
  try {
    const res = await fetch(`${API_URL}/room`, { method: 'POST' });
    const data = await res.json();
    if (res.status === 201 && data.uuid && /^[A-Za-z0-9_-]{8}$/.test(data.uuid)) {
      log('PASS', '2. POST /room');
      return data.uuid;
    } else {
      log('FAIL', '2. POST /room', `status=${res.status}, body=${JSON.stringify(data)}`);
    }
  } catch (e) {
    log('FAIL', '2. POST /room', e.message);
  }
  return null;
}

async function test3_getRoom(uuid) {
  try {
    const res = await fetch(`${API_URL}/room/${uuid}`);
    const data = await res.json();
    if (res.status === 200 && data.roomId === uuid) {
      log('PASS', '3. GET /room/:uuid (valid)');
    } else {
      log('FAIL', '3. GET /room/:uuid (valid)', `status=${res.status}, roomId=${data.roomId}`);
    }
  } catch (e) {
    log('FAIL', '3. GET /room/:uuid (valid)', e.message);
  }
}

async function test4_getRoom_badFormat() {
  try {
    const res = await fetch(`${API_URL}/room/!!!`);
    if (res.status === 400) {
      log('PASS', '4. GET /room/!!! (bad format) → 400');
    } else {
      log('FAIL', '4. GET /room/!!! (bad format) → 400', `got ${res.status}`);
    }
  } catch (e) {
    log('FAIL', '4. GET /room/!!! (bad format) → 400', e.message);
  }
}

async function test5_getRoom_notFound() {
  try {
    const res = await fetch(`${API_URL}/room/zzzzzzzz`);
    if (res.status === 404) {
      log('PASS', '5. GET /room/zzzzzzzz (not found) → 404');
    } else {
      log('FAIL', '5. GET /room/zzzzzzzz (not found) → 404', `got ${res.status}`);
    }
  } catch (e) {
    log('FAIL', '5. GET /room/zzzzzzzz (not found) → 404', e.message);
  }
}

// ===================== WEBSOCKET TESTS =====================

async function test6_wsConnect_noRoom() {
  try {
    const socket = io(WS_URL, {
      query: {},
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
    });

    const disconnected = await new Promise((resolve) => {
      const timer = setTimeout(() => { socket.disconnect(); resolve(false); }, 4000);
      socket.on('disconnect', () => { clearTimeout(timer); resolve(true); });
      socket.on('connect_error', () => { clearTimeout(timer); resolve(true); });
    });

    if (disconnected) {
      log('PASS', '6. WS connect without roomUuid → disconnected');
    } else {
      log('FAIL', '6. WS connect without roomUuid → disconnected', 'connection stayed open');
      socket.disconnect();
    }
  } catch (e) {
    log('FAIL', '6. WS connect without roomUuid → disconnected', e.message);
  }
}

async function test6b_wsConnect_invalidRoom() {
  try {
    const socket = io(WS_URL, {
      query: { roomUuid: 'NONEXIST', userId: 'test' },
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000,
    });

    const disconnected = await new Promise((resolve) => {
      const timer = setTimeout(() => { socket.disconnect(); resolve(false); }, 4000);
      socket.on('disconnect', () => { clearTimeout(timer); resolve(true); });
      socket.on('connect_error', () => { clearTimeout(timer); resolve(true); });
    });

    if (disconnected) {
      log('PASS', '6b. WS connect to non-existent room → disconnected');
    } else {
      log('FAIL', '6b. WS connect to non-existent room → disconnected', 'stayed connected');
      socket.disconnect();
    }
  } catch (e) {
    log('FAIL', '6b. WS connect to non-existent room → disconnected', e.message);
  }
}

async function test7_wsConnect_initialState(uuid) {
  let socket;
  try {
    const conn = await connectSocket(uuid, undefined, { waitInitial: true });
    socket = conn.socket;
    const state = conn.initialState;

    const ok = state.type === 'initialState' &&
      state.isPlaying === false &&
      typeof state.tempo === 'number' &&
      typeof state.beats === 'number' &&
      typeof state.serverTime === 'number';

    if (ok) {
      log('PASS', '7. WS connect → initialState received');
    } else {
      log('FAIL', '7. WS connect → initialState received', JSON.stringify(state));
    }
  } catch (e) {
    log('FAIL', '7. WS connect → initialState received', e.message);
  } finally {
    socket?.disconnect();
  }
}

async function test8_timeSync(uuid) {
  let socket;
  try {
    const conn = await connectSocket(uuid, undefined, { waitInitial: true });
    socket = conn.socket;

    const sendTime = Date.now();
    socket.emit('timeSyncRequest', { clientSendTime: sendTime });
    const resp = await waitForEvent(socket, 'timeSyncResponse');

    const rtt = Date.now() - sendTime;
    const ok = resp.clientSendTime === sendTime &&
      typeof resp.serverTime === 'number' &&
      rtt >= 0 && rtt < 5000;

    if (ok) {
      log('PASS', `8. TimeSync → RTT=${rtt}ms`);
    } else {
      log('FAIL', '8. TimeSync', `rtt=${rtt}, resp=${JSON.stringify(resp)}`);
    }
  } catch (e) {
    log('FAIL', '8. TimeSync', e.message);
  } finally {
    socket?.disconnect();
  }
}

// ===================== METRONOME TESTS =====================

async function test9_startMetronome(uuid) {
  let s1, s2;
  try {
    const c1 = await connectSocket(uuid, 'test-c1', { waitInitial: true });
    const c2 = await connectSocket(uuid, 'test-c2', { waitInitial: true });
    s1 = c1.socket;
    s2 = c2.socket;

    const p1 = waitForEvent(s1, 'metronomeState');
    const p2 = waitForEvent(s2, 'metronomeState');
    s1.emit('startMetronome', { tempo: 120, beats: 4 });

    const [st1, st2] = await Promise.all([p1, p2]);
    const ok = st1.isPlaying === true && st2.isPlaying === true &&
      st1.tempo === 120 && st2.tempo === 120;

    if (ok) {
      log('PASS', '9. startMetronome → both clients receive isPlaying=true');
    } else {
      log('FAIL', '9. startMetronome', `c1=${st1.isPlaying}, c2=${st2.isPlaying}`);
    }
    return { s1, s2 };
  } catch (e) {
    log('FAIL', '9. startMetronome', e.message);
    s1?.disconnect();
    s2?.disconnect();
    return null;
  }
}

async function test10_beatSync(s1, s2) {
  try {
    const beats1 = [];
    const beats2 = [];

    s1.on('beatSync', (d) => beats1.push(d));
    s2.on('beatSync', (d) => beats2.push(d));

    await sleep(3000);

    s1.off('beatSync');
    s2.off('beatSync');

    // At 120 BPM, expect ~6 beats in 3 seconds
    const expected = 6;
    const ok1 = Math.abs(beats1.length - expected) <= 2;
    const ok2 = Math.abs(beats2.length - expected) <= 2;

    // Check currentBeat field exists
    const hasBeatIdx = beats1.length > 0 && typeof beats1[0].currentBeat === 'number';

    if (ok1 && ok2 && hasBeatIdx) {
      log('PASS', `10. beatSync → c1=${beats1.length}, c2=${beats2.length} beats in 3s (expected ~${expected}), currentBeat present`);
    } else {
      log('FAIL', '10. beatSync', `c1=${beats1.length}, c2=${beats2.length}, hasBeatIdx=${hasBeatIdx}`);
    }
  } catch (e) {
    log('FAIL', '10. beatSync', e.message);
  }
}

async function test11_stopMetronome(s1, s2) {
  try {
    const p1 = waitForEvent(s1, 'metronomeState');
    const p2 = waitForEvent(s2, 'metronomeState');
    s1.emit('stopMetronome');

    const [st1, st2] = await Promise.all([p1, p2]);
    if (st1.isPlaying === false && st2.isPlaying === false) {
      log('PASS', '11. stopMetronome → both clients receive isPlaying=false');
    } else {
      log('FAIL', '11. stopMetronome', `c1=${st1.isPlaying}, c2=${st2.isPlaying}`);
    }
  } catch (e) {
    log('FAIL', '11. stopMetronome', e.message);
  }
}

async function test12_changeTempo(s1, s2) {
  try {
    const p1 = waitForEvent(s1, 'metronomeState');
    const p2 = waitForEvent(s2, 'metronomeState');
    s1.emit('changeTempo', { tempo: 140 });

    const [st1, st2] = await Promise.all([p1, p2]);
    if (st1.tempo === 140 && st2.tempo === 140) {
      log('PASS', '12. changeTempo → both clients see tempo=140');
    } else {
      log('FAIL', '12. changeTempo', `c1.tempo=${st1.tempo}, c2.tempo=${st2.tempo}`);
    }
  } catch (e) {
    log('FAIL', '12. changeTempo', e.message);
  }
}

async function test13_changeBeats(s1, s2) {
  try {
    const p1 = waitForEvent(s1, 'metronomeState');
    const p2 = waitForEvent(s2, 'metronomeState');
    s1.emit('changeBeats', { beats: 6 });

    const [st1, st2] = await Promise.all([p1, p2]);
    if (st1.beats === 6 && st2.beats === 6) {
      log('PASS', '13. changeBeats → both clients see beats=6');
    } else {
      log('FAIL', '13. changeBeats', `c1.beats=${st1.beats}, c2.beats=${st2.beats}`);
    }
  } catch (e) {
    log('FAIL', '13. changeBeats', e.message);
  } finally {
    s1?.disconnect();
    s2?.disconnect();
  }
}

// ===================== EDGE CASES =====================

async function test14_reconnect(uuid) {
  let s1, s2;
  try {
    // First client sets tempo and beats
    const c1 = await connectSocket(uuid, 'test-persist-1', { waitInitial: true });
    s1 = c1.socket;

    // Start metronome first to create state, then change tempo/beats
    const pStart = waitForEvent(s1, 'metronomeState');
    s1.emit('startMetronome', { tempo: 120, beats: 4 });
    await pStart;

    const pStop = waitForEvent(s1, 'metronomeState');
    s1.emit('stopMetronome');
    await pStop;

    const pTempo = waitForEvent(s1, 'metronomeState');
    s1.emit('changeTempo', { tempo: 160 });
    await pTempo;

    const pBeats = waitForEvent(s1, 'metronomeState');
    s1.emit('changeBeats', { beats: 3 });
    await pBeats;

    // Second client connects — should get tempo=160, beats=3
    const c2 = await connectSocket(uuid, 'test-persist-2', { waitInitial: true });
    s2 = c2.socket;
    const initial = c2.initialState;

    if (initial.tempo === 160 && initial.beats === 3) {
      log('PASS', '14. Reconnect → existing state preserved (tempo=160, beats=3)');
    } else {
      log('FAIL', '14. Reconnect → existing state preserved', `tempo=${initial.tempo}, beats=${initial.beats}`);
    }
  } catch (e) {
    log('FAIL', '14. Reconnect → existing state preserved', e.message);
  } finally {
    s1?.disconnect();
    s2?.disconnect();
  }
}

async function test15_cleanup() {
  let socket;
  try {
    // Create a new room, set state, disconnect all, reconnect
    const res = await fetch(`${API_URL}/room`, { method: 'POST' });
    const { uuid } = await res.json();

    const c1 = await connectSocket(uuid, 'test-cleanup-1', { waitInitial: true });

    // Start then stop to create state, then change tempo
    const pStart = waitForEvent(c1.socket, 'metronomeState');
    c1.socket.emit('startMetronome', { tempo: 200, beats: 4 });
    await pStart;

    const pStop = waitForEvent(c1.socket, 'metronomeState');
    c1.socket.emit('stopMetronome');
    await pStop;

    // Disconnect — triggers cleanup since last client
    c1.socket.disconnect();
    await sleep(1000);

    // Reconnect — should get default state (tempo=120, beats=4)
    const c2 = await connectSocket(uuid, 'test-cleanup-2', { waitInitial: true });
    socket = c2.socket;
    const initial = c2.initialState;

    if (initial.tempo === 120 && initial.beats === 4) {
      log('PASS', '15. Cleanup → state reset after all clients leave');
    } else {
      log('FAIL', '15. Cleanup → state reset', `tempo=${initial.tempo}, beats=${initial.beats}`);
    }
  } catch (e) {
    log('FAIL', '15. Cleanup → state reset', e.message);
  } finally {
    socket?.disconnect();
  }
}

// ===================== RUNNER =====================

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('  Metro-Nomedeul E2E Test Suite');
  console.log('  Target: ' + API_URL);
  console.log('='.repeat(60) + '\n');

  // REST API
  console.log('--- REST API ---');
  await test1_health();
  const uuid = await test2_createRoom();
  if (!uuid) { console.log('ABORT: Cannot create room'); process.exit(1); }
  await test3_getRoom(uuid);
  await test4_getRoom_badFormat();
  await test5_getRoom_notFound();

  // WebSocket
  console.log('\n--- WebSocket ---');
  await test6_wsConnect_noRoom();
  await test6b_wsConnect_invalidRoom();
  await test7_wsConnect_initialState(uuid);
  await test8_timeSync(uuid);

  // Metronome (reuse uuid, tests 9-13 are sequential)
  console.log('\n--- Metronome ---');
  const clients = await test9_startMetronome(uuid);
  if (clients) {
    await test10_beatSync(clients.s1, clients.s2);
    await test11_stopMetronome(clients.s1, clients.s2);
    await test12_changeTempo(clients.s1, clients.s2);
    await test13_changeBeats(clients.s1, clients.s2);
  } else {
    log('FAIL', '10. beatSync', 'skipped — no clients');
    log('FAIL', '11. stopMetronome', 'skipped');
    log('FAIL', '12. changeTempo', 'skipped');
    log('FAIL', '13. changeBeats', 'skipped');
  }

  // Edge Cases (use new rooms)
  console.log('\n--- Edge Cases ---');
  const res2 = await fetch(`${API_URL}/room`, { method: 'POST' });
  const { uuid: uuid2 } = await res2.json();
  await test14_reconnect(uuid2);
  await test15_cleanup();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    failures.forEach(f => console.log(`    - ${f.name}: ${f.detail}`));
  }
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
