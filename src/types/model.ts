export interface Room {
  id: string;
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetronomeState {
  isPlaying: boolean;
  tempo: number;
  startTime: number;
  serverTime: number;
  roomUuid: string;
}
