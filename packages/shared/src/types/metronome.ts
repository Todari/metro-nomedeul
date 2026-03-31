export interface MetronomeState {
  isPlaying: boolean;
  tempo: number;
  beats: number;
  currentBeat: number;
  startTime: number;
  serverTime: number;
  roomUuid: string;
  type: MetronomeMessageType;
}

export interface TimeSyncRequest {
  clientSendTime: number;
}

export interface TimeSyncResponse {
  clientSendTime: number;
  serverTime: number;
}

export type MetronomeMessageType =
  | 'metronomeState'
  | 'beatSync'
  | 'initialState';

export interface MetronomeAction {
  action: MetronomeActionType;
  tempo?: number;
  beats?: number;
}

export type MetronomeActionType =
  | 'startMetronome'
  | 'stopMetronome'
  | 'changeTempo'
  | 'changeBeats'
  | 'requestSync';

export const DEFAULT_TEMPO = 120;
export const DEFAULT_BEATS = 4;
export const MIN_TEMPO = 40;
export const MAX_TEMPO = 240;
export const MIN_BEATS = 2;
export const MAX_BEATS = 8;
