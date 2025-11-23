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

  // Socket.IO disabled for debugging - return null to prevent connection attempts
  console.log('🔇 Socket.IO disabled - returning null socket');
  return null;
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