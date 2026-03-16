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
import { ConfigService } from '@nestjs/config';
import { MetronomeService } from './metronome.service';
import { WS_EVENTS } from '@metro-nomedeul/shared';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, true);
    },
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
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.metronomeService.setServer(server);
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const roomUuid = client.handshake.query['roomUuid'] as string;
    const userId = client.handshake.query['userId'] as string;

    if (!roomUuid) {
      this.logger.warn(`Client ${client.id} connected without roomUuid`);
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

  @SubscribeMessage(WS_EVENTS.START_METRONOME)
  handleStartMetronome(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tempo?: number; beats?: number },
  ) {
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    const tempo = data?.tempo ?? 120;
    const beats = data?.beats ?? 4;
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

    this.metronomeService.changeTempo(roomUuid, data.tempo);
  }

  @SubscribeMessage(WS_EVENTS.CHANGE_BEATS)
  handleChangeBeats(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { beats: number },
  ) {
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    this.metronomeService.changeBeats(roomUuid, data.beats);
  }

  @SubscribeMessage(WS_EVENTS.REQUEST_SYNC)
  handleRequestSync(@ConnectedSocket() client: Socket) {
    const roomUuid = this.clientRooms.get(client.id);
    if (!roomUuid) return;

    this.metronomeService.requestSync(roomUuid);
  }
}
