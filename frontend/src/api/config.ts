import { Platform } from 'react-native';

/**
 * API Host & Server Configuration for Localhost & Production
 *
 * Defaults:
 * - Web / iOS Simulator: http://localhost:8000
 * - Android Emulator: http://10.0.2.2:8000
 * - Physical Device (Expo Go): Replace with your machine's LAN IP (e.g., http://192.168.1.5:8000)
 */
const getBaseUrl = (): string => {
  // On web, if served over HTTPS but backend is HTTP, use relative origin to leverage reverse proxy and avoid mixed content
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.protocol === 'https:') {
    return '';
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // On web, if accessed from a remote device or mobile phone browser, point to the host machine's port 8000
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    const protocol = window.location.protocol || 'http:';
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `${protocol}//${host}:8000`;
    }
    return `${protocol}//localhost:8000`;
  }
  return (Platform.select({
    android: 'http://10.0.2.2:8001',
    ios: 'http://localhost:8001',
    default: 'http://localhost:8001',
  }) as string);
};

export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  TIMEOUT_MS: 120000,
  ENDPOINTS: {
    HEALTH: '/health',
    SCAN: '/api/scan',
    SCAN_SESSION: '/api/scan/session',
    FINALIZE_SESSION: (id: string) => `/api/scan/session/${id}/finalize`,
    SCANS_LIST: '/api/scans',
    SCAN_DETAIL: (id: string) => `/api/scans/${id}`,
    SCAN_PDF: (id: string) => `/api/scans/${id}/pdf`,
    DASHBOARD_STATS: '/api/dashboard/stats',
    CHAT: '/api/chat',
  },
};

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === '1';
