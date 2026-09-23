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
  // 1. Web browser environment
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location?.hostname || '';
    const protocol = window.location?.protocol || 'http:';

    // Check if running locally or on a private development network
    const isLocalOrLan =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

    if (isLocalOrLan) {
      // Prioritize port 8000 for local development
      return `${protocol}//127.0.0.1:8000`;
    }

    // When hosted in Azure or other cloud environments:
    // Check configured environment variable first
    if (process.env.EXPO_PUBLIC_API_URL) {
      const envUrl = process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
      // If frontend is HTTPS and backend URL is HTTP on the same host, use relative to avoid mixed content
      if (protocol === 'https:' && envUrl.startsWith('http://') && envUrl.includes(host)) {
        return '';
      }
      return envUrl;
    }

    // If served over HTTPS on Azure without explicit API URL, use relative path (reverse proxy)
    if (protocol === 'https:') {
      return '';
    }

    // If directly accessed on Azure host by IP/domain without reverse proxy
    return `${protocol}//${host}:8000`;
  }

  // 2. Native mobile apps (Android emulator / iOS simulator / production APK)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  return (Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://127.0.0.1:8000',
    default: 'http://127.0.0.1:8000',
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
