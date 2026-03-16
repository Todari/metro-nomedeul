import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class RoomService {
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
}
