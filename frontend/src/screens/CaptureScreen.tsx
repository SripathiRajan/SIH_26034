import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import GlassCard from '../components/GlassCard';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { api } from '../api/client';
import { color, font, space, radius } from '../theme/tokens';
import { MergedCoverage } from '../types';
import { captureFromDeviceCamera } from '../utils/webCameraHelper';

interface Props {
  navigation: any;
}

export interface CapturedViewItem {
  id: string;
  uri: string;
  angleLabel?: string;
  analyzed?: boolean;
  selected?: boolean;
}

/* Vector SVG Icons */
function UploadIcon({ color: c = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Line x1="12" y1="3" x2="12" y2="15" />
    </Svg>
  );
}

function CameraIcon({ color: c = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

function CheckIcon({ color: c = '#10B981', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function TrashIcon({ color: c = '#EF4444', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

const STATUTORY_DECLARATIONS = [
  { key: 'net_quantity', label: 'Net Quantity', section: 'Rule 6(1)(c)' },
  { key: 'mrp', label: 'Maximum Retail Price (MRP)', section: 'Rule 6(1)(e)' },
  { key: 'manufacturer', label: 'Manufacturer / Packer', section: 'Rule 6(1)(a)' },
  { key: 'manufacture_date', label: 'Date of Mfg / Pkg', section: 'Rule 6(1)(d)' },
  { key: 'use_by', label: 'Use By / Best Before', section: 'Rule 6(1)(da)' },
  { key: 'consumer_care', label: 'Consumer Helpline', section: 'Rule 6(2)' },
  { key: 'fssai', label: 'FSSAI License No.', section: 'FSSAI 2.1' },
  { key: 'country_of_origin', label: 'Country of Origin', section: 'Rule 6(1)(aa)' },
];

export default function CaptureScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Multi-photo session state
  const [capturedViews, setCapturedViews] = useState<CapturedViewItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mergedCoverage, setMergedCoverage] = useState<MergedCoverage | null>(null);
  const [coverageFields, setCoverageFields] = useState<Record<string, any> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Helper: check slots left in current batch (max 6 images total)
  const remainingSlots = Math.max(0, 6 - capturedViews.length);

  // 1. Take Photo with Device Camera (works over plain HTTP on mobile browsers and native)
  const handleTakePhoto = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Batch Full', 'Maximum 6 photos allowed per batch. Please analyze or remove views before adding more.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const uri = await captureFromDeviceCamera();
        if (uri) {
          setCapturedViews((prev) => [
            ...prev,
            {
              id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              uri,
              angleLabel: `Photo ${prev.length + 1}`,
              analyzed: false,
              selected: true,
            },
          ]);
        }
      } catch (e) {
        console.warn('[CaptureScreen] Camera capture failed:', e);
      }
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newView: CapturedViewItem = {
          id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          uri: result.assets[0].uri,
          angleLabel: `Photo ${capturedViews.length + 1}`,
          analyzed: false,
          selected: true,
        };
        setCapturedViews((prev) => [...prev, newView]);
      }
    } catch (e) {
      console.warn('[CaptureScreen] Native camera capture failed:', e);
    }
  };

  // 2. Pick Multiple Images from Gallery (up to remaining slots)
  const handlePickGallery = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Batch Full', 'Maximum 6 photos allowed per batch. Please analyze or remove existing photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const addedViews: CapturedViewItem[] = result.assets.slice(0, remainingSlots).map((asset, i) => ({
          id: `view-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          uri: asset.uri,
          angleLabel: `Photo ${capturedViews.length + i + 1}`,
          analyzed: false,
          selected: true,
        }));
        setCapturedViews((prev) => [...prev, ...addedViews]);
      }
    } catch (e) {
      console.warn('[CaptureScreen] Pick gallery failed:', e);
    }
  };

  // Remove single view from cart
  const handleRemoveView = (viewId: string) => {
    if (sessionId) {
      api.discardSession(sessionId);
      setSessionId(null);
      setMergedCoverage(null);
      setCoverageFields(null);
      setCapturedViews((prev) =>
        prev.filter((v) => v.id !== viewId).map((v) => ({ ...v, analyzed: false }))
      );
      return;
    }
    setCapturedViews((prev) => prev.filter((v) => v.id !== viewId));
  };

  // Tap a thumbnail to include / exclude it from the analyze batch
  const handleToggleViewSelected = (viewId: string) => {
    setCapturedViews((prev) =>
      prev.map((v) => (v.id === viewId ? { ...v, selected: v.selected === false } : v))
    );
  };

  // Reset entire session
  const handleResetSession = () => {
    if (sessionId) {
      api.discardSession(sessionId);
    }
    setCapturedViews([]);
    setSessionId(null);
    setMergedCoverage(null);
    setCoverageFields(null);
    setAnalysisError(null);
  };

  // 3. Send captured photos for OCR Analysis
  const handleAnalyzeCapturedViews = async () => {
    const selectedViews = capturedViews.filter((v) => v.selected !== false);
    const imagesToUpload = selectedViews.map((v) => v.uri);

    if (imagesToUpload.length === 0) {
      Alert.alert('No Photos Selected', 'Select at least one photo (tap a thumbnail to include it).');
      return;
    }
    if (imagesToUpload.length > 6) {
      Alert.alert('Limit Exceeded', 'Maximum 6 photos can be uploaded in one batch.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await api.scanSession(imagesToUpload, sessionId || undefined);
      setSessionId(response.sessionId);
      setMergedCoverage(response.mergedCoverage);
      setCoverageFields(response.fields);
      setCapturedViews((prev) => prev.map((v) => ({ ...v, analyzed: true })));
    } catch (err: any) {
      console.warn('[CaptureScreen] scanSession error:', err);
      if (err?.code === 'MULTIPLE_PRODUCTS') {
        // The backend rejected and discarded this session: the batch contains
        // photos of more than one product. Keep the photos in the cart so the
        // officer can remove the other product's shots and re-analyze.
        setSessionId(null);
        setMergedCoverage(null);
        setCoverageFields(null);
        setCapturedViews((prev) => prev.map((v) => ({ ...v, analyzed: false })));
        setAnalysisError(err?.message || 'Photos of different products were uploaded in one batch.');
        Alert.alert(
          'Different Products Detected',
          err?.message ||
            'The uploaded photos appear to belong to more than one product. Remove the other product\'s photos and scan each product as a separate session.'
        );
      } else if (DEMO_MODE) {
        const demoSessId = sessionId || `demo-sess-${Date.now()}`;
        setSessionId(demoSessId);
        const isSecondBatch = capturedViews.length >= 2;
        setMergedCoverage({
          found: isSecondBatch
            ? ['net_quantity', 'mrp', 'manufacturer', 'manufacture_date', 'use_by', 'consumer_care', 'fssai', 'country_of_origin']
            : ['net_quantity', 'mrp', 'manufacturer', 'manufacture_date'],
          missing: isSecondBatch
            ? []
            : ['use_by', 'consumer_care', 'fssai', 'country_of_origin'],
          hintLine: isSecondBatch
            ? 'All mandatory statutory declarations detected across views.'
            : 'Capture remaining sides for consumer helpline, best before date, and FSSAI number.',
          allFound: isSecondBatch,
        });
        setCapturedViews((prev) => prev.map((v) => ({ ...v, analyzed: true })));
      } else {
        setAnalysisError(err?.message || 'Multi-photo scanning failed. Please check backend connection.');
        Alert.alert('Analysis Failed', err?.message || 'Could not analyze photos');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 4. Finalize Session into persistent ScanRecord via ProcessingScreen
  const handleFinalizeReport = () => {
    if (!sessionId) {
      Alert.alert('No Session', 'Please analyze photos before generating audit report.');
      return;
    }
    const uris = capturedViews.map((v) => v.uri);
    navigation.navigate('Processing', { sessionId, imageUris: uris });
  };

  const selectedCount = capturedViews.filter((v) => v.selected !== false).length;
  const unanalyzedCount = capturedViews.filter((v) => !v.analyzed).length;
  const foundCount = mergedCoverage ? mergedCoverage.found.length : 0;
  const totalMandatory = STATUTORY_DECLARATIONS.length;

  return (
    <View style={{ flex: 1 }}>
      <DemoBanner />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}
      >
        {/* Navigation Bar */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.tagBadgeRow}>
            <Text style={styles.tagBadge}>MULTI-PHOTO INSPECTION</Text>
            {sessionId && <Text style={styles.sessionActiveBadge}>Session: {sessionId.slice(0, 12)}...</Text>}
          </View>
          <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>Multi-Angle Photo Capture</Text>
          <Text style={styles.headerSubtitle}>
            Capture photos of all package sides (front, back, MRP panel, flaps) manually, then send them together for statutory compliance OCR.
          </Text>
        </View>

        {/* Capture Action Card */}
        <GlassCard style={styles.dropZoneCard}>
          <View style={styles.dropZoneInner}>
            <View style={styles.iconCircle}>
              <CameraIcon color={color.primary} size={24} />
            </View>

            <Text style={styles.dropTitle}>Capture Package Photos (1 to 6)</Text>
            <Text style={styles.dropSubtitle}>
              Tap "Take Photo" to snap each angle directly using your phone's camera, or pick existing photos from your gallery.
            </Text>

            {/* Action Buttons */}
            <View style={[styles.actionButtonGroup, isMobile && styles.actionButtonGroupMobile]}>
              <TouchableOpacity
                style={[styles.cameraBtn, remainingSlots <= 0 && styles.btnDisabled]}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
                disabled={remainingSlots <= 0}
              >
                <CameraIcon color="#FFFFFF" size={17} />
                <Text style={styles.cameraBtnText}>
                  Take Photo {remainingSlots > 0 ? `(${capturedViews.length}/6)` : '(Full)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryUploadBtn, remainingSlots <= 0 && styles.btnDisabled]}
                onPress={handlePickGallery}
                activeOpacity={0.8}
                disabled={remainingSlots <= 0}
              >
                <UploadIcon color="#FFFFFF" size={17} />
                <Text style={styles.primaryUploadBtnText}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.slotsHintText}>
              {remainingSlots > 0
                ? `${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'} can be added to this batch`
                : 'Maximum batch of 6 photos reached'}
            </Text>
          </View>
        </GlassCard>

        {/* Error Banner */}
        {analysisError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{analysisError}</Text>
          </View>
        )}

        {/* ── CAPTURE CART (Thumbnails & Actions) ───────────────────── */}
        {capturedViews.length > 0 && (
          <GlassCard style={styles.cartCard}>
            <View style={styles.cartHeaderRow}>
              <View>
                <Text style={styles.cartTitle}>Captured Photos ({capturedViews.length}/6)</Text>
                <Text style={styles.cartSubtitle}>
                  {unanalyzedCount > 0
                    ? `${unanalyzedCount} new photo(s) ready to analyze`
                    : 'All captured photos analyzed'}
                </Text>
              </View>

              <TouchableOpacity onPress={handleResetSession} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {/* Thumbnail Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScrollView}>
              <View style={styles.thumbRow}>
                {capturedViews.map((item, idx) => {
                  const isSelected = item.selected !== false;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.thumbContainer,
                        !isSelected && { opacity: 0.35 },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleToggleViewSelected(item.id)}
                    >
                      <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
                      <View style={styles.thumbLabelBar}>
                        <Text style={styles.thumbLabelText}>
                          {item.angleLabel || `Photo ${idx + 1}`}
                        </Text>
                      </View>

                      {item.analyzed ? (
                        <View style={styles.analyzedBadge}>
                          <CheckIcon color="#FFFFFF" size={10} />
                          <Text style={styles.analyzedBadgeText}>Done</Text>
                        </View>
                      ) : null}

                      {!isSelected && (
                        <View style={styles.excludedBadge}>
                          <Text style={styles.excludedBadgeText}>Excluded</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.removeThumbBtn}
                        onPress={() => handleRemoveView(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <TrashIcon color="#FFFFFF" size={12} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={styles.reviewHintText}>
              Tap any photo to include or exclude it from OCR analysis.
            </Text>

            {/* Big Send for OCR Analysis Button */}
            <View style={styles.cartActionRow}>
              <TouchableOpacity
                style={[
                  styles.analyzeCartBtn,
                  isAnalyzing && { opacity: 0.65 },
                  selectedCount === 0 && styles.btnDisabled,
                ]}
                onPress={handleAnalyzeCapturedViews}
                disabled={isAnalyzing || selectedCount === 0}
                activeOpacity={0.85}
              >
                {isAnalyzing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.analyzeCartBtnText}>Processing OCR & Statutory Rules…</Text>
                  </View>
                ) : (
                  <Text style={styles.analyzeCartBtnText}>
                    Send {selectedCount} Photo{selectedCount === 1 ? '' : 's'} for OCR Analysis →
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* ── STATUTORY COVERAGE CARD ───────────────────────────── */}
        {mergedCoverage && (
          <GlassCard style={[styles.coverageCard, mergedCoverage.allFound && styles.coverageCardComplete]}>
            <View style={styles.coverageHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.coverageTitle}>Statutory Field Coverage</Text>
                  <View
                    style={[
                      styles.coverageScoreBadge,
                      mergedCoverage.allFound ? styles.scoreBadgePass : styles.scoreBadgePending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.coverageScoreText,
                        mergedCoverage.allFound ? styles.scoreTextPass : styles.scoreTextPending,
                      ]}
                    >
                      {foundCount} / {totalMandatory} Declarations
                    </Text>
                  </View>
                </View>

                <Text style={styles.coverageHintText}>
                  {mergedCoverage.hintLine || 'Keep rotating package to capture remaining statutory labels.'}
                </Text>
              </View>
            </View>

            {/* Declarations Grid */}
            <View style={styles.declarationGrid}>
              {STATUTORY_DECLARATIONS.map((decl) => {
                const isFound = mergedCoverage.found.includes(decl.key);
                const extracted = coverageFields && coverageFields[decl.key];
                const valText = extracted?.value ? String(extracted.value).slice(0, 20) : '';

                return (
                  <View
                    key={decl.key}
                    style={[styles.declPill, isFound ? styles.declPillFound : styles.declPillMissing]}
                  >
                    <View style={[styles.declDot, isFound ? styles.declDotFound : styles.declDotMissing]}>
                      {isFound ? (
                        <CheckIcon color="#FFFFFF" size={10} />
                      ) : (
                        <View style={styles.emptyDot} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.declLabel, isFound && styles.declLabelFound]} numberOfLines={1}>
                        {decl.label}
                      </Text>
                      <Text style={styles.declSection}>{valText || decl.section}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Final Action: Generate Official Audit Report */}
            <View style={styles.finalizeSection}>
              {mergedCoverage.allFound ? (
                <View style={styles.completeBanner}>
                  <Text style={styles.completeBannerTitle}>✔ All Mandatory Declarations Detected</Text>
                  <Text style={styles.completeBannerSub}>
                    Package declarations successfully verified across angles. Finalize to produce the legal audit report.
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.finalizeReportBtn,
                  mergedCoverage.allFound ? styles.finalizeBtnReady : styles.finalizeBtnPartial,
                ]}
                onPress={handleFinalizeReport}
                activeOpacity={0.85}
              >
                <Text style={styles.finalizeReportBtnText}>
                  {mergedCoverage.allFound
                    ? 'Generate Official Audit Report →'
                    : 'Finalize Current Inspection Report →'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* ── STATUTORY INSPECTION CHECKLIST ───────────── */}
        <View style={styles.checklistSection}>
          <Text style={styles.checklistHeading}>STATUTORY DECLARATIONS CHECKLIST · PCR 2011</Text>
          <View style={styles.checkGrid}>
            <View style={styles.checkItem}>
              <Text style={styles.checkTag}>Rule 6(1)(c)</Text>
              <Text style={styles.checkText}>Standard Net Quantity declaration in metric units (g, kg, ml, l)</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkTag}>Rule 6(1)(e)</Text>
              <Text style={styles.checkText}>Maximum Retail Price (MRP) explicitly inclusive of all taxes</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkTag}>Rule 6(1)(a)</Text>
              <Text style={styles.checkText}>Complete manufacturer / packer name, factory address & pin code</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkTag}>Rule 6(2)</Text>
              <Text style={styles.checkText}>Consumer helpline email and phone number on principal display panel</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  contentContainer: {
    padding: space.lg,
    maxWidth: 920,
    alignSelf: 'center',
    width: '100%',
  },
  mobileContent: {
    padding: space.md,
    paddingBottom: 96,
  },
  navHeader: {
    marginBottom: space.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
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
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  tagBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  tagBadge: {
    fontSize: 10,
    fontWeight: font.weight.bold,
    color: color.primary,
    backgroundColor: color.primaryLight,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  sessionActiveBadge: {
    fontSize: 10,
    fontWeight: font.weight.medium,
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  headerTitle: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.ink,
    marginBottom: space.xs,
  },
  headerSubtitle: {
    fontSize: font.size.base,
    color: color.inkSecondary,
    lineHeight: 22,
  },
  dropZoneCard: {
    padding: space.xl,
    borderRadius: radius.xl,
    marginBottom: space.lg,
    borderWidth: 1.5,
    borderColor: color.primaryBorder,
    backgroundColor: color.surface,
  },
  dropZoneInner: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.primaryLight,
    borderWidth: 1,
    borderColor: color.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.md,
  },
  dropTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: color.ink,
    marginBottom: space.xs,
    textAlign: 'center',
  },
  dropSubtitle: {
    fontSize: font.size.sm,
    color: color.inkSecondary,
    maxWidth: 540,
    textAlign: 'center',
    marginBottom: space.lg,
    lineHeight: 20,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  actionButtonGroupMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
  },
  cameraBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 200,
    elevation: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cameraBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.bold,
    fontSize: font.size.base,
  },
  primaryUploadBtn: {
    backgroundColor: color.primary,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 200,
    elevation: 2,
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  primaryUploadBtnText: {
    color: color.inkInverse,
    fontWeight: font.weight.bold,
    fontSize: font.size.base,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  slotsHintText: {
    fontSize: font.size.xs,
    color: color.inkMuted,
    marginTop: space.md,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
    borderWidth: 1,
    padding: space.md,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: font.size.sm,
  },

  /* Cart Styles */
  cartCard: {
    padding: space.lg,
    borderRadius: radius.xl,
    marginBottom: space.lg,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  cartTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
    color: color.ink,
  },
  cartSubtitle: {
    fontSize: font.size.xs,
    color: color.inkSecondary,
    marginTop: 2,
  },
  resetBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  resetBtnText: {
    fontSize: font.size.xs,
    color: '#EF4444',
    fontWeight: font.weight.semibold,
  },
  thumbScrollView: {
    marginBottom: space.md,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  thumbContainer: {
    width: 104,
    height: 128,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: color.surfaceBorder,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbLabelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  thumbLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: font.weight.medium,
  },
  analyzedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  analyzedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: font.weight.bold,
  },
  removeThumbBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  excludedBadge: {
    position: 'absolute',
    bottom: 22,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  excludedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: font.weight.bold,
  },
  reviewHintText: {
    fontSize: font.size.xs,
    color: color.inkMuted,
    marginBottom: space.md,
  },
  cartActionRow: {
    marginTop: space.xs,
  },
  analyzeCartBtn: {
    backgroundColor: color.primary,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: color.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  analyzeCartBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.bold,
    fontSize: font.size.base,
  },

  /* Coverage UI Styles */
  coverageCard: {
    padding: space.lg,
    borderRadius: radius.xl,
    marginBottom: space.lg,
    borderColor: color.primaryBorder,
    borderWidth: 1.5,
  },
  coverageCardComplete: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  coverageHeaderRow: {
    marginBottom: space.md,
  },
  coverageTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
    color: color.ink,
  },
  coverageScoreBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  scoreBadgePass: {
    backgroundColor: '#DCFCE7',
  },
  scoreBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  coverageScoreText: {
    fontSize: 11,
    fontWeight: font.weight.bold,
  },
  scoreTextPass: {
    color: '#15803D',
  },
  scoreTextPending: {
    color: '#B45309',
  },
  coverageHintText: {
    fontSize: font.size.xs,
    color: color.inkSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  declarationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginBottom: space.lg,
  },
  declPill: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  declPillFound: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  declPillMissing: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  declDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declDotFound: {
    backgroundColor: '#10B981',
  },
  declDotMissing: {
    backgroundColor: '#CBD5E1',
  },
  emptyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  declLabel: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: '#64748B',
  },
  declLabelFound: {
    color: '#0F172A',
  },
  declSection: {
    fontSize: 10,
    color: color.inkMuted,
  },
  finalizeSection: {
    marginTop: space.xs,
  },
  completeBanner: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    padding: space.md,
    borderRadius: radius.lg,
    marginBottom: space.sm,
  },
  completeBannerTitle: {
    color: '#15803D',
    fontWeight: font.weight.bold,
    fontSize: font.size.sm,
  },
  completeBannerSub: {
    color: '#166534',
    fontSize: font.size.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  finalizeReportBtn: {
    paddingVertical: space.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalizeBtnReady: {
    backgroundColor: '#059669',
  },
  finalizeBtnPartial: {
    backgroundColor: color.primary,
  },
  finalizeReportBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.bold,
    fontSize: font.size.sm,
  },

  /* Checklist Styles */
  checklistSection: {
    marginTop: space.sm,
  },
  checklistHeading: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    color: color.inkMuted,
    marginBottom: space.md,
  },
  checkGrid: {
    gap: space.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  checkTag: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    color: color.primary,
    backgroundColor: color.primaryLight,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  checkText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: color.ink,
    flex: 1,
  },
});
