/**
 * Global Socket Instance - Auto-Detect IP
 * 
 * This provides a single socket connection that all components can use
 * instead of creating their own socket connections.
 * 
 * USAGE: import { getGlobalSocket } from '../utils/globalSocket';
 */

import { io } from "socket.io-client";

let globalSocket = null;

export function getGlobalSocket() {
  if (typeof window === 'undefined') {
    return null; // No socket during SSR/build
  }

  if (!globalSocket) {
    try {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol;
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';

      // Auto-detect IP for mobile/network access
      let socketUrl;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        socketUrl = 'ws://localhost:5000';
      } else {
        socketUrl = `${wsProtocol}//${hostname}:5000`;
      }

      console.log('🔌 Connecting to Socket.IO:', socketUrl);
      globalSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });

      globalSocket.on('connect', () => {
        console.log('⚡ Socket connected:', globalSocket.id);
      });

      globalSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
      });

      globalSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });

    } catch (error) {
      console.error('❌ Failed to initialize socket:', error);
      return null;
    }
  }

  return globalSocket;
}

// Reset function for development
export function resetGlobalSocket() {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
    console.log('🔄 Global socket reset');
  }
}

export default getGlobalSocket;