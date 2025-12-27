/**
 * Global Socket Instance - Auto-Detect IP
 * 
 * This provides a single socket connection that all components can use
 * instead of creating their own socket connections.
 * 
 * USAGE: import { getGlobalSocket } from '../utils/globalSocket';
 */

import { io } from "socket.io-client";
import { getApiUrl } from './apiConfig.js';

let globalSocket = null;

export function getGlobalSocket() {
  if (typeof window === 'undefined') {
    return null; // No socket during SSR/build
  }

  if (!globalSocket) {
    try {
      const apiUrl = getApiUrl();
      
      // Convert HTTP/HTTPS to WS/WSS
      const socketUrl = apiUrl.replace(/^http/, 'ws');

      console.log('🔌 Connecting to Socket.IO:', socketUrl);
      globalSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        timeout: 60000,
        pingInterval: 30000,
        pingTimeout: 25000,
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
        console.warn('⚠️ Socket.IO unavailable, app will use polling for updates');
      });

      globalSocket.on('reconnect_failed', () => {
        console.warn('⚠️ Socket.IO reconnection failed permanently, using polling mode');
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