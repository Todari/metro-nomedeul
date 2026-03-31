export const WS_EVENTS = {
  // Server → Client
  METRONOME_STATE: 'metronomeState',
  BEAT_SYNC: 'beatSync',
  INITIAL_STATE: 'initialState',
  TIME_SYNC_RESPONSE: 'timeSyncResponse',

  // Client → Server
  START_METRONOME: 'startMetronome',
  STOP_METRONOME: 'stopMetronome',
  CHANGE_TEMPO: 'changeTempo',
  CHANGE_BEATS: 'changeBeats',
  REQUEST_SYNC: 'requestSync',
  TIME_SYNC_REQUEST: 'timeSyncRequest',
} as const;

export const WS_CONFIG = {
  PING_INTERVAL_MS: 30_000,
  READ_DEADLINE_MS: 60_000,
  WRITE_TIMEOUT_MS: 10_000,
  GENERAL_SYNC_INTERVAL_MS: 5_000,
} as const;
