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
    name: 'Multi-Engine OCR Ensemble',
    title: 'Multi-Engine OCR Ensemble',
    description: 'Cascaded PaddleOCR & EasyOCR multilingual text recognition',
    subtitle: 'Cascaded PaddleOCR & EasyOCR multilingual text recognition',
    engine: 'Ensemble OCR (Paddle + EasyOCR)',
    durationMs: 900,
    iconName: 'cpu',
  },
  {
    id: 'stage-3',
    name: 'Mandatory Field Extractor',
    title: 'Mandatory Field Extractor',
    description: 'Regex patterns & contextual entity parsing (Rule 6 declarations)',
    subtitle: 'Regex patterns & contextual entity parsing (Rule 6 declarations)',
    engine: 'PCR Rule 6 Entity Parser',
    durationMs: 600,
    iconName: 'file-text',
  },
  {
    id: 'stage-4',
    name: 'Legal Metrology Rule Engine',
    title: 'Legal Metrology Rule Engine',
    description: 'Mandatory declarations, font size & standard unit verification',
    subtitle: 'Mandatory declarations, font size & standard unit verification',
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
