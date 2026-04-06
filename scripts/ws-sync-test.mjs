import { io } from 'socket.io-client';

const API_URL = 'https://api.metronomdeul.site';
const WS_URL = 'wss://api.metronomdeul.site';
const TEST_TEMPO = 120;
const TEST_BEATS = 4;
const TEST_DURATION_MS = 12000;
const EXPECTED_INTERVAL = 60000 / TEST_TEMPO; // 500ms

const EC2_HOST = 'ubuntu@ec2-13-209-112-19.ap-northeast-2.compute.amazonaws.com';
const PEM_PATH = '~/.ssh/metronomdeul.pem';

// --- Room Creation ---
async function createRoom() {
  const res = await fetch(`${API_URL}/room`, { method: 'POST' });
  if (!res.ok) throw new Error(`Room creation failed: ${res.status}`);
  const data = await res.json();
  return data.uuid;
}

// --- Client Connection ---
function connectClient(name, roomUuid) {
  return new Promise((resolve, reject) => {
    const userId = `test-${name}-${Date.now()}`;
    const records = [];

    const socket = io(WS_URL, {
      query: { roomUuid, userId },
      transports: ['websocket'],
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`${name}: connection timeout`));
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(`[${name}] Connected (id: ${socket.id})`);
      resolve({ socket, records, name, userId });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`${name}: connect error - ${err.message}`));
    });

    // Record beat sync events
    socket.on('beatSync', (data) => {
      records.push({
        serverTime: data.serverTime,
        clientReceiveTime: Date.now(),
        startTime: data.startTime,
        tempo: data.tempo,
        beats: data.beats,
        isPlaying: data.isPlaying,
      });
    });

    // Log other events
    socket.on('metronomeState', (data) => {
      console.log(`[${name}] metronomeState: playing=${data.isPlaying}, tempo=${data.tempo}, beats=${data.beats}`);
    });

    socket.on('initialState', (data) => {
      console.log(`[${name}] initialState: playing=${data.isPlaying}, tempo=${data.tempo}, beats=${data.beats}`);
    });
  });
}

