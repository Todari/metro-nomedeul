/**
 * Isolated room-capacity test — verify 21st connection is rejected.
 */
import { io } from 'socket.io-client';

const API_URL = 'https://api.metronomdeul.site';
const WS_URL = 'wss://api.metronomdeul.site';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(roomUuid, name) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      query: { roomUuid, userId: `cap-${name}-${Date.now()}` },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    let initial = null;
    let resolved = false;
    socket.once('initialState', (d) => (initial = d));
    const t = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      socket.disconnect();
      reject(new Error(`${name}: timeout`));
    }, 8000);
    socket.on('connect', () => {
      let tries = 0;
      const wait = () => {
        if (resolved) return;
        if (initial) {
          resolved = true;
          clearTimeout(t);
          resolve({ socket, name });
          return;
        }
        if (tries++ > 40) {
          resolved = true;
          clearTimeout(t);
          socket.disconnect();
          reject(new Error(`${name}: no initialState`));
          return;
        }
        setTimeout(wait, 50);
      };
      setTimeout(wait, 50);
    });
    socket.on('connect_error', (e) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(t);
      reject(e);
    });
    socket.on('disconnect', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(t);
      reject(new Error(`${name}: disconnected`));
    });
    socket.on('error', (data) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(t);
      socket.disconnect();
      reject(new Error(`${name}: server error: ${JSON.stringify(data)}`));
    });
  });
}

async function run() {
  console.log('=== Room capacity test ===');
  const res = await fetch(`${API_URL}/room`, { method: 'POST' });
  const { uuid } = await res.json();
  console.log('room:', uuid);

  const clients = [];
  for (let i = 0; i < 20; i++) {
    const c = await connect(uuid, `${i}`);
    clients.push(c);
  }
  console.log(`connected: ${clients.length}`);

  // 21st — expect rejection
  let rejectedWithExpected = false;
  let rejectReason = '';
  try {
    const overflow = await connect(uuid, 'overflow');
    console.log('UNEXPECTED: 21st client accepted');
    overflow.socket.disconnect();
  } catch (e) {
    rejectedWithExpected = /Room is full|disconnected|server error/.test(e.message);
    rejectReason = e.message;
  }

  const icon = rejectedWithExpected ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} 21st connection rejected — ${rejectReason}`);

  clients.forEach((c) => c.socket.disconnect());
  process.exit(rejectedWithExpected ? 0 : 1);
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
