import { http } from "../utils/http";
import { CONFIG } from "./config";

export interface CreateRoomResponse {
  uuid: string;
}

export const createRoom = async () => {
  return await http.post<undefined, CreateRoomResponse>(`${CONFIG.API_URL}/room`);
};


