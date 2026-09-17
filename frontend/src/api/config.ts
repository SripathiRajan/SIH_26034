import { Platform } from 'react-native';

/**
 * API Host & Server Configuration for Localhost & Production
 *
 * Defaults:
 * - Web / iOS Simulator: http://localhost:8000
 * - Android Emulator: http://10.0.2.2:8000
 * - Physical Device (Expo Go): Replace with your machine's LAN IP (e.g., http://192.168.1.5:8000)
 */
export const API_CONFIG = {
  // Supports EXPO_PUBLIC_API_URL env variable or platform defaults
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  }),
  TIMEOUT_MS: 15000,
  ENDPOINTS: {
    HEALTH: '/health',
    SCAN: '/api/scan',
    SCANS_LIST: '/api/scans',
    SCAN_DETAIL: (id: string) => `/api/scans/${id}`,
    SCAN_PDF: (id: string) => `/api/scans/${id}/pdf`,
    DASHBOARD_STATS: '/api/dashboard/stats',
    CHAT: '/api/chat',
  },
};

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === '1';
