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
import { Logger } from '@nestjs/common';
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

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  pingInterval: 30000,
  pingTimeout: 60000,
})
export class MetronomeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MetronomeGateway.name);

  @WebSocketServer()
  server!: Server;

  private clientRooms = new Map<string, string>();

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

    client.join(roomUuid);
    this.clientRooms.set(client.id, roomUuid);

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
    if (!roomClients || roomClients.size === 0) {
      this.metronomeService.cleanupRoom(roomUuid);
    }
  }

  private clampTempo(tempo: number): number {
    return Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(tempo)));
  }

  private clampBeats(beats: number): number {
    return Math.max(MIN_BEATS, Math.min(MAX_BEATS, Math.round(beats)));
  }

  @SubscribeMessage(WS_EVENTS.START_METRONOME)
  handleStartMetronome(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tempo?: number; beats?: number },
  ) {
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    const tempo = this.clampTempo(data?.tempo ?? 120);
    const beats = this.clampBeats(data?.beats ?? 4);
    this.metronomeService.startMetronome(roomUuid, tempo, beats);
  }

  @SubscribeMessage(WS_EVENTS.STOP_METRONOME)
  handleStopMetronome(@ConnectedSocket() client: Socket) {
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    this.metronomeService.stopMetronome(roomUuid);
  }

  @SubscribeMessage(WS_EVENTS.CHANGE_TEMPO)
  handleChangeTempo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tempo: number },
  ) {
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
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    if (!data?.beats || typeof data.beats !== 'number') return;
    this.metronomeService.changeBeats(roomUuid, this.clampBeats(data.beats));
  }

  @SubscribeMessage(WS_EVENTS.REQUEST_SYNC)
  handleRequestSync(@ConnectedSocket() client: Socket) {
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    this.metronomeService.requestSync(roomUuid);
  }

  @SubscribeMessage(WS_EVENTS.TIME_SYNC_REQUEST)
  handleTimeSyncRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TimeSyncRequest,
  ) {
    if (!data?.clientSendTime || typeof data.clientSendTime !== 'number') return;
    const response: TimeSyncResponse = {
      clientSendTime: data.clientSendTime,
      serverTime: Date.now(),
    };
    client.emit(WS_EVENTS.TIME_SYNC_RESPONSE, response);
  }
}
