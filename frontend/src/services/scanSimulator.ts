import { ProcessingStageInfo, ScanRecord } from '../types';
import { recentScans } from '../data/mockData';

export const OCR_PIPELINE_STAGES: ProcessingStageInfo[] = [
  {
    id: 'stage-1',
    name: 'Pre-Processing & Skew Correction',
    title: 'Pre-Processing & Skew Correction',
    description: 'Denoising, adaptive contrast & multi-pass deskewing',
    subtitle: 'Denoising, adaptive contrast & multi-pass deskewing',
    engine: 'OpenCV + OrientationNet',
    durationMs: 600,
    iconName: 'image',
  },
  {
    id: 'stage-2',
    name: 'PaddleOCR Engine (Primary)',
    title: 'PaddleOCR Engine (Primary)',
    description: 'Deep neural text detection & recognition',
    subtitle: 'Deep neural text detection & recognition',
    engine: 'PaddleOCR v2.6 (PP-OCRv3)',
    durationMs: 900,
    iconName: 'cpu',
  },
  {
    id: 'stage-3',
    name: 'EasyOCR Ensemble Verification',
    title: 'EasyOCR Ensemble Verification',
    description: 'Secondary multilingual OCR verification pass',
    subtitle: 'Secondary multilingual OCR verification pass',
    engine: 'EasyOCR v1.7 PyTorch',
    durationMs: 700,
    iconName: 'layers',
  },
  {
    id: 'stage-4',
    name: 'Tesseract OCR Fallback Pass',
    title: 'Tesseract OCR Fallback Pass',
    description: 'Bilingual Hindi/English symbol check',
    subtitle: 'Bilingual Hindi/English symbol check',
    engine: 'Tesseract OCR v5.3',
    durationMs: 500,
    iconName: 'file-text',
  },
  {
    id: 'stage-5',
    name: 'Reading Order & Layout Resolver',
    title: 'Reading Order & Layout Resolver',
    description: 'Spatial bounding box layout & 360° rotation alignment',
    subtitle: 'Spatial bounding box layout & 360° rotation alignment',
    engine: 'LayoutLMv3 Spatial Engine',
    durationMs: 600,
    iconName: 'rotate-cw',
  },
  {
    id: 'stage-6',
    name: 'Mandatory Declaration Extractor',
    title: 'Mandatory Declaration Extractor',
    description: 'Regex pattern matching & contextual entity parsing',
    subtitle: 'Regex pattern matching & contextual entity parsing',
    engine: 'Rule Extractor v2.1',
    durationMs: 500,
    iconName: 'sliders',
  },
  {
    id: 'stage-7',
    name: 'Legal Metrology Rule Engine',
    title: 'Legal Metrology Rule Engine',
    description: 'Rule 6, Rule 11 font-size & MRP validation',
    subtitle: 'Rule 6, Rule 11 font-size & MRP validation',
    engine: 'DoCA Grounded Rule Engine v2.0',
    durationMs: 700,
    iconName: 'check-square',
  },
  {
    id: 'stage-8',
    name: 'DINOv2 Authenticity Signal',
    title: 'DINOv2 Authenticity Signal',
    description: 'Visual vector embedding comparison vs genuine products',
    subtitle: 'Visual vector embedding comparison vs genuine products',
    engine: 'DINOv2 ViT-Base',
    durationMs: 600,
    iconName: 'shield',
  },
];


export async function simulateScanPipeline(
  imageUri: string,
  onStageChange?: (stageIndex: number) => void,
  onTextExtracted?: (textSnippet: string) => void
): Promise<ScanRecord> {
  const extractedSnippets = [
    'Enhancing resolution 300 DPI...',
    'Text detected: "BRITANNIA Good Day Cashew"',
    'MRP printed: "MRP ₹ 30.00 INCL. OF ALL TAXES"',
    'Net Qty: "100 g"',
    'Mfg Date: "08/2026" (Font: 1.2mm)',
    'Consumer Care: "Call 1800-425-4444"',
    'Checking DoCA Rule 11 font size tables...',
    'DINOv2 feature match: 92% similarity index.',
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
