import {
  Controller,
  Post,
  Get,
  Param,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RoomService } from './room.service';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRoom() {
    return this.roomService.createRoom();
  }

  @Get(':uuid')
  async getRoom(@Param('uuid') uuid: string) {
    if (!/^[A-Za-z0-9_-]{8}$/.test(uuid)) {
      throw new BadRequestException('Invalid room ID format');
    }
    return this.roomService.getRoom(uuid);
  }
}
