/**
 * WebSocket Sync Test — Local Client vs EC2 Client
 *
 * Client1: runs locally (this machine)
 * Client2: runs on EC2 via Docker (node inside server container)
 *
 * Both clients record beatSync timestamps independently,
 * then results are collected and compared.
 */
import { io } from 'socket.io-client';
import { exec } from 'child_process';

const API_URL = 'https://api.metronomdeul.site';
const WS_URL = 'wss://api.metronomdeul.site';
const TEST_TEMPO = 120;
const TEST_BEATS = 4;
const TEST_DURATION_MS = 12000;
const EXPECTED_INTERVAL = 60000 / TEST_TEMPO;

const EC2_HOST = 'ubuntu@ec2-13-209-112-19.ap-northeast-2.compute.amazonaws.com';
const PEM_PATH = '/Users/lth/.ssh/metronomdeul.pem';
const SSH_CMD = `ssh -i ${PEM_PATH} -o StrictHostKeyChecking=no ${EC2_HOST}`;

// EC2 client script — runs inside Docker container with node available
const EC2_CLIENT_SCRIPT = (roomUuid, durationMs) => `
const { io } = require('socket.io-client');
const records = [];
const socket = io('ws://localhost:3000', {
  query: { roomUuid: '${roomUuid}', userId: 'test-ec2-' + Date.now() },
  transports: ['websocket'],
  reconnection: false,
});
socket.on('connect', () => console.error('EC2_CLIENT_CONNECTED'));
socket.on('connect_error', (err) => console.error('EC2_CONNECT_ERROR: ' + err.message));
socket.on('beatSync', (data) => {
  records.push({ serverTime: data.serverTime, clientReceiveTime: Date.now() });
});
setTimeout(() => {
  socket.disconnect();
  console.log(JSON.stringify(records));
  process.exit(0);
}, ${durationMs});
`;

async function createRoom() {
  const res = await fetch(`${API_URL}/room`, { method: 'POST' });
  if (!res.ok) throw new Error(`Room creation failed: ${res.status}`);
  const data = await res.json();
  return data.uuid;
}

function connectLocalClient(name, roomUuid) {
  return new Promise((resolve, reject) => {
    const userId = `test-local-${Date.now()}`;
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
      console.log(`[${name}] Connected locally (id: ${socket.id})`);
      resolve({ socket, records, name });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`${name}: connect error - ${err.message}`));
    });

    socket.on('beatSync', (data) => {
      records.push({
        serverTime: data.serverTime,
        clientReceiveTime: Date.now(),
      });
    });

    socket.on('metronomeState', (data) => {
      console.log(`[${name}] metronomeState: playing=${data.isPlaying}`);
    });

    socket.on('initialState', (data) => {
      console.log(`[${name}] initialState: playing=${data.isPlaying}`);
    });
  });
}

