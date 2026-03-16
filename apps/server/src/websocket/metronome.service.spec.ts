import { Test, TestingModule } from '@nestjs/testing';
import { MetronomeService } from './metronome.service';
import { WS_EVENTS } from '@metro-nomedeul/shared';

const createMockSocket = () => ({
  id: 'client-1',
  emit: jest.fn(),
});

const createMockServer = () => {
  const emitMock = jest.fn();
  const toMock = jest.fn().mockReturnValue({ emit: emitMock });
  return {
    to: toMock,
    _emit: emitMock,
  };
};

describe('MetronomeService', () => {
  let service: MetronomeService;
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetronomeService],
    }).compile();

    service = module.get<MetronomeService>(MetronomeService);
    mockServer = createMockServer();
    service.setServer(mockServer as any);
    jest.clearAllMocks();
  });

  describe('sendInitialState', () => {
    it('should send default state when room has no state', () => {
      const client = createMockSocket() as any;

      service.sendInitialState(client, 'room-1');

      expect(client.emit).toHaveBeenCalledWith(
        WS_EVENTS.INITIAL_STATE,
        expect.objectContaining({
          isPlaying: false,
          tempo: 120,
          beats: 4,
          startTime: 0,
          roomUuid: 'room-1',
          type: 'initialState',
        }),
      );
    });

    it('should send existing state as initialState when room has state', () => {
      const client = createMockSocket() as any;
      service.startMetronome('room-1', 140, 3);

      service.sendInitialState(client, 'room-1');

      expect(client.emit).toHaveBeenCalledWith(
        WS_EVENTS.INITIAL_STATE,
        expect.objectContaining({
          isPlaying: true,
          tempo: 140,
          beats: 3,
          roomUuid: 'room-1',
          type: 'initialState',
        }),
      );
    });
  });

  describe('startMetronome', () => {
    it('should save state, broadcast, and start timers', () => {
      service.startMetronome('room-1', 120, 4);

      expect(service.getState('room-1')).toMatchObject({
        isPlaying: true,
        tempo: 120,
        beats: 4,
        roomUuid: 'room-1',
      });
      expect(mockServer.to).toHaveBeenCalledWith('room-1');
    });
  });

  describe('stopMetronome', () => {
    it('should set isPlaying false and broadcast', () => {
      service.startMetronome('room-1', 120, 4);
      service.stopMetronome('room-1');

      expect(service.getState('room-1')).toMatchObject({
        isPlaying: false,
        tempo: 120,
      });
      expect(mockServer.to).toHaveBeenCalledWith('room-1');
    });

    it('should do nothing when room has no state', () => {
      service.stopMetronome('nonexistent');
      expect(mockServer.to).not.toHaveBeenCalled();
    });
  });

  describe('changeTempo', () => {
    it('should update tempo and broadcast', () => {
      service.startMetronome('room-1', 120, 4);
      service.stopMetronome('room-1');
      service.changeTempo('room-1', 140);

      expect(service.getState('room-1')).toMatchObject({
        tempo: 140,
      });
    });

    it('should stop if playing before changing tempo', () => {
      service.startMetronome('room-1', 120, 4);
      service.changeTempo('room-1', 140);

      expect(service.getState('room-1')).toMatchObject({
        isPlaying: false,
        tempo: 140,
      });
    });
  });

  describe('changeBeats', () => {
    it('should update beats and broadcast', () => {
      service.startMetronome('room-1', 120, 4);
      service.stopMetronome('room-1');
      service.changeBeats('room-1', 6);

      expect(service.getState('room-1')).toMatchObject({
        beats: 6,
      });
    });

    it('should stop if playing before changing beats', () => {
      service.startMetronome('room-1', 120, 4);
      service.changeBeats('room-1', 6);

      expect(service.getState('room-1')).toMatchObject({
        isPlaying: false,
        beats: 6,
      });
    });
  });

  describe('requestSync', () => {
    it('should broadcast current state', () => {
      service.startMetronome('room-1', 120, 4);
      service.requestSync('room-1');

      expect(mockServer.to).toHaveBeenCalledWith('room-1');
    });
  });

  describe('cleanupRoom', () => {
    it('should remove state and stop timers', () => {
      service.startMetronome('room-1', 120, 4);
      service.cleanupRoom('room-1');

      expect(service.getState('room-1')).toBeUndefined();
    });
  });

  describe('beatSync timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should emit beatSync at beat interval', () => {
      service.startMetronome('room-1', 120, 4);
      mockServer._emit.mockClear();

      jest.advanceTimersByTime(500);

      expect(mockServer._emit).toHaveBeenCalledWith(
        WS_EVENTS.BEAT_SYNC,
        expect.objectContaining({
          type: 'beatSync',
          roomUuid: 'room-1',
        }),
      );
    });
  });
});
