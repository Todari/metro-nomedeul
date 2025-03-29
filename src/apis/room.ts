import { http } from "../utils/http";
import { Room } from "../types/model";
import { CONFIG } from "./config";

type CreateRoomResponse = Room;

export const createRoom = async () => {
  return await http.post<undefined, CreateRoomResponse>(`${CONFIG.API_URL}/room`);
};


