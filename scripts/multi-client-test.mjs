/**
 * Multi-Client Start/Stop Sync Test
 * Tests that rapid start/stop from different clients stays in sync.
 */
import { io } from 'socket.io-client';

const WS_URL = 'wss://api.metronomdeul.site';
const API_URL = 'https://api.metronomdeul.site';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function connectClient(name, roomUuid) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      query: { roomUuid, userId: `test-${name}-${Date.now()}` },
      transports: ['websocket'],
      reconnection: false,
    });
    let initialState = null;
    const stateLog = [];

    socket.once('initialState', (d) => { initialState = d; });
    socket.on('metronomeState', (d) => {
      stateLog.push({
        time: Date.now(),
        event: 'metronomeState',
        isPlaying: d.isPlaying,
        tempo: d.tempo,
      });
    });
    socket.on('beatSync', (d) => {
      stateLog.push({
        time: Date.now(),
        event: 'beatSync',
        currentBeat: d.currentBeat,
      });
    });

    const timer = setTimeout(() => { socket.disconnect(); reject(new Error(`${name}: timeout`)); }, 8000);
    socket.on('connect', () => {
      clearTimeout(timer);
      const check = () => {
        if (initialState) resolve({ socket, name, stateLog, initialState });
        else setTimeout(check, 50);
      };
      setTimeout(check, 50);
    });
    socket.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function getPlayState(stateLog) {
  const last = [...stateLog].reverse().find(e => e.event === 'metronomeState');
  return last ? last.isPlaying : null;
}

async function run() {
  console.log('=== Multi-Client Start/Stop Sync Test ===\n');

  // Create room
  const res = await fetch(`${API_URL}/room`, { method: 'POST' });
  const { uuid } = await res.json();
  console.log(`Room: ${uuid}\n`);

  // Connect 3 clients
  const [a, b, c] = await Promise.all([
    connectClient('A', uuid),
    connectClient('B', uuid),
    connectClient('C', uuid),
  ]);
  console.log('All 3 clients connected.\n');

  let testNum = 0;
  const results = [];

  const checkSync = async (label, expectedPlaying) => {
    testNum++;
    await sleep(300); // Allow messages to propagate

    const states = [
      { name: 'A', playing: getPlayState(a.stateLog) },
      { name: 'B', playing: getPlayState(b.stateLog) },
      { name: 'C', playing: getPlayState(c.stateLog) },
    ];

    const allMatch = states.every(s => s.playing === expectedPlaying);
    const icon = allMatch ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const detail = states.map(s => `${s.name}=${s.playing}`).join(', ');
    console.log(`  ${icon} ${testNum}. ${label} → expected=${expectedPlaying} | ${detail}`);
    results.push({ label, pass: allMatch });
  };

  // Test 1: A starts
  console.log('--- Scenario 1: Basic start/stop from different clients ---');
  a.socket.emit('startMetronome', { tempo: 120, beats: 4 });
  await checkSync('A starts', true);

  // Test 2: B stops
  b.socket.emit('stopMetronome');
  await checkSync('B stops', false);

  // Test 3: C starts
  c.socket.emit('startMetronome', { tempo: 120, beats: 4 });
  await checkSync('C starts', true);

  // Test 4: A stops
  a.socket.emit('stopMetronome');
  await checkSync('A stops', false);

  // Test 5-8: Rapid fire
  console.log('\n--- Scenario 2: Rapid start/stop ---');
  a.stateLog.length = 0;
  b.stateLog.length = 0;
  c.stateLog.length = 0;

  a.socket.emit('startMetronome', { tempo: 186, beats: 4 });
  await sleep(500);
  b.socket.emit('stopMetronome');
  await checkSync('A start → B stop (500ms)', false);

  c.socket.emit('startMetronome', { tempo: 186, beats: 4 });
  await sleep(200);
  a.socket.emit('stopMetronome');
  await checkSync('C start → A stop (200ms)', false);

  b.socket.emit('startMetronome', { tempo: 186, beats: 4 });
  await sleep(100);
  c.socket.emit('stopMetronome');
  await checkSync('B start → C stop (100ms)', false);

  // Final: start and let it play, verify all are playing
  a.socket.emit('startMetronome', { tempo: 120, beats: 4 });
  await sleep(2000);

  // Collect beat data
  const aBeats = a.stateLog.filter(e => e.event === 'beatSync').length;
  const bBeats = b.stateLog.filter(e => e.event === 'beatSync').length;
  const cBeats = c.stateLog.filter(e => e.event === 'beatSync').length;
  console.log(`\n--- Beat sync check (2s at 120BPM, expected ~4) ---`);
  console.log(`  A: ${aBeats} beats, B: ${bBeats} beats, C: ${cBeats} beats`);

  const allPlaying = getPlayState(a.stateLog) === true &&
    getPlayState(b.stateLog) === true &&
    getPlayState(c.stateLog) === true;
  const beatOk = aBeats >= 3 && bBeats >= 3 && cBeats >= 3;

  testNum++;
  const icon2 = (allPlaying && beatOk) ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon2} ${testNum}. Final: all playing and receiving beats`);
  results.push({ label: 'Final sync', pass: allPlaying && beatOk });

  // Stop and cleanup
  a.socket.emit('stopMetronome');
  await sleep(300);
  a.socket.disconnect();
  b.socket.disconnect();
  c.socket.disconnect();

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failures:');
    results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.label}`));
  }
  console.log('='.repeat(50));

  // Server logs
  console.log(`\nServer logs:`);
  console.log(`  ssh -i ~/.ssh/metronomdeul.pem ubuntu@ec2-13-209-112-19.ap-northeast-2.compute.amazonaws.com "docker logs metronomdeul-server --tail=30 2>&1 | grep '${uuid}'"`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
