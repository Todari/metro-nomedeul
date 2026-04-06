import {
  Controller,
  Post,
  Get,
  Param,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { RoomService } from './room.service';

@Controller('room')
@UseGuards(ThrottlerGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
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
