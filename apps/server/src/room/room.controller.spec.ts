import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

const mockRoomService = {
  createRoom: jest.fn(),
  getRoom: jest.fn(),
};

describe('RoomController', () => {
  let controller: RoomController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [{ provide: RoomService, useValue: mockRoomService }],
    }).compile();

    controller = module.get<RoomController>(RoomController);
    jest.clearAllMocks();
  });

  describe('POST /room', () => {
    it('should create a room and return uuid', async () => {
      mockRoomService.createRoom.mockResolvedValue({ uuid: 'abcd1234' });

      const result = await controller.createRoom();

      expect(result).toEqual({ uuid: 'abcd1234' });
      expect(mockRoomService.createRoom).toHaveBeenCalled();
    });
  });

  describe('GET /room/:uuid', () => {
    it('should return room for valid uuid', async () => {
      const mockRoom = {
        id: 'cuid123',
        roomId: 'abcd1234',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRoomService.getRoom.mockResolvedValue(mockRoom);

      const result = await controller.getRoom('abcd1234');

      expect(result).toEqual(mockRoom);
    });

    it('should throw BadRequestException for invalid uuid format', async () => {
      await expect(controller.getRoom('short')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getRoom('toolongvalue!!')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRoomService.getRoom).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when room not found', async () => {
      mockRoomService.getRoom.mockRejectedValue(
        new NotFoundException('Room not found'),
      );

      await expect(controller.getRoom('notfnd12')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
