export interface Room {
  id: string;
  roomId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoomResponse {
  uuid: string;
}
