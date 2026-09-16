export type ComplianceStatus = 'pass' | 'warning' | 'fail';

export type UserRole = 'admin' | 'officer' | 'viewer';

export interface OfficerUser {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  zone: string;
  badgeId: string;
}

export interface InspectorNote {
  id: string;
  text: string;
  addedAt: string;
  officerId: string;
}

export interface FieldCheck {
  label: string;
  status: ComplianceStatus;
  detail?: string;
  extractedValue?: string;
  extractedText?: string; // alias used in ResultScreen
  fieldName?: string;     // alias used in ResultScreen
  confidence?: number;
  ruleRef?: string;
  ruleCitation?: string;  // alias used in ResultScreen
  ruleExplanation?: string;
  violationReason?: string; // alias used in ResultScreen
}

export interface ScanRecord {
  id: string;
  productName: string;
  brand: string;
  netWeight: string;
  scannedAt: string; // ISO timestamp
  date?: string;     // human-readable date alias used in ResultScreen
  status: ComplianceStatus;
  authenticityScore: number; // 0-100
  thumbnailColor: string;
  imageUri?: string;
  processingTime?: number; // seconds
  ocrEnginesUsed?: string[];
  category?: string;
  inspectorNotes?: InspectorNote[];
  officerId?: string;
  location?: string;
  fields: FieldCheck[];
}

export interface DailyCount {
  day: string;
  pass: number;
  warning: number;
  fail: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  violationRate: number;
}

export interface DashboardStats {
  totalScans: number;
  violationRate: number; // percentage
  authenticityFlags: number;
  avgSecondsPerScan: number;
  compliantCount: number;
  nonCompliantCount: number;
  topViolationFields: { label: string; count: number; percentage: number }[];
  topFlaggedBrands: { brand: string; violations: number }[];
  dailyCounts: DailyCount[];
  categoryBreakdown: CategoryBreakdown[];
  zoneBreakdown: { zone: string; scans: number; violations: number }[];
}

export interface ChatMessage {
  id: string;
  role: 'officer' | 'assistant';
  text: string;
  sources?: string[];
  citations?: string[];
  isContextual?: boolean;
}

export interface Rule {
  id: string;
  section: string;
  title: string;
  summary: string;
  fullText: string;
  amendment?: string;
  penalty?: string;
  category: 'mandatory' | 'font-size' | 'mrp' | 'consumer-care' | 'penalty' | 'packaging';
  tags: string[];
}

export interface ProcessingStageInfo {
  id: string;
  name: string;
  description: string;
  engine: string;
  durationMs: number;
  iconName: string;
  title?: string;
  subtitle?: string;
}
