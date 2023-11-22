import { Server, Socket } from 'socket.io';

import { Server as HTTPServer } from 'http';
import _ from 'lodash';
import configs from '$config';
import log from './log';
import { verify } from 'jsonwebtoken';

const logger = log('Socket');

// Các loại role người dùng sử dụng socket
enum RoleType {
  Admin = 'Admin',
  //...
}
// Các loại người dùng trong hệ thống, kèm theo access token secret
const RoleSecret = {
  [RoleType.Admin]: configs.auth.AccessTokenSecret,
  //...
};

interface AuthenticatedSocket extends Socket {
  _client: OnlineClient;
  _role: RoleType;
  _authData: {
    id: number;
    [key: string]: any;
    nickname?: string;
    avatar?: string;
  };
}

interface OnlineClient {
  id: number;
  role: RoleType;
  sockets: Array<string>;
}

class SocketManager {
  private io: Server;
  private onlineClients: OnlineClient[] = [];

  init(http: HTTPServer) {
    this.io = new Server(http, { cors: { origin: '*' }, pingInterval: 3000, pingTimeout: 3000 });
    logger.info('Socket started');

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      socket.removeAllListeners();

      logger.info(`Socket connected: ${socket.id}`);

      socket.on('authenticate', ({ role, token }) => {
        const secret = RoleSecret[role];
        verify(token, secret, (err: any, decoded: any) => {
          if (err) {
            logger.warn(
              `Socket authenticated fail: ${socket.id}, role: ${role}, id: ${decoded?.id}`
            );
            return socket.emit('unauthenticated');
          }
          logger.info(
            `Socket authenticate success: ${socket.id}, role: ${role}, id: ${decoded?.id}`
          );
          socket._role = role;
          socket._authData = decoded;
          socket.emit('authenticated', decoded);
          this.handleSocketOnline(socket);
        });
      });
      socket.on('disconnect', () => {
        this.handleSocketOffline(socket);
      });
    });
  }
  private getClientBySocket(socket: AuthenticatedSocket) {
    if (socket._client) return socket._client;
    const authData = socket._authData;
    const role = socket._role;

    const client = this.onlineClients.find(
      (item) => item.id === authData?.id && item.role === role
    );
    socket._client = client;
    return client;
  }

  private handleSocketOnline = (socket: AuthenticatedSocket) => {
    const client = this.getClientBySocket(socket);
    if (client) {
      client.sockets = _.uniq([...client.sockets, socket.id]);
    } else {
      this.onlineClients.push({
        id: socket._authData?.id,
        role: socket._role,
        sockets: [socket.id],
      });
    }
    socket.join(socket._role);
    socket.join(`${socket._role}_${socket._authData?.id}`);
  };

  private handleSocketOffline(socket: AuthenticatedSocket) {
    logger.warn(
      `Socket offline: ${socket.id}, role: ${socket._role}, id: ${socket?._authData?.id}`
    );
    if (!socket._authData) return;
    const client = this.getClientBySocket(socket);
    if (client) {
      client.sockets = client.sockets.filter((item) => item !== socket.id);
    }
    this.onlineClients = this.onlineClients?.filter((x) => !!x.sockets?.length);
    socket.leave(socket._role);
    socket.leave(`${socket._role}_${socket?._authData?.id}`);
    delete socket._authData;
    delete socket._role;
    delete socket._client;
  }

  emitToAdmin(event: string, data?: any) {
    this?.io?.to(`${RoleType.Admin}`)?.emit(event, data);
  }
}

const socketManager = new SocketManager();
export default socketManager;
