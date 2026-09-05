// Configuration for API and WebSocket URLs

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  // In production (served by the same backend container), use relative path
  if (import.meta.env.PROD) {
    return '';
  }
  return 'http://localhost:4000';
};

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // In production, derive WebSocket protocol and host from the browser's window.location
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return 'ws://localhost:4000/ws';
};

export const API_BASE_URL = getApiBaseUrl();
export const WS_URL = getWsUrl();
