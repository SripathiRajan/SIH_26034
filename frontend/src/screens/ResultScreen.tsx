import React, { useState } from 'react';
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
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polygon } from 'react-native-svg';
import GlassCard from '../components/GlassCard';
import StatusPill from '../components/StatusPill';
import { color, font, space, radius } from '../theme/tokens';
import { recentScans } from '../data/mockData';
import { exportReportAsPdf } from '../services/reportExporter';

import DottedBackground from '../components/DottedBackground';
import LogoHeader from '../components/LogoHeader';

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

function ShareIcon({ col = '#FFFFFF', size = 15 }: { col?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="18" cy="5" r="3" />
      <Circle cx="6" cy="12" r="3" />
      <Circle cx="18" cy="19" r="3" />
      <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
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

  const scan = scanData || recentScans.find((s) => s.id === scanId) || recentScans[0];

  const violationCount = scan.fields?.filter((f: any) => f.status === 'fail').length ?? 0;
  const warningCount = scan.fields?.filter((f: any) => f.status === 'warning').length ?? 0;
  const passCount = scan.fields?.filter((f: any) => f.status === 'pass').length ?? 0;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportReportAsPdf(scan, 'Field Officer');
    } catch (e) {
      console.warn('Export error', e);
    }
    setExporting(false);
  };

  const handleSaveNote = () => {
    if (inspectorNote.trim()) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
  };

  const overallStatusColor =
    scan.status === 'pass' ? color.success : scan.status === 'fail' ? color.danger : color.warning;
  const overallStatusBg =
    scan.status === 'pass' ? color.successBg : scan.status === 'fail' ? color.dangerBg : color.warningBg;

  return (
    <DottedBackground>
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
      {/* Header Bar */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn} activeOpacity={0.7}>
          <BackIcon col={color.primary} size={14} />
          <Text style={styles.backBtnText}>Back to Overview</Text>
        </TouchableOpacity>
      </View>

      {/* Product Header Card */}
      <View style={[styles.header, isMobile && styles.mobileHeader]}>
        <View style={[styles.headerTop, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: space.sm }]}>
          {/* Product Image Thumbnail */}
          {scan.imageUri ? (
            <Image
              source={{ uri: scan.imageUri }}
              style={styles.productThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.productThumbPlaceholder, { backgroundColor: scan.thumbnailColor + '20' }]}>
              <Text style={[styles.productThumbInitial, { color: scan.thumbnailColor }]}>
                {(scan.brand || 'P').charAt(0)}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <Text style={styles.platformBadge}>INSPECTION REPORT · ID: {scan.id?.toUpperCase() || 'AUD-001'}</Text>
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

        {/* Authenticity Score */}
        <GlassCard style={styles.authCard}>
          <View style={styles.authCardHeader}>
            <ShieldIcon col={scan.authenticityScore >= 90 ? color.success : scan.authenticityScore >= 75 ? color.warning : color.danger} size={16} />
            <Text style={styles.authCardTitle}>Authenticity Score</Text>
          </View>
          <Text style={[styles.authScore, {
            color: scan.authenticityScore >= 90 ? color.success : scan.authenticityScore >= 75 ? color.warning : color.danger,
          }]}>
            {scan.authenticityScore}%
          </Text>
          <Text style={styles.authSub}>DINOv2 Visual Embedding Analysis</Text>
          <View style={styles.authBar}>
            <View style={[styles.authBarFill, {
              width: `${scan.authenticityScore}%`,
              backgroundColor: scan.authenticityScore >= 90 ? color.success : scan.authenticityScore >= 75 ? color.warning : color.danger,
            }]} />
          </View>
          <Text style={styles.authBarLabel}>
            {scan.authenticityScore >= 90 ? 'High Confidence — Genuine Product' :
              scan.authenticityScore >= 75 ? 'Moderate Confidence — Manual Review' :
              'Low Confidence — Possible Clone Risk'}
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
                  <Text style={styles.confidenceText}>{field.confidence?.toFixed(1)}%</Text>
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
          onPress={() => navigation.navigate('Assistant')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionText}>Ask Assistant About This Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryActionBtn}
          onPress={() => navigation.navigate('Capture')}
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
