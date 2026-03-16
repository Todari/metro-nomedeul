export interface Room {
  id: string;
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetronomeState {
  isPlaying: boolean;
  tempo: number;
  beats: number;
  startTime: number;
  serverTime: number;
  roomUuid: string;
  type: string;
}