function printReport(localRecords, ec2Records, roomUuid, scenario) {
  console.log('\n' + '='.repeat(70));
  console.log(`  SYNC TEST: ${scenario}`);
  console.log('='.repeat(70));
  console.log(`Room: ${roomUuid} | Tempo: ${TEST_TEMPO} BPM | Expected interval: ${EXPECTED_INTERVAL}ms`);
  console.log(`Beats: Local=${localRecords.length}, EC2=${ec2Records.length}\n`);

  const localMap = new Map(localRecords.map(r => [r.serverTime, r]));
  const ec2Map = new Map(ec2Records.map(r => [r.serverTime, r]));
  const allServerTimes = [...new Set([...localMap.keys(), ...ec2Map.keys()])].sort();

  console.log(
    'Beat'.padEnd(6) +
    'Local Lat'.padEnd(13) +
    'EC2 Lat'.padEnd(13) +
    'Delta'.padEnd(10) +
    'Interval'.padEnd(10)
  );
  console.log('-'.repeat(52));

  const localLats = [], ec2Lats = [], deltas = [], intervals = [];
  let prev = null;

  allServerTimes.forEach((st, i) => {
    const lr = localMap.get(st);
    const er = ec2Map.get(st);
    const ll = lr ? lr.clientReceiveTime - st : null;
    const el = er ? er.clientReceiveTime - st : null;
    const d = (lr && er) ? Math.abs(lr.clientReceiveTime - er.clientReceiveTime) : null;
    const iv = prev !== null ? st - prev : null;

    if (ll !== null) localLats.push(ll);
    if (el !== null) ec2Lats.push(el);
    if (d !== null) deltas.push(d);
    if (iv !== null) intervals.push(iv);

    console.log(
      String(i + 1).padEnd(6) +
      (ll !== null ? `${ll}ms` : 'MISS').padEnd(13) +
      (el !== null ? `${el}ms` : 'MISS').padEnd(13) +
      (d !== null ? `${d}ms` : '-').padEnd(10) +
      (iv !== null ? `${iv}ms` : '-').padEnd(10)
    );
    prev = st;
  });

  const stats = (arr) => {
    if (!arr.length) return { avg: 0, min: 0, max: 0, stddev: 0 };
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const stddev = Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
    return { avg: avg.toFixed(1), min, max, stddev: stddev.toFixed(1) };
  };

  const ls = stats(localLats), es = stats(ec2Lats), ds = stats(deltas), js = stats(intervals.map(iv => Math.abs(iv - EXPECTED_INTERVAL)));

  console.log('\n--- Summary ---');
  console.log(`  Local latency:    avg=${ls.avg}ms  min=${ls.min}ms  max=${ls.max}ms  stddev=${ls.stddev}ms`);
  console.log(`  EC2 latency:      avg=${es.avg}ms  min=${es.min}ms  max=${es.max}ms  stddev=${es.stddev}ms`);
  console.log(`  Inter-client Δ:   avg=${ds.avg}ms  min=${ds.min}ms  max=${ds.max}ms  stddev=${ds.stddev}ms`);
  console.log(`  Beat jitter:      avg=${js.avg}ms  min=${js.min}ms  max=${js.max}ms`);
  console.log(`  Matched beats:    ${deltas.length}/${allServerTimes.length}`);

  const localOnly = allServerTimes.filter(st => localMap.has(st) && !ec2Map.has(st)).length;
  const ec2Only = allServerTimes.filter(st => !localMap.has(st) && ec2Map.has(st)).length;
  if (localOnly) console.log(`  Local only:       ${localOnly} beats`);
  if (ec2Only) console.log(`  EC2 only:         ${ec2Only} beats`);
  console.log();
}

async function runTest() {
  console.log('=== WebSocket Sync Test: Local vs EC2 ===\n');

  // 1. Create room
  console.log('[1] Creating room...');
  const roomUuid = await createRoom();
  console.log(`    Room: ${roomUuid}\n`);

  // 2. Connect local client
  console.log('[2] Connecting local client...');
  const local = await connectLocalClient('Local', roomUuid);

  // 3. Start EC2 client in background via Docker exec
  const ec2Duration = TEST_DURATION_MS + 3000; // extra buffer
  const escapedScript = EC2_CLIENT_SCRIPT(roomUuid, ec2Duration).replace(/'/g, "'\\''");
  const dockerCmd = `docker exec metronomdeul-server node -e '${escapedScript}'`;
  const sshFullCmd = `${SSH_CMD} "${dockerCmd}"`;

  console.log('[3] Starting EC2 client (inside Docker container)...');

  // Run EC2 client asynchronously so it doesn't block the event loop
  const ec2Promise = new Promise((resolve, reject) => {
    exec(sshFullCmd, { timeout: ec2Duration + 15000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stderr) console.log(`    EC2 stderr: ${stderr.trim()}`);
      if (err && !stdout) {
        reject(new Error(`EC2 client error: ${err.message}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        console.error('EC2 raw output:', stdout);
        reject(new Error('Failed to parse EC2 client output'));
      }
    });
  });

  // Wait for EC2 client to connect
  await new Promise(r => setTimeout(r, 2000));

  // 4. Start metronome
  console.log(`[4] Starting metronome (tempo=${TEST_TEMPO})...`);
  local.socket.emit('startMetronome', { tempo: TEST_TEMPO, beats: TEST_BEATS });

  // 5. Wait
  console.log(`[5] Collecting data for ${TEST_DURATION_MS / 1000}s...\n`);
  await new Promise(r => setTimeout(r, TEST_DURATION_MS));

  // 6. Stop
  console.log('[6] Stopping metronome...');
  local.socket.emit('stopMetronome');
  await new Promise(r => setTimeout(r, 1500));
  local.socket.disconnect();

  // 7. Collect EC2 results
  console.log('[7] Collecting EC2 client results...');
  const ec2Records = await ec2Promise;
  console.log(`    EC2 client recorded ${ec2Records.length} beats`);

  // 8. Report
  printReport(local.records, ec2Records, roomUuid, 'Local (Korea) vs EC2 (ap-northeast-2)');
}

runTest().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
