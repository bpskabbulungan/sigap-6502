import { io } from 'socket.io-client';
import { API_BASE_URL } from './apiClient.js';

let socketInstance = null;
let socketFactory = io;

function resolveSocketOrigin(baseUrl = API_BASE_URL) {
  const fallbackHref =
    typeof window !== 'undefined' && window?.location?.href
      ? window.location.href
      : undefined;
  const effectiveBaseUrl = baseUrl || fallbackHref;

  if (!effectiveBaseUrl) {
    throw new Error('Unable to determine socket origin.');
  }

  return new URL(effectiveBaseUrl).origin;
}

export function getSocket() {
  if (socketInstance) return socketInstance;

  // Connect to backend Socket.IO server; keep credentials for session-protected routes
  socketInstance = socketFactory(resolveSocketOrigin(API_BASE_URL), {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socketInstance;
}

export function closeSocket() {
  if (socketInstance) {
    try {
      socketInstance.removeAllListeners();
    } catch {
      // Ignore cleanup errors
    }
    try {
      socketInstance.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    socketInstance = null;
  }
}

export function setSocketFactory(factory) {
  socketFactory = typeof factory === 'function' ? factory : io;
}

export function resetSocketFactory() {
  socketFactory = io;
}

// Exported for testing
export { resolveSocketOrigin };
