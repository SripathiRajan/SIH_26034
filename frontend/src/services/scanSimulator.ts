import { ProcessingStageInfo, ScanRecord } from '../types';
import { recentScans } from '../data/mockData';

export const OCR_PIPELINE_STAGES: ProcessingStageInfo[] = [
  {
    id: 'stage-1',
    name: 'Pre-Processing & Skew Correction',
    title: 'Pre-Processing & Skew Correction',
    description: 'Denoising, adaptive contrast & multi-pass deskewing',
    subtitle: 'Denoising, adaptive contrast & multi-pass deskewing',
    engine: 'OpenCV Pre-processor',
    durationMs: 600,
    iconName: 'image',
  },
  {
    id: 'stage-2',
    name: 'PaddleOCR Engine (Primary)',
    title: 'PaddleOCR Engine (Primary)',
    description: 'Primary text detection & recognition pass',
    subtitle: 'Primary text detection & recognition pass',
    engine: 'PaddleOCR v2.6',
    durationMs: 900,
    iconName: 'cpu',
  },
  {
    id: 'stage-3',
    name: 'EasyOCR Ensemble Verification',
    title: 'EasyOCR Ensemble Verification',
    description: 'Secondary multilingual OCR verification pass',
    subtitle: 'Secondary multilingual OCR verification pass',
    engine: 'EasyOCR PyTorch',
    durationMs: 700,
    iconName: 'layers',
  },
  {
    id: 'stage-4',
    name: 'SuryaOCR / CLAHE Retry Pass',
    title: 'SuryaOCR / CLAHE Retry Pass',
    description: 'Fallback contrast enhancement & symbol retry pass',
    subtitle: 'Fallback contrast enhancement & symbol retry pass',
    engine: 'CLAHE + SuryaOCR',
    durationMs: 500,
    iconName: 'rotate-cw',
  },
  {
    id: 'stage-5',
    name: 'Spatial Merge & Reading Order',
    title: 'Spatial Merge & Reading Order',
    description: 'Spatial bounding box layout & multi-token alignment',
    subtitle: 'Spatial bounding box layout & multi-token alignment',
    engine: 'Spatial Alignment Graph',
    durationMs: 600,
    iconName: 'sliders',
  },
  {
    id: 'stage-6',
    name: 'Mandatory Field Extractor',
    title: 'Mandatory Field Extractor',
    description: 'Regex patterns & contextual entity parsing (Rule 6 declarations)',
    subtitle: 'Regex patterns & contextual entity parsing (Rule 6 declarations)',
    engine: 'Field Extractor Engine',
    durationMs: 500,
    iconName: 'file-text',
  },
  {
    id: 'stage-7',
    name: 'Legal Metrology Rule Engine',
    title: 'Legal Metrology Rule Engine',
    description: 'Mandatory declarations, font size & unit verification',
    subtitle: 'Mandatory declarations, font size & unit verification',
    engine: 'PCR 2011 Compliance Engine',
    durationMs: 700,
    iconName: 'check-square',
  },
];

export async function simulateScanPipeline(
  imageUri: string,
  onStageChange?: (stageIndex: number) => void,
  onTextExtracted?: (textSnippet: string) => void
): Promise<ScanRecord> {
  const extractedSnippets = [
    'Enhancing resolution & applying adaptive contrast...',
    'PaddleOCR detecting text tokens...',
    'EasyOCR ensemble pass running...',
    'CLAHE retry on low-contrast regions completed...',
    'Merging spatial reading order bounding boxes...',
    'Extracting MRP, Net Quantity, Dates, Manufacturer details...',
    'Verifying declarations against Legal Metrology Rules, 2011...',
  ];

  for (let i = 0; i < OCR_PIPELINE_STAGES.length; i++) {
    if (onStageChange) onStageChange(i);
    if (extractedSnippets[i] && onTextExtracted) {
      onTextExtracted(extractedSnippets[i]);
    }
    await new Promise((res) => setTimeout(res, OCR_PIPELINE_STAGES[i].durationMs));
  }

  const baseResult = recentScans[Math.floor(Math.random() * recentScans.length)];
  return {
    ...baseResult,
    id: `s-${Date.now()}`,
    imageUri: imageUri || undefined,
    scannedAt: new Date().toISOString(),
  };
}