// --- Analysis ---
function printReport(c1, c2, roomUuid, testStart, testEnd) {
  console.log('\n' + '='.repeat(70));
  console.log('  WEBSOCKET METRONOME SYNC TEST REPORT');
  console.log('='.repeat(70));
  console.log(`Room: ${roomUuid}`);
  console.log(`Tempo: ${TEST_TEMPO} BPM (expected interval: ${EXPECTED_INTERVAL}ms)`);
  console.log(`Duration: ${TEST_DURATION_MS / 1000}s`);
  console.log(`Beats received: Client1=${c1.records.length}, Client2=${c2.records.length}`);
  console.log();

  // Match beats by serverTime
  const c1Map = new Map(c1.records.map(r => [r.serverTime, r]));
  const c2Map = new Map(c2.records.map(r => [r.serverTime, r]));
  const allServerTimes = [...new Set([...c1Map.keys(), ...c2Map.keys()])].sort();

  // Per-beat table
  console.log('--- Per-Beat Detail ---');
  console.log(
    'Beat'.padEnd(6) +
    'ServerTime'.padEnd(16) +
    'C1 Latency'.padEnd(14) +
    'C2 Latency'.padEnd(14) +
    'C1-C2 Delta'.padEnd(14) +
    'Interval'.padEnd(12)
  );
  console.log('-'.repeat(70));

  const c1Latencies = [];
  const c2Latencies = [];
  const deltas = [];
  const intervals = [];
  let prevServerTime = null;

  allServerTimes.forEach((st, i) => {
    const r1 = c1Map.get(st);
    const r2 = c2Map.get(st);
    const c1Lat = r1 ? r1.clientReceiveTime - st : null;
    const c2Lat = r2 ? r2.clientReceiveTime - st : null;
    const delta = (c1Lat !== null && c2Lat !== null)
      ? Math.abs(r1.clientReceiveTime - r2.clientReceiveTime)
      : null;
    const interval = prevServerTime !== null ? st - prevServerTime : null;

    if (c1Lat !== null) c1Latencies.push(c1Lat);
    if (c2Lat !== null) c2Latencies.push(c2Lat);
    if (delta !== null) deltas.push(delta);
    if (interval !== null) intervals.push(interval);

    console.log(
      String(i + 1).padEnd(6) +
      String(st).padEnd(16) +
      (c1Lat !== null ? `${c1Lat}ms` : 'MISS').padEnd(14) +
      (c2Lat !== null ? `${c2Lat}ms` : 'MISS').padEnd(14) +
      (delta !== null ? `${delta}ms` : '-').padEnd(14) +
      (interval !== null ? `${interval}ms` : '-').padEnd(12)
    );

    prevServerTime = st;
  });

  // Stats helper
  const stats = (arr, label) => {
    if (arr.length === 0) return console.log(`  ${label}: no data`);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const stddev = Math.sqrt(arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length);
    console.log(`  ${label}: avg=${avg.toFixed(2)}ms  min=${min}ms  max=${max}ms  stddev=${stddev.toFixed(2)}ms`);
  };

  console.log('\n--- Latency Stats ---');
  stats(c1Latencies, 'Client1 latency (client - server clock)');
  stats(c2Latencies, 'Client2 latency (client - server clock)');
  console.log('  * Note: includes clock skew between local machine and EC2');

  console.log('\n--- Inter-Client Sync ---');
  stats(deltas, 'Client delta |C1 - C2|');
  console.log('  * This eliminates clock skew — true sync metric');

  console.log('\n--- Server Beat Interval Jitter ---');
  if (intervals.length > 0) {
    const jitters = intervals.map(iv => Math.abs(iv - EXPECTED_INTERVAL));
    stats(jitters, 'Jitter (|actual - expected|)');
    stats(intervals, 'Raw interval');
  }

  // Missed beats
  const c1Only = allServerTimes.filter(st => c1Map.has(st) && !c2Map.has(st));
  const c2Only = allServerTimes.filter(st => !c1Map.has(st) && c2Map.has(st));
  const expectedBeats = Math.floor(TEST_DURATION_MS / EXPECTED_INTERVAL);

  console.log('\n--- Beat Delivery ---');
  console.log(`  Expected beats: ~${expectedBeats}`);
  console.log(`  Client1 received: ${c1.records.length}`);
  console.log(`  Client2 received: ${c2.records.length}`);
  console.log(`  Matched (both): ${deltas.length}`);
  if (c1Only.length) console.log(`  Client1 only: ${c1Only.length} beats`);
  if (c2Only.length) console.log(`  Client2 only: ${c2Only.length} beats`);

  // EC2 log command
  console.log('\n--- EC2 Server Logs ---');
  console.log('Run this command to see server-side logs:');
  console.log(`  ssh -i ${PEM_PATH} ${EC2_HOST} "docker logs metronomdeul-server --since ${testStart} --until ${testEnd} 2>&1 | grep '${roomUuid}'"`);
  console.log();
}

// --- Main ---
async function runTest() {
  console.log('=== WebSocket Metronome Sync Test ===\n');

  // 1. Create room
  console.log('[1] Creating room...');
  const roomUuid = await createRoom();
  console.log(`    Room: ${roomUuid}\n`);

  // 2. Connect two clients
  console.log('[2] Connecting clients...');
  const [c1, c2] = await Promise.all([
    connectClient('Client1', roomUuid),
    connectClient('Client2', roomUuid),
  ]);
  console.log();

  // Wait for initial state
  await new Promise(r => setTimeout(r, 1000));

  // 3. Start metronome
  const testStart = new Date().toISOString();
  console.log(`[3] Starting metronome (tempo=${TEST_TEMPO}, beats=${TEST_BEATS})...`);
  c1.socket.emit('startMetronome', { tempo: TEST_TEMPO, beats: TEST_BEATS });

  // 4. Wait for test duration
  console.log(`[4] Collecting data for ${TEST_DURATION_MS / 1000}s...\n`);
  await new Promise(r => setTimeout(r, TEST_DURATION_MS));

  // 5. Stop metronome
  console.log('[5] Stopping metronome...');
  c1.socket.emit('stopMetronome');
  await new Promise(r => setTimeout(r, 1000));
  const testEnd = new Date().toISOString();

  // 6. Disconnect
  c1.socket.disconnect();
  c2.socket.disconnect();

  // 7. Print report
  printReport(c1, c2, roomUuid, testStart, testEnd);
}

runTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
