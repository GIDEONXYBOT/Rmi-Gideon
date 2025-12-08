/**
 * API URL Configuration with Auto-Detect IP
 * 
 * - Uses current browser hostname (auto-detects IP if accessed via IP)
 * - Backend strict port: 5000
 * - Maps production domains to backend endpoints
 * 
 * IMPORTANT: Always use getApiUrl() function, NOT the API_URL constant
 */

// Get API URL based on current hostname - computes fresh each time
export function getApiUrl() {
  if (typeof window === 'undefined') {
    // Server-side rendering or build time - return placeholder
    return 'http://localhost:5000';
  }

  const hostname = window.location.hostname;
  
  // Map production domains to their respective backends
  const domainMap = {
    'rmi.gideonbot.xyz': 'https://rmi-backend-zhdr.onrender.com',
    'www.rmi.gideonbot.xyz': 'https://rmi-backend-zhdr.onrender.com',
  };

  // Check if we have a mapped domain
  if (domainMap[hostname]) {
    return domainMap[hostname];
  }

  // Check for environment variable (works with Cloudflare/Vercel env vars)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default: use the current hostname with port 5000 (for localhost development)
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
