import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, getSocketUrl } from '@/lib/constants';

export const socket: Socket = io(getSocketUrl() || SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export function connect(token: string, roomId?: string): void {
  const targetUrl = getSocketUrl();
  if (targetUrl && (socket.io as any)?.uri !== targetUrl) {
    (socket.io as any).uri = targetUrl;
  }
  socket.auth = { token, roomId };
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnect(): void {
  console.log('[SOCKET DISCONNECT BLOCKED]');
}
