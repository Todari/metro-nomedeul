import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MetronomeService } from './metronome.service';
import { RoomService } from '../room/room.service';
import {
  WS_EVENTS,
  TimeSyncRequest,
  TimeSyncResponse,
  MIN_TEMPO,
  MAX_TEMPO,
  MIN_BEATS,
  MAX_BEATS,
} from '@metro-nomedeul/shared';

const MAX_CLIENTS_PER_ROOM = 20;
const EMPTY_ROOM_GRACE_MS = 10_000;

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  [WS_EVENTS.START_METRONOME]: { max: 10, windowMs: 1000 },
  [WS_EVENTS.STOP_METRONOME]: { max: 10, windowMs: 1000 },
  [WS_EVENTS.CHANGE_TEMPO]: { max: 20, windowMs: 1000 },
  [WS_EVENTS.CHANGE_BEATS]: { max: 10, windowMs: 1000 },
  [WS_EVENTS.REQUEST_SYNC]: { max: 5, windowMs: 1000 },
  [WS_EVENTS.TIME_SYNC_REQUEST]: { max: 30, windowMs: 1000 },
};

interface RateBucket {
  tokens: number;
  lastRefill: number;
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
      const allowedOrigins = allowedOrigin.split(',').map((o) => o.trim());
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  pingInterval: 30000,
  pingTimeout: 60000,
})
export class MetronomeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(MetronomeGateway.name);

  @WebSocketServer()
  server!: Server;

  private clientRooms = new Map<string, string>();
  private pendingCleanup = new Map<string, ReturnType<typeof setTimeout>>();

  onModuleDestroy() {
    this.logger.log(
      'Gateway shutting down — notifying clients and clearing pending cleanup',
    );
    for (const timer of this.pendingCleanup.values()) {
      clearTimeout(timer);
    }
    this.pendingCleanup.clear();

    if (this.server) {
      // Best-effort shutdown notice so clients can display a reconnect banner.
      this.server.emit(WS_EVENTS.SERVER_SHUTDOWN, { reconnectExpected: true });
    }
  }

  constructor(
    private readonly metronomeService: MetronomeService,
    private readonly roomService: RoomService,
  ) {}

  afterInit(server: Server) {
    this.metronomeService.setServer(server);
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const rawRoomUuid = client.handshake.query['roomUuid'];
    const rawUserId = client.handshake.query['userId'];
    const roomUuid = Array.isArray(rawRoomUuid) ? rawRoomUuid[0] : rawRoomUuid;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!roomUuid) {
      this.logger.warn(`Client ${client.id} connected without roomUuid`);
      client.disconnect();
      return;
    }

    // Validate room exists in DB
    try {
      await this.roomService.getRoom(roomUuid);
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} failed to join room ${roomUuid}: ${error instanceof Error ? error.message : error}`,
      );
      client.emit('error', { message: 'Room not found' });
      client.disconnect();
      return;
    }

    // Check room capacity
    const roomClients = this.server.sockets.adapter.rooms.get(roomUuid);
    if (roomClients && roomClients.size >= MAX_CLIENTS_PER_ROOM) {
      this.logger.warn(
        `Room ${roomUuid} is full (${roomClients.size}/${MAX_CLIENTS_PER_ROOM})`,
      );
      client.emit('error', { message: 'Room is full' });
      client.disconnect();
      return;
    }

    client.join(roomUuid);
    this.clientRooms.set(client.id, roomUuid);

    // Cancel any pending cleanup — someone rejoined before the grace window expired
    const pending = this.pendingCleanup.get(roomUuid);
    if (pending) {
      clearTimeout(pending);
      this.pendingCleanup.delete(roomUuid);
    }

    this.logger.log(
      `Client connected: ${userId || client.id} (room: ${roomUuid})`,
    );

    this.metronomeService.sendInitialState(client, roomUuid);
  }

  handleDisconnect(client: Socket) {
    const roomUuid = this.clientRooms.get(client.id);
    this.clientRooms.delete(client.id);

    if (!roomUuid) return;

    this.logger.log(`Client disconnected: ${client.id} (room: ${roomUuid})`);

    const roomClients = this.server.sockets.adapter.rooms.get(roomUuid);
    if (roomClients && roomClients.size > 0) return;

    // Room is empty — give a short grace window for transient network hiccups
    // (mobile switching wifi↔cell, tunnels, etc.) before tearing down state.
    const existing = this.pendingCleanup.get(roomUuid);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pendingCleanup.delete(roomUuid);
      const latest = this.server.sockets.adapter.rooms.get(roomUuid);
      if (!latest || latest.size === 0) {
        this.metronomeService.cleanupRoom(roomUuid);
      }
    }, EMPTY_ROOM_GRACE_MS);
    this.pendingCleanup.set(roomUuid, timer);
  }

  private clampTempo(tempo: number): number {
    return Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(tempo)));
  }

  private clampBeats(beats: number): number {
    return Math.max(MIN_BEATS, Math.min(MAX_BEATS, Math.round(beats)));
  }

  private allowEvent(client: Socket, event: string): boolean {
    const limit = RATE_LIMITS[event];
    if (!limit) return true;

    const data = client.data as { rateBuckets?: Record<string, RateBucket> };
    if (!data.rateBuckets) data.rateBuckets = {};
    const buckets = data.rateBuckets;

    const now = Date.now();
    const bucket = buckets[event] ?? { tokens: limit.max, lastRefill: now };
    const elapsed = now - bucket.lastRefill;
    const refill = (elapsed / limit.windowMs) * limit.max;
    bucket.tokens = Math.min(limit.max, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      buckets[event] = bucket;
      this.logger.warn(
        `Rate limit exceeded: client=${client.id} event=${event}`,
      );
      return false;
    }

    bucket.tokens -= 1;
    buckets[event] = bucket;
    return true;
  }

  @SubscribeMessage(WS_EVENTS.START_METRONOME)
  handleStartMetronome(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tempo?: number; beats?: number },
  ) {
    if (!this.allowEvent(client, WS_EVENTS.START_METRONOME)) return;
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    const tempo =
      typeof data?.tempo === 'number' ? this.clampTempo(data.tempo) : undefined;
    const beats =
      typeof data?.beats === 'number' ? this.clampBeats(data.beats) : undefined;
    this.metronomeService.startMetronome(roomUuid, tempo, beats);
  }

  @SubscribeMessage(WS_EVENTS.STOP_METRONOME)
  handleStopMetronome(@ConnectedSocket() client: Socket) {
    if (!this.allowEvent(client, WS_EVENTS.STOP_METRONOME)) return;
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    this.metronomeService.stopMetronome(roomUuid);
  }

  @SubscribeMessage(WS_EVENTS.CHANGE_TEMPO)
  handleChangeTempo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tempo: number },
  ) {
    if (!this.allowEvent(client, WS_EVENTS.CHANGE_TEMPO)) return;
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    if (!data?.tempo || typeof data.tempo !== 'number') return;
    this.metronomeService.changeTempo(roomUuid, this.clampTempo(data.tempo));
  }

  @SubscribeMessage(WS_EVENTS.CHANGE_BEATS)
  handleChangeBeats(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { beats: number },
  ) {
    if (!this.allowEvent(client, WS_EVENTS.CHANGE_BEATS)) return;
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    if (!data?.beats || typeof data.beats !== 'number') return;
    this.metronomeService.changeBeats(roomUuid, this.clampBeats(data.beats));
  }

  @SubscribeMessage(WS_EVENTS.REQUEST_SYNC)
  handleRequestSync(@ConnectedSocket() client: Socket) {
    if (!this.allowEvent(client, WS_EVENTS.REQUEST_SYNC)) return;
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    this.metronomeService.requestSync(roomUuid);
  }

  @SubscribeMessage(WS_EVENTS.TIME_SYNC_REQUEST)
  handleTimeSyncRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TimeSyncRequest,
  ) {
    if (!this.allowEvent(client, WS_EVENTS.TIME_SYNC_REQUEST)) return;
    if (!data?.clientSendTime || typeof data.clientSendTime !== 'number') return;
    const response: TimeSyncResponse = {
      clientSendTime: data.clientSendTime,
      serverTime: Date.now(),
    };
    client.emit(WS_EVENTS.TIME_SYNC_RESPONSE, response);
  }
}
