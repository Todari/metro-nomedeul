import { http } from '../utils/http';
import { CONFIG } from './config';

export interface CreateRoomResponse {
  uuid: string;
}

export interface GetRoomResponse {
  roomId: string;
}

export const createRoom = async () => {
  return await http.post<undefined, CreateRoomResponse>(
    `${CONFIG.API_URL}/room`,
  );
};

export const getRoom = async (uuid: string) => {
  return await http.get<GetRoomResponse>(`${CONFIG.API_URL}/room/${uuid}`);
};
