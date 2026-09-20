import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Image,
  Platform,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import GlassCard from '../components/GlassCard';
import StatusPill from '../components/StatusPill';
import DemoBanner from '../components/DemoBanner';
import { color, font, space, radius } from '../theme/tokens';
import { recentScans } from '../data/mockData';
import { DEMO_MODE } from '../api/config';
import { api } from '../api/client';
import { exportReportAsPdf } from '../services/reportExporter';

import DottedBackground from '../components/DottedBackground';
import { setChatScanContext } from '../services/chatContext';

interface Props {
  navigation: any;
  route: any;
}

function BackIcon({ col = '#4F46E5', size = 14 }: { col?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="M12 19l-7-7 7-7" />
    </Svg>
  );
}

function PdfIcon({ col = '#FFFFFF', size = 15 }: { col?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M9 13h6" />
      <Path d="M9 17h4" />
    </Svg>
  );
}

function NoteIcon({ col = '#4F46E5', size = 15 }: { col?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

function ShieldIcon({ col = '#10B981', size = 16 }: { col?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export default function ResultScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [inspectorNote, setInspectorNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const scanData = route.params?.scanData;
  const scanId = route.params?.scanId;

  const [scan, setScan] = useState<any>(
    scanData || (DEMO_MODE ? (recentScans.find((s) => s.id === scanId) || recentScans[0]) : null)
  );
  const [loading, setLoading] = useState(!scanData && !!scanId && !DEMO_MODE);
  const [error, setError] = useState<string | null>(null);

  const normalizeImageUri = (uri?: string | null): string => {
    if (!uri) return '';
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('file://')) {
      return uri;
    }
    const base = api.getBaseUrl().replace(/\/+$/, '');
    const path = uri.startsWith('/') ? uri : `/${uri}`;
    return `${base}${path}`;
  };

  const imageUris: string[] = React.useMemo(() => {
    const uris: string[] = [];
    if (Array.isArray(scan?.imageUris) && scan.imageUris.length > 0) {
      uris.push(...scan.imageUris);
    } else if (Array.isArray(route.params?.imageUris) && route.params.imageUris.length > 0) {
      uris.push(...route.params.imageUris);
    } else if (scan?.imageUri) {
      uris.push(scan.imageUri);
    }
    return uris.map((u) => normalizeImageUri(u)).filter(Boolean);
  }, [scan?.imageUris, scan?.imageUri, route.params?.imageUris]);

  const facesScanned = Array.isArray(scan?.facesScanned) ? scan.facesScanned : [];
  const viewCount = Math.max(imageUris.length, facesScanned.length);

  const [activeImageUri, setActiveImageUri] = useState<string>('');

  useEffect(() => {
    if (imageUris.length > 0) {
      setActiveImageUri(imageUris[0]);
    } else if (scan?.imageUri) {
      setActiveImageUri(normalizeImageUri(scan.imageUri));
    }
  }, [imageUris, scan?.imageUri]);

  useEffect(() => {
    if (!scan && scanId) {
      setLoading(true);
      api.getScan(scanId)
        .then((data) => {
          setScan(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to load inspection record');
          setLoading(false);
        });
    }
  }, [scanId]);

  if (loading) {
    return (
      <DottedBackground>
        <DemoBanner />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <ActivityIndicator size="large" color={color.primary} />
          <Text style={[styles.headerSubtitle, { marginTop: 16 }]}>Loading inspection report...</Text>
        </View>
      </DottedBackground>
    );
  }

  if (!scan) {
    return (
      <DottedBackground>
        <DemoBanner />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <Text style={[styles.headerTitle, { color: color.danger, textAlign: 'center' }]}>
            {error || 'No inspection data available'}
          </Text>
          <Text style={[styles.headerSubtitle, { marginTop: 8, marginBottom: 20, textAlign: 'center' }]}>
            Please scan a packaged commodity to inspect compliance declarations.
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: color.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }]}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={[styles.backBtnText, { color: '#FFFFFF' }]}>Start New Inspection</Text>
          </TouchableOpacity>
        </View>
      </DottedBackground>
    );
  }

  const violationCount = scan.fields?.filter((f: any) => f.status === 'fail').length ?? 0;
  const warningCount = scan.fields?.filter((f: any) => f.status === 'warning').length ?? 0;
  const passCount = scan.fields?.filter((f: any) => f.status === 'pass').length ?? 0;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      if (scan.id && !scan.id.startsWith('demo-')) {
        const downloadUrl = api.getPdfDownloadUrl(scan.id);
        if (Platform.OS === 'web') {
          window.open(downloadUrl, '_blank');
        } else {
          await Linking.openURL(downloadUrl);
        }
      } else {
        await exportReportAsPdf(scan, 'Field Officer');
      }
    } catch (e) {
      console.warn('Export error, falling back to client PDF generator:', e);
      try {
        await exportReportAsPdf(scan, 'Field Officer');
      } catch (err) {
        Alert.alert('Export Failed', 'Could not generate PDF report.');
      }
    } finally {
      setExporting(false);
    }
  };

  const handleSaveNote = async () => {
    if (inspectorNote.trim() && scan.id) {
      try {
        await api.patchNotes(scan.id, inspectorNote.trim());
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      } catch (err: any) {
        Alert.alert('Save Note Failed', err.message || 'Could not save note to server');
      }
    }
  };

  const overallStatusColor =
    scan.status === 'pass' ? color.success : scan.status === 'fail' ? color.danger : color.warning;
  const overallStatusBg =
    scan.status === 'pass' ? color.successBg : scan.status === 'fail' ? color.dangerBg : color.warningBg;

  const displayedMainImage = activeImageUri || (scan.imageUri ? normalizeImageUri(scan.imageUri) : '');

  return (
    <DottedBackground>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
      {/* Header Bar */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn} activeOpacity={0.7}>
          <BackIcon col={color.primary} size={14} />
          <Text style={styles.backBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      {/* Product Header Card */}
      <View style={[styles.header, isMobile && styles.mobileHeader]}>
        <View style={[styles.headerTop, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: space.sm }]}>
          {/* Product Image Thumbnail */}
          {displayedMainImage ? (
            <Image
              source={{ uri: displayedMainImage }}
              style={styles.productThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.productThumbPlaceholder, { backgroundColor: (scan.thumbnailColor || color.primary) + '20' }]}>
              <Text style={[styles.productThumbInitial, { color: scan.thumbnailColor || color.primary }]}>
                {(scan.brand || 'P').charAt(0)}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <Text style={styles.platformBadge}>INSPECTION REPORT · ID: {scan.id?.toUpperCase() || 'AUD-001'}</Text>
              {viewCount > 1 && (
                <View style={styles.multiViewBadge}>
                  <Text style={styles.multiViewBadgeText}>Scanned from {viewCount} views</Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerTitle, isMobile && styles.mobileTitle]}>
              {scan.productName || 'Package Inspection Report'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Brand: {scan.brand || 'Brand'} · Net Quantity: {scan.netWeight || 'N/A'} · Category: {scan.category || 'FMCG'}
            </Text>
          </View>
          <StatusPill status={scan.status} size="md" />
        </View>

        {/* Horizontal Thumbnail Carousel for Multiple Views */}
        {imageUris.length > 1 && (
          <View style={styles.carouselContainer}>
            <View style={styles.carouselHeaderRow}>
              <Text style={styles.carouselTitle}>Captured Package Views ({imageUris.length})</Text>
              <Text style={styles.carouselSubtitle}>Tap to inspect angle</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselScrollContent}
            >
              {imageUris.map((uri, idx) => {
                const isSelected = (activeImageUri || imageUris[0]) === uri;
                return (
                  <TouchableOpacity
                    key={`thumb-${idx}-${uri}`}
                    onPress={() => setActiveImageUri(uri)}
                    style={[
                      styles.carouselThumbWrapper,
                      isSelected && styles.carouselThumbActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.carouselThumbImg}
                      resizeMode="cover"
                    />
                    <View style={[styles.carouselThumbTag, isSelected && styles.carouselThumbTagActive]}>
                      <Text style={[styles.carouselThumbTagText, isSelected && styles.carouselThumbTagTextActive]}>
                        View {idx + 1}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Authenticity + Summary Row */}
      <View style={[styles.summaryMetricsRow, isMobile && { flexDirection: 'column' }]}>
        {/* Compliance status big card */}
        <GlassCard style={[styles.statusBigCard, { borderColor: overallStatusColor + '40', backgroundColor: overallStatusBg }]}>
          <Text style={[styles.statusBigLabel, { color: overallStatusColor }]}>
            {scan.status === 'pass' ? '✔ COMPLIANT' : scan.status === 'fail' ? '✘ VIOLATIONS FOUND' : '⚠ REVIEW NEEDED'}
          </Text>
          <Text style={styles.statusBigSub}>Legal Metrology (PC) Rules, 2011</Text>
          <View style={styles.statusCountRow}>
            <View style={styles.statusCountItem}>
              <Text style={[styles.statusCountNum, { color: color.success }]}>{passCount}</Text>
              <Text style={styles.statusCountLabel}>Pass</Text>
            </View>
            <View style={styles.statusCountDivider} />
            <View style={styles.statusCountItem}>
              <Text style={[styles.statusCountNum, { color: color.warning }]}>{warningCount}</Text>
              <Text style={styles.statusCountLabel}>Review</Text>
            </View>
            <View style={styles.statusCountDivider} />
            <View style={styles.statusCountItem}>
              <Text style={[styles.statusCountNum, { color: color.danger }]}>{violationCount}</Text>
              <Text style={styles.statusCountLabel}>Fail</Text>
            </View>
          </View>
        </GlassCard>

        {/* Compliance Confidence */}
        <GlassCard style={styles.authCard}>
          <View style={styles.authCardHeader}>
            <ShieldIcon col={scan.complianceConfidence >= 90 ? color.success : scan.complianceConfidence >= 75 ? color.warning : color.danger} size={16} />
            <Text style={styles.authCardTitle}>Compliance Confidence</Text>
          </View>
          <Text style={[styles.authScore, {
            color: scan.complianceConfidence >= 90 ? color.success : scan.complianceConfidence >= 75 ? color.warning : color.danger,
          }]}>
            {scan.complianceConfidence}%
          </Text>
          <Text style={styles.authSub}>Ensemble OCR & Extraction Confidence</Text>
          <View style={styles.authBar}>
            <View style={[styles.authBarFill, {
              width: `${scan.complianceConfidence}%`,
              backgroundColor: scan.complianceConfidence >= 90 ? color.success : scan.complianceConfidence >= 75 ? color.warning : color.danger,
            }]} />
          </View>
          <Text style={styles.authBarLabel}>
            {scan.complianceConfidence >= 90 ? 'High Confidence — Robust Detection' :
              scan.complianceConfidence >= 75 ? 'Moderate Confidence — Manual Review Recommended' :
              'Low Confidence — Verification Required'}
          </Text>
        </GlassCard>
      </View>

      {/* Meta Info Row */}
      <GlassCard style={styles.metaCard}>
        <View style={[styles.metaGrid, isMobile && { flexDirection: 'column', gap: space.md }]}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>DECLARATIONS AUDITED</Text>
            <Text style={styles.metaVal}>{scan.fields?.length ?? 0} Mandatory Fields</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>INSPECTION DATE</Text>
            <Text style={styles.metaVal}>{scan.date || (scan.scannedAt ? new Date(scan.scannedAt).toLocaleString('en-IN') : '—')}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>OCR ENGINES</Text>
            <Text style={styles.metaVal}>{(scan.ocrEnginesUsed || ['PaddleOCR']).join(' + ')}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>PROCESSING TIME</Text>
            <Text style={styles.metaVal}>{scan.processingTime ?? 1.2}s</Text>
          </View>
        </View>
      </GlassCard>

      {/* Mandatory Declarations Checklist */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mandatory Label Declarations Audit — Rule 6</Text>
      </View>

      <GlassCard style={styles.fieldsCard}>
        {scan.fields && scan.fields.map((field: any, idx: number) => {
          const isPass = field.status === 'pass';
          const fieldLabel = field.label || field.fieldName || 'Field';
          const extracted = field.extractedValue || field.extractedText || 'N/A';
          const ruleRef = field.ruleRef || field.ruleCitation || '';
          const violationReason = field.violationReason || field.detail || field.ruleExplanation || '';
          return (
            <View key={idx} style={[
              styles.fieldRow,
              isMobile && { flexDirection: 'column', gap: space.xs },
              idx === scan.fields.length - 1 && styles.fieldRowLast
            ]}>
              <View style={styles.fieldStatusCol}>
                <StatusPill status={field.status} size="sm" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldName}>{fieldLabel}</Text>
                <Text style={styles.fieldExtracted}>Extracted: "{extracted}"</Text>
                {ruleRef ? <Text style={styles.fieldRuleRef}>Citation: {ruleRef}</Text> : null}

                {!isPass && violationReason && (
                  <View style={styles.violationBox}>
                    <Text style={styles.violationTitle}>RULE VIOLATION:</Text>
                    <Text style={styles.violationText}>{violationReason}</Text>
                  </View>
                )}
              </View>

              {field.confidence !== undefined && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {((field.confidence <= 1.0 ? field.confidence * 100 : field.confidence) || 0).toFixed(0)}%
                  </Text>
                  <Text style={styles.confidenceLabel}>Conf.</Text>
                </View>
              )}
            </View>
          );
        })}
      </GlassCard>

      {/* Inspector Notes */}
      <View style={styles.sectionHeader}>
        <NoteIcon col={color.primary} size={16} />
        <Text style={styles.sectionTitle}>Inspector Notes & Evidence</Text>
      </View>
      <GlassCard style={styles.notesCard}>
        <TextInput
          style={[styles.notesInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
          value={inspectorNote}
          onChangeText={setInspectorNote}
          placeholder="Add field observations, evidence description, or action taken..."
          placeholderTextColor={color.inkMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.saveNoteBtn, noteSaved && { backgroundColor: color.success }]}
          onPress={handleSaveNote}
          activeOpacity={0.8}
        >
          <Text style={styles.saveNoteBtnText}>{noteSaved ? '✔ Saved' : 'Save Note'}</Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Action Buttons */}
      <View style={[styles.actionsRow, isMobile && { flexDirection: 'column' }]}>
        <TouchableOpacity
          style={[styles.pdfBtn, exporting && { opacity: 0.7 }]}
          onPress={handleExportPdf}
          activeOpacity={0.85}
          disabled={exporting}
        >
          <PdfIcon col="#FFFFFF" size={15} />
          <Text style={styles.pdfBtnText}>{exporting ? 'Generating...' : 'Export PDF Report'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryActionBtn}
          onPress={() => {
            const payload = {
              ...scan,
              imageUris: imageUris.length > 0 ? imageUris : (scan?.imageUri ? [normalizeImageUri(scan.imageUri)] : []),
              imageUri: activeImageUri || (imageUris.length > 0 ? imageUris[0] : normalizeImageUri(scan?.imageUri)),
            };
            setChatScanContext(payload);
            navigation.navigate('Assistant', { scanData: payload, scanId: scan?.id });
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionText}>Ask Assistant About This Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryActionBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryActionText}>Inspect Another Label</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </DottedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  contentContainer: {
    padding: space.lg,
    maxWidth: 1060,
    alignSelf: 'center',
    width: '100%',
  },
  mobileContent: {
    padding: space.md,
    paddingBottom: 96,
  },
  navHeader: {
    marginBottom: space.md,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: color.primary,
  },
  header: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  mobileHeader: {
    padding: space.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.md,
  },
  productThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  productThumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  productThumbInitial: {
    fontSize: 28,
    fontWeight: '800',
  },
  badgeRow: {
    marginBottom: space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexWrap: 'wrap',
  },
  platformBadge: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: color.primary,
    backgroundColor: color.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  multiViewBadge: {
    backgroundColor: color.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.primaryBorder,
  },
  multiViewBadgeText: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: color.primary,
  },
  carouselContainer: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.surfaceBorder,
  },
  carouselHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  carouselTitle: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: color.inkSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  carouselSubtitle: {
    fontSize: font.size.xs,
    color: color.inkMuted,
  },
  carouselScrollContent: {
    gap: space.sm,
    paddingVertical: 4,
  },
  carouselThumbWrapper: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.surfaceBorderDark,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    marginRight: space.xs,
  },
  carouselThumbActive: {
    borderColor: color.primary,
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  carouselThumbImg: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
  },
  carouselThumbTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  carouselThumbTagActive: {
    backgroundColor: color.primary,
  },
  carouselThumbTagText: {
    fontSize: 9,
    fontWeight: font.weight.bold,
    color: '#CBD5E1',
  },
  carouselThumbTagTextActive: {
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.ink,
    marginBottom: space.xs,
  },
  mobileTitle: {
    fontSize: font.size.xl,
  },
  headerSubtitle: {
    fontSize: font.size.base,
    color: color.inkSecondary,
  },
  // Summary metrics
  summaryMetricsRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  statusBigCard: {
    flex: 2,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  statusBigLabel: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    marginBottom: 4,
  },
  statusBigSub: {
    fontSize: font.size.xs,
    color: color.inkMuted,
    marginBottom: space.md,
  },
  statusCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  statusCountItem: {
    alignItems: 'center',
  },
  statusCountNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  statusCountLabel: {
    fontSize: 10,
    color: color.inkMuted,
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusCountDivider: {
    width: 1,
    height: 30,
    backgroundColor: color.surfaceBorder,
  },
  authCard: {
    flex: 1,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.xs,
  },
  authCardTitle: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: color.inkSecondary,
  },
  authScore: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 2,
  },
  authSub: {
    fontSize: 10,
    color: color.inkMuted,
    marginBottom: space.sm,
  },
  authBar: {
    height: 6,
    backgroundColor: color.surfaceHover,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  authBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  authBarLabel: {
    fontSize: 11,
    color: color.inkSecondary,
    fontWeight: font.weight.medium,
  },
  // Meta info
  metaCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    marginBottom: space.xl,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: font.weight.bold,
    color: color.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: font.weight.semibold,
    color: color.ink,
  },
  sectionHeader: {
    marginBottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: color.ink,
  },
  // Fields table
  fieldsCard: {
    padding: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: space.xl,
  },
  fieldRow: {
    flexDirection: 'row',
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.surfaceBorder,
    gap: space.md,
    alignItems: 'flex-start',
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldStatusCol: {
    minWidth: 110,
  },
  fieldName: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: color.ink,
    marginBottom: 2,
  },
  fieldExtracted: {
    fontSize: font.size.sm,
    color: color.inkSecondary,
    marginBottom: 2,
  },
  fieldRuleRef: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: color.primary,
    marginBottom: 2,
  },
  confidenceBadge: {
    alignItems: 'center',
    minWidth: 48,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: font.weight.bold,
    color: color.inkSecondary,
  },
  confidenceLabel: {
    fontSize: 10,
    color: color.inkMuted,
    textTransform: 'uppercase',
  },
  violationBox: {
    backgroundColor: color.dangerBg,
    borderColor: color.dangerBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.sm,
  },
  violationTitle: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    color: color.danger,
    marginBottom: 2,
  },
  violationText: {
    fontSize: font.size.sm,
    color: color.danger,
    lineHeight: 20,
  },
  // Inspector Notes
  notesCard: {
    padding: space.md,
    borderRadius: radius.lg,
    marginBottom: space.xl,
    gap: space.sm,
  },
  notesInput: {
    backgroundColor: color.surfaceHover,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: font.size.base,
    color: color.ink,
    minHeight: 88,
  },
  saveNoteBtn: {
    alignSelf: 'flex-end',
    backgroundColor: color.primary,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
  },
  saveNoteBtnText: {
    color: '#FFFFFF',
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.xl,
    flexWrap: 'wrap',
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: space.md,
    borderRadius: radius.full,
    minWidth: 160,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.bold,
    fontSize: font.size.base,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: color.primary,
    paddingVertical: space.md,
    borderRadius: radius.full,
    alignItems: 'center',
    minWidth: 160,
  },
  primaryActionText: {
    color: color.inkInverse,
    fontWeight: font.weight.semibold,
    fontSize: font.size.base,
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.surfaceBorderDark,
    paddingVertical: space.md,
    borderRadius: radius.full,
    alignItems: 'center',
    minWidth: 160,
  },
  secondaryActionText: {
    color: color.inkSecondary,
    fontWeight: font.weight.semibold,
    fontSize: font.size.base,
  },
});
