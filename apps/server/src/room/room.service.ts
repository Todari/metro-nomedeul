import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

const ROOM_TTL_HOURS = 24;

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRoom() {
    const roomId = nanoid(8);

    const room = await this.prisma.room.create({
      data: { roomId },
    });

    return { uuid: room.roomId };
  }

  async getRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { roomId },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredRooms() {
    const cutoff = new Date(Date.now() - ROOM_TTL_HOURS * 60 * 60 * 1000);

    const result = await this.prisma.room.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired rooms (older than ${ROOM_TTL_HOURS}h)`);
    }
  }
}
