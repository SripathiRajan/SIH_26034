/**
 * Unified API Client for PRAMAN v4 Backend & Local Fallback
 *
 * Connects to the FastAPI backend at port 8000 with real HTTP calls.
 * If the server is offline or unreachable, seamlessly falls back to
 * local simulated data so development and UI testing never fail.
 */
import { Platform } from 'react-native';
import { API_CONFIG, DEMO_MODE } from './config';
import { recentScans, dashboardStats } from '../data/mockData';
import { rulesDatabase } from '../data/rulesDatabase';
import { simulateScanPipeline } from '../services/scanSimulator';
import { ScanRecord, DashboardStats, Rule, OfficerUser, SessionCoverageResponse } from '../types';

export class ApiError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

class ApiClient {
  private baseUrl: string = API_CONFIG.BASE_URL;
  private authToken: string | null = null;

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Check if the backend is active and responding.
   */
  public async checkHealth(): Promise<{ online: boolean; host: string; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.HEALTH}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return { online: true, host: this.baseUrl, message: 'PRAMAN v4 backend connected' };
      }
      return { online: false, host: this.baseUrl, message: `Server responded with ${res.status}` };
    } catch {
      return { online: false, host: this.baseUrl, message: 'Backend offline (using local mode)' };
    }
  }

  /**
   * Analyze an image: sends to FastAPI backend with real cascaded OCR,
   * otherwise runs the local simulated pipeline.
   */
  public async analyzeImage(
    imageUri: string,
    onProgress?: (stage: number) => void,
    gtin?: string
  ): Promise<ScanRecord> {
    try {
      const controller = new AbortController();
      const timeoutMs = API_CONFIG.TIMEOUT_MS || 120000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const formData = new FormData();
      if (Platform.OS === 'web') {
        let blob: Blob | null = null;
        if (imageUri.startsWith('data:')) {
          const arr = imageUri.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          blob = new Blob([u8arr], { type: mime });
        } else if (imageUri.startsWith('blob:') || imageUri.startsWith('http')) {
          try {
            const blobRes = await fetch(imageUri);
            blob = await blobRes.blob();
          } catch (e) {
            console.warn('[ApiClient] Failed to fetch image blob on web:', e);
          }
        }
        if (blob) {
          formData.append('image', blob, 'label_scan.jpg');
          formData.append('file', blob, 'label_scan.jpg');
        } else {
          // @ts-ignore
          formData.append('image', { uri: imageUri, name: 'label_scan.jpg', type: 'image/jpeg' });
          // @ts-ignore
          formData.append('file', { uri: imageUri, name: 'label_scan.jpg', type: 'image/jpeg' });
        }
      } else {
        // Native React Native
        const fileObj = {
          uri: imageUri,
          name: 'label_scan.jpg',
          type: 'image/jpeg',
        };
        // @ts-ignore
        formData.append('image', fileObj);
        // @ts-ignore
        formData.append('file', fileObj);
      }

      if (gtin) {
        formData.append('gtin', gtin);
      }

      // Progress animation trigger
      if (onProgress) onProgress(1);

      const scanEndpoint = API_CONFIG.ENDPOINTS.SCAN || '/api/scan';
      const response = await fetch(`${this.baseUrl}${scanEndpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        if (onProgress) onProgress(4);
        const data = await response.json();
        return this.normalizeScanRecord(data, imageUri);
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`[ApiClient] Scan API error HTTP ${response.status}: ${errorText}`);
        if (!DEMO_MODE) {
          throw new ApiError('SCAN_FAILED', `Scan failed (HTTP ${response.status}): ${errorText || 'Server error'}`);
        }
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Image analysis timed out after 120s. Processing complex multi-engine OCR on CPU took too long.');
      }
      if (DEMO_MODE) {
        console.warn('[ApiClient] Backend scan call failed, falling back to simulator (demo mode):', err);
        return simulateScanPipeline(imageUri, onProgress);
      }
      throw new ApiError('BACKEND_UNREACHABLE', 'Cannot scan — backend is offline or unreachable');
    }

    if (DEMO_MODE) {
      return simulateScanPipeline(imageUri, onProgress);
    }
    throw new ApiError('SCAN_FAILED', 'Scan processing failed');
  }

  /**
   * Helper to append an image URI to FormData across Web and React Native Native.
   */
  private async appendImageToFormData(
    formData: FormData,
    fieldName: string,
    imageUri: string,
    filename: string
  ): Promise<void> {
    if (Platform.OS === 'web') {
      let blob: Blob | null = null;
      if (imageUri.startsWith('data:')) {
        const arr = imageUri.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else if (imageUri.startsWith('blob:') || imageUri.startsWith('http')) {
        try {
          const blobRes = await fetch(imageUri);
          blob = await blobRes.blob();
        } catch (e) {
          console.warn('[ApiClient] Failed to fetch image blob on web:', e);
        }
      }
      if (blob) {
        formData.append(fieldName, blob, filename);
      } else {
        // @ts-ignore
        formData.append(fieldName, { uri: imageUri, name: filename, type: 'image/jpeg' });
      }
    } else {
      // Native React Native
      const fileObj = {
        uri: imageUri,
        name: filename,
        type: 'image/jpeg',
      };
      // @ts-ignore
      formData.append(fieldName, fileObj);
    }
  }

  /**
   * Multi-angle scanning session: upload 1–6 images to create or resume an in-memory session.
   * Returns live statutory coverage and merged fields across all captured angles.
   * Timeout: 120s.
   */
  public async scanSession(
    images: string[],
    sessionId?: string,
    gtin?: string
  ): Promise<SessionCoverageResponse> {
    if (!images || images.length < 1 || images.length > 6) {
      throw new ApiError('INVALID_INPUT', 'Between 1 and 6 images are required in one batch');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

      const formData = new FormData();
      for (let i = 0; i < images.length; i++) {
        const fname = `view_${i + 1}.jpg`;
        await this.appendImageToFormData(formData, 'images', images[i], fname);
      }

      if (sessionId && sessionId.trim()) {
        formData.append('session_id', sessionId.trim());
      }
      if (gtin && gtin.trim()) {
        formData.append('gtin', gtin.trim());
      }

      const endpoint = API_CONFIG.ENDPOINTS.SCAN_SESSION || '/api/scan/session';
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: SessionCoverageResponse = await response.json();
        return data;
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`[ApiClient] scanSession error HTTP ${response.status}: ${errorText}`);
        throw new ApiError(
          response.status === 404 ? 'SESSION_NOT_FOUND' : 'SCAN_SESSION_FAILED',
          `Multi-angle scan failed (HTTP ${response.status}): ${errorText || 'Server error'}`
        );
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Multi-angle scan timed out after 120s');
      }
      throw new ApiError('BACKEND_UNREACHABLE', `Cannot connect to multi-angle scan session: ${err?.message || 'Server offline'}`);
    }
  }

  /**
   * Finalize a multi-angle scan session into exactly one persistent ScanRecord.
   * Requires inspector authentication.
   * Timeout: 30s.
   */
  public async finalizeSession(sessionId: string): Promise<ScanRecord> {
    if (!sessionId || !sessionId.trim()) {
      throw new ApiError('INVALID_INPUT', 'Session ID is required to finalize session');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const endpoint = typeof API_CONFIG.ENDPOINTS.FINALIZE_SESSION === 'function'
        ? API_CONFIG.ENDPOINTS.FINALIZE_SESSION(sessionId)
        : `/api/scan/session/${sessionId}/finalize`;

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new ApiError('UNAUTHORIZED', 'Authentication required to finalize inspection report. Please log in.');
      }

      if (response.ok) {
        const data = await response.json();
        return this.normalizeScanRecord(data, data.imageUri || '');
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`[ApiClient] finalizeSession error HTTP ${response.status}: ${errorText}`);
        throw new ApiError(
          response.status === 404 ? 'NOT_FOUND' : 'FINALIZE_FAILED',
          `Failed to finalize session (HTTP ${response.status}): ${errorText || 'Server error'}`
        );
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Finalize request timed out after 60s');
      }
      throw new ApiError('BACKEND_UNREACHABLE', `Cannot finalize session: ${err?.message || 'Server offline'}`);
    }
  }

  /**
   * Discard a multi-angle scan session without creating a ScanRecord.
   * Idempotent on the backend: discarding an expired/missing session still succeeds.
   */
  public async discardSession(sessionId: string): Promise<void> {
    if (!sessionId || !sessionId.trim()) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      await fetch(`${this.baseUrl}/api/scan/session/${sessionId.trim()}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err) {
      // Non-fatal: backend TTL/LRU eviction cleans the session up anyway
      console.warn('[ApiClient] discardSession failed (session will expire via TTL):', err);
    }
  }

  /**
   * List all scan records from database or fallback mock records.
   */
  public async listScans(params?: { brand?: string; status?: string; page?: number }): Promise<ScanRecord[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const queryParams = new URLSearchParams();
      if (params?.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', String(params.page));

      const url = `${this.baseUrl}${API_CONFIG.ENDPOINTS.SCANS_LIST}?${queryParams.toString()}`;
      const res = await fetch(url, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      console.warn('[ApiClient] listScans status', res.status);

      if (res.ok) {
        const data = await res.json();
        let items: any[] = [];
        if (Array.isArray(data)) items = data;
        else if (Array.isArray(data.scans)) items = data.scans;
        else if (Array.isArray(data.items)) items = data.items;

        if (items.length > 0) {
          return items.map((r) => this.normalizeScanRecord(r, r.imageUri || ''));
        }
      }
    } catch (err) {
      console.warn('[ApiClient] listScans failed:', err);
    }

    if (DEMO_MODE) {
      let result = [...recentScans];
      if (params?.status && params.status !== 'all') {
        result = result.filter((s: ScanRecord) => s.status.toLowerCase() === params.status?.toLowerCase());
      }
      if (params?.brand) {
        result = result.filter((s: ScanRecord) => s.brand.toLowerCase().includes(params.brand?.toLowerCase() || ''));
      }
      return result;
    }

    return [];
  }

  /**
   * Fetch single scan record by ID.
   */
  public async getScan(id: string): Promise<ScanRecord> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.SCAN_DETAIL(id)}`, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return this.normalizeScanRecord(data, data.imageUri || '');
      }
    } catch (err) {
      console.warn('[ApiClient] getScan failed:', err);
    }

    if (DEMO_MODE) {
      const found = recentScans.find((s: ScanRecord) => s.id === id) || recentScans[0];
      if (found) return found;
    }

    throw new ApiError('NOT_FOUND', `Scan record ${id} not found or backend unreachable`);
  }

  /**
   * Fetch live dashboard compliance statistics.
   */
  public async getDashboardStats(): Promise<DashboardStats> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/api/stats`, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[ApiClient] getDashboardStats failed:', err);
    }

    if (DEMO_MODE) {
      return dashboardStats;
    }

    throw new ApiError('BACKEND_UNREACHABLE', 'Cannot fetch dashboard statistics — backend is offline');
  }

  /**
   * Query Legal Metrology RAG Compliance Assistant (backend /api/chat).
   * Synthesis: Groq (primary) or Gemini with statutory-template fallback.
   */
  public async askAssistant(
    question: string
  ): Promise<{ answer: string; sources: string[]; llmGenerated?: boolean }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${this.baseUrl}${API_CONFIG.ENDPOINTS.CHAT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getHeaders(),
        },
        body: JSON.stringify({ message: question }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          answer: data.reply || data.text || data.answer || '',
          sources: data.citations || data.sources || ['Legal Metrology Act, 2009', 'PCR, 2011'],
          llmGenerated: Boolean(data.llm_generated),
        };
      }
      throw new ApiError('CHAT_FAILED', `Assistant query failed (HTTP ${res.status})`);
    } catch (err) {
      // Rethrow so the caller can fall back to its offline statutory engine
      if (err instanceof ApiError) throw err;
      throw new ApiError('BACKEND_UNREACHABLE', 'Assistant backend is offline or unreachable');
    }
  }

  /**
   * Fetch statutory rules database.
   */
  public async getRules(category?: string, search?: string): Promise<Rule[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const q = new URLSearchParams();
      if (category && category !== 'all') q.append('category', category);
      if (search) q.append('search', search);

      const res = await fetch(`${this.baseUrl}/api/rules?${q.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Fallback
    }

    let filtered = [...rulesDatabase];
    if (category && category !== 'all') {
      filtered = filtered.filter((r) => r.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(s) ||
          r.section.toLowerCase().includes(s) ||
          r.summary.toLowerCase().includes(s)
      );
    }
    return filtered;
  }

  /**
   * Register a new officer account. Role is always locked to "inspector"
   * by the backend (admin/auditor must be seeded server-side).
   */
  public async register(
    username: string,
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          full_name: fullName || username,
        }),
      });
      if (res.status === 201) {
        return { success: true };
      }
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      const detail = Array.isArray(err.detail)
        ? err.detail.map((e: any) => e?.msg || '').join(', ') || 'Registration failed'
        : err.detail || 'Registration failed';
      return { success: false, error: detail };
    } catch {
      return { success: false, error: 'Backend unreachable — cannot register in production mode' };
    }
  }

  /**
   * Authenticate officer.
   */
  public async login(identifier: string, password: string): Promise<{ success: boolean; token?: string; user?: OfficerUser; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password }),
      });

      if (res.ok) {
        const data = await res.json();
        this.authToken = data.access_token;
        const officer: OfficerUser = {
          id: data.user?.id || 'officer-1',
          name: data.user?.name || data.user?.username || 'Officer',
          role: data.user?.role || 'officer',
          department: data.user?.department || 'Legal Metrology Enforcement',
          zone: data.user?.zone || 'North Zone',
          badgeId: data.user?.badgeId || 'LM-IND-042',
        };
        return { success: true, token: data.access_token, user: officer };
      }
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      return { success: false, error: err.detail || 'Invalid credentials' };
    } catch {
      if (DEMO_MODE) {
        return {
          success: true,
          user: {
            id: 'officer-demo',
            name: 'Insp. R. Sharma',
            role: 'officer',
            department: 'Legal Metrology Dept, Delhi',
            zone: 'North Zone',
            badgeId: 'LM-DL-8821',
          },
        };
      }
      return {
        success: false,
        error: 'Backend unreachable — cannot authenticate in production mode',
      };
    }
  }

  /**
   * Get direct download URL for generated PDF report.
   */
  public getPdfDownloadUrl(scanId: string): string {
    return `${this.baseUrl}/api/scans/${scanId}/pdf`;
  }

  /**
   * Save or update inspector notes on a scan record.
   */
  public async patchNotes(scanId: string, notes: string): Promise<{ success: boolean; notes: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/scans/${scanId}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.getHeaders(),
        },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, notes: data.notes || notes };
      }
    } catch (err) {
      console.warn('[ApiClient] patchNotes error:', err);
    }
    if (DEMO_MODE) {
      return { success: true, notes };
    }
    throw new ApiError('PATCH_FAILED', 'Failed to save notes to backend');
  }

  private normalizeScanRecord(data: any, fallbackUri: string): ScanRecord {
    const rawConf = data.complianceConfidence ?? data.compliance_confidence ?? data.authenticityScore ?? data.authenticity_score;
    let confidence = 0;
    if (typeof rawConf === 'number') {
      confidence = rawConf <= 1.0 ? Math.round(rawConf * 100) : Math.round(rawConf);
    }

    const rawImageUris = Array.isArray(data.imageUris) ? data.imageUris : [];
    const normalizedImageUris = rawImageUris
      .map((u: string) => {
        if (typeof u !== 'string') return '';
        if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:') || u.startsWith('blob:')) {
          return u;
        }
        return `${this.baseUrl}${u.startsWith('/') ? u : `/${u}`}`;
      })
      .filter(Boolean);

    return {
      id: data.id || data.scan_id || `scan-${Date.now()}`,
      productName: data.productName || data.product_name || 'Scanned Packaged Commodity',
      brand: data.brand || 'Detected Brand',
      netWeight: data.netWeight || data.net_weight || 'N/A',
      scannedAt: data.scannedAt || data.scanned_at || new Date().toISOString(),
      date: data.date || new Date().toLocaleDateString('en-GB'),
      status: data.status || 'warning',
      complianceConfidence: confidence,
      thumbnailColor: data.thumbnailColor || '#00C2A8',
      imageUri: data.imageUri || (data.imageUrl ? `${this.baseUrl}${data.imageUrl}` : fallbackUri),
      processingTime: data.processingTime ?? data.processing_time,
      ocrEnginesUsed: data.ocrEnginesUsed ?? data.ocr_engines_used,
      fields: Array.isArray(data.fields) ? data.fields : [],
      inspectorNotes: Array.isArray(data.inspectorNotes) ? data.inspectorNotes : [],
      facesScanned: Array.isArray(data.facesScanned) ? data.facesScanned : undefined,
      imageUris: normalizedImageUris.length > 0 ? normalizedImageUris : undefined,
    };
  }
}

export const api = new ApiClient();
