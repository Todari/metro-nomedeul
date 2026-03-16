import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RoomService } from './room.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  room: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
    jest.clearAllMocks();
  });

  describe('createRoom', () => {
    it('should create a room and return uuid', async () => {
      mockPrisma.room.create.mockResolvedValue({
        id: 'cuid123',
        roomId: 'abcd1234',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createRoom();

      expect(result).toHaveProperty('uuid');
      expect(typeof result.uuid).toBe('string');
      expect(result.uuid).toHaveLength(8);
      expect(mockPrisma.room.create).toHaveBeenCalledWith({
        data: { roomId: expect.any(String) },
      });
    });
  });

  describe('getRoom', () => {
    it('should return room when found', async () => {
      const mockRoom = {
        id: 'cuid123',
        roomId: 'abcd1234',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.room.findUnique.mockResolvedValue(mockRoom);

      const result = await service.getRoom('abcd1234');

      expect(result).toEqual(mockRoom);
      expect(mockPrisma.room.findUnique).toHaveBeenCalledWith({
        where: { roomId: 'abcd1234' },
      });
    });

    it('should throw NotFoundException when room not found', async () => {
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(service.getRoom('notfound')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
