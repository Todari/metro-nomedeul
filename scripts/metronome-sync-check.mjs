/**
 * 재생을 누른 사람의 첫 박이 서버 박자 기준과 어긋나 튀지 않는지, iOS처럼 resume()이
 * 끝나지 않아도 start()가 풀려 재생 버튼이 먹통이 되지 않는지 검사한다.
 * 서버·브라우저 없이 가상 시계와 가짜 AudioContext로 실제 클라이언트 Metronome을 돌린다.
 *
 *   node --experimental-strip-types --no-warnings scripts/metronome-sync-check.mjs
 */
import assert from 'node:assert/strict';

let T = 1_000_000; // 로컬 벽시계(ms)
let queue = [];
let seq = 0;
const at = (time, cb) => (queue.push({ time, id: ++seq, cb }), seq);
const realNow = Date.now;
Date.now = () => Math.floor(T);
globalThis.window = globalThis;
globalThis.requestAnimationFrame = (cb) => at(T + 16.67, cb);
globalThis.cancelAnimationFrame = (id) => {
  queue = queue.filter((q) => q.id !== id);
};

const clicks = []; // 클릭이 실제로 날 로컬 시각(ms)
globalThis.AudioContext = class {
  created = T;
  state = 'running';
  sampleRate = 48000;
  destination = {};
  get currentTime() {
    return (T - this.created) / 1000;
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createOscillator() {
    const created = this.created;
    return {
      frequency: { setValueAtTime() {} },
      connect() {},
      stop() {},
      start(when) {
        if (when > 0) clicks.push(created + when * 1000);
      },
    };
  }
  createGain() {
    const noop = () => {};
    return {
      gain: { setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop },
      connect: noop,
    };
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { connect() {}, start() {} };
  }
};

const { Metronome } = await import('../apps/client/src/utils/metronome.ts');

const SPB = 500; // 120 BPM
const OFFSET = 37; // 서버 시계 - 로컬 시계
const UP = 40; // 업로드 지연
const DOWN = 30; // 다운로드 지연

const m = new Metronome();
m.setClockOffsetRef({ current: OFFSET });
m.primeAudioContextSync();

// useMetronome.startMetronome: 로컬에서 먼저 시작하고 실제 시작 시각을 서버 시계로 보낸다
const localStart = await m.start();
const received = T + UP + OFFSET; // 서버가 START를 받은 시각(서버 시계)
const proposed = typeof localStart === 'number' ? localStart + OFFSET : NaN;
// MetronomeService.startMetronome: 1초 이내로 어긋난 제안값만 박자 기준으로 채택
const startTime = Math.abs(proposed - received) <= 1000 ? proposed : received;

const state = (type, serverTime) => ({
  type,
  isPlaying: true,
  tempo: 60_000 / SPB,
  beats: 4,
  currentBeat: 0,
  startTime,
  serverTime,
  roomUuid: 'room',
});
const deliver = (serverTime, msg) =>
  at(serverTime - OFFSET + DOWN, () => m.handleServerState(msg));

deliver(received, state('metronomeState', received));
for (let k = 0; k < 8; k++) deliver(received + k * SPB, state('beatSync', received + k * SPB));

const end = T + 3000;
for (;;) {
  queue.sort((a, b) => a.time - b.time || a.id - b.id);
  if (!queue.length || queue[0].time > end) break;
  const { time, cb } = queue.shift();
  T = Math.max(T, time);
  await cb();
  await new Promise((resolve) => setImmediate(resolve));
}
m.destroy();

const grid0 = startTime - OFFSET; // 서버 박자 기준을 로컬 시계로 환산
const offsets = clicks.map((t) => +(t - grid0).toFixed(1));
assert.ok(clicks.length >= 6, `클릭이 ${clicks.length}개뿐: ${offsets.join(', ')}`);
clicks.forEach((t, i) => {
  const beat = Math.round((t - grid0) / SPB);
  assert.ok(beat === i, `박이 빠지거나 겹침: ${offsets.join(', ')}`);
  assert.ok(Math.abs(t - grid0 - beat * SPB) <= 2, `서버 박자와 어긋남: ${offsets.join(', ')}`);
});
console.log(`ok: 첫 박부터 ${clicks.length}박 모두 서버 박자 기준 ±2ms (${offsets.join(', ')})`);

// iOS는 제스처 밖에서 부른 resume()을 끝내지 않을 수 있다. 그래도 start()는 풀려야 한다.
// 안 풀리면 isStarting이 고착돼 재생 버튼이 새로고침 전까지 먹통이 된다.
Date.now = realNow;
const hung = new Metronome();
hung.primeAudioContextSync();
hung.audioContext.state = 'suspended';
hung.audioContext.resume = () => new Promise(() => {});
const settled = await Promise.race([
  hung.start().then(() => 'settled'),
  new Promise((resolve) => setTimeout(() => resolve('hung'), 6000)),
]);
assert.equal(settled, 'settled', 'resume()이 끝나지 않을 때 start()가 영원히 멈춤');
assert.equal(hung.isStarting, false, 'isStarting 고착');
hung.destroy();
console.log('ok: resume()이 끝나지 않아도 start()가 풀림');
