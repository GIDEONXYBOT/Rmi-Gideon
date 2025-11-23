/**
 * API URL Configuration with Auto-Detect IP
 * 
 * - Uses current browser hostname (auto-detects IP if accessed via IP)
 * - Backend strict port: 5000
 * - Falls back to VITE_API_URL if set in .env
 * 
 * IMPORTANT: Always use getApiUrl() function, NOT the API_URL constant
 */

// Get API URL based on current hostname - computes fresh each time
export function getApiUrl() {
  if (typeof window === 'undefined') {
    // Server-side rendering or build time - return placeholder
    return 'http://localhost:5000';
  }

  // Use the same hostname as the frontend for API calls
  const envUrl = import.meta.env.VITE_API_URL;

  if (envUrl) {
    return envUrl;
  }

  // Use the current hostname (works for both localhost and IP access)
  const hostname = window.location.hostname;
  return `http://${hostname}:5000`;
}

// Export hostname getter
export const getHost = () => window.location.hostname;

// Socket creation helper using dynamic URL
export function createSocket(io, options = {}) {
  const socketUrl = getApiUrl();
  console.log('🔌 Creating socket with URL:', socketUrl);
  return io(socketUrl, {
    transports: ["websocket", "polling"],
    ...options
  });
}

// BACKWARD COMPATIBILITY - but use getApiUrl() function instead!
export const API_URL = getApiUrl();
