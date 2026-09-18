import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import GlassCard from '../components/GlassCard';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { api } from '../api/client';
import { color, font, space, radius } from '../theme/tokens';
import { MergedCoverage } from '../types';

interface Props {
  navigation: any;
}

export interface CapturedViewItem {
  id: string;
  uri: string;
  angleLabel?: string;
  analyzed?: boolean;
}

/* Vector SVG Icons */
function UploadIcon({ color: c = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Line x1="12" y1="3" x2="12" y2="15" />
    </Svg>
  );
}

function CameraIcon({ color: c = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

function VideoScanIcon({ color: c = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="4" width="20" height="16" rx="3" />
      <Path d="M2 10h20" />
      <Circle cx="7" cy="7" r="1.5" fill={c} />
      <Circle cx="11" cy="7" r="1.5" fill={c} />
    </Svg>
  );
}

function ZapIcon({ color: c = '#475569', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
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
  { key: 'net_quantity', label: 'Net Quantity', section: '§6(1)(c)' },
  { key: 'mrp', label: 'Maximum Retail Price (MRP)', section: '§6(1)(e)' },
  { key: 'manufacturer', label: 'Manufacturer / Packer', section: '§6(1)(a)' },
  { key: 'manufacture_date', label: 'Date of Mfg / Pkg', section: '§6(1)(d)' },
  { key: 'use_by', label: 'Use By / Best Before', section: '§6(1)(da)' },
  { key: 'consumer_care', label: 'Consumer Helpline', section: '§6(2)' },
  { key: 'fssai', label: 'FSSAI License No.', section: 'FSS §2.1' },
  { key: 'country_of_origin', label: 'Country of Origin', section: '§6(1)(aa)' },
];

export default function CaptureScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Multi-angle session state
  const [capturedViews, setCapturedViews] = useState<CapturedViewItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mergedCoverage, setMergedCoverage] = useState<MergedCoverage | null>(null);
  const [coverageFields, setCoverageFields] = useState<Record<string, any> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Live video stream modal state
  const [isVideoScanOpen, setIsVideoScanOpen] = useState(false);
  const [scanSide, setScanSide] = useState<'front' | 'back' | 'full'>('front');
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Helper: check slots left in current batch (max 6 images total)
  const remainingSlots = Math.max(0, 6 - capturedViews.length);

  // 1. Pick Multiple Images from Gallery (Max 6 limit enforced)
  const handlePickGallery = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Batch Full', 'Maximum 6 views allowed per batch. Please analyze or remove existing views.');
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
          angleLabel: `Angle ${capturedViews.length + i + 1}`,
          analyzed: false,
        }));
        setCapturedViews((prev) => [...prev, ...addedViews]);
      }
    } catch (e) {
      console.warn('[CaptureScreen] Pick gallery failed:', e);
    }
  };

  // 2. Take Live Photo via Camera (Adds to cart, does NOT navigate immediately)
  const handleTakePhoto = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Batch Full', 'Maximum 6 views allowed per batch. Please analyze or remove views before adding more.');
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture live package photos.');
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
          angleLabel: `Angle ${capturedViews.length + 1}`,
          analyzed: false,
        };
        setCapturedViews((prev) => [...prev, newView]);
      }
    } catch (e) {
      console.warn('[CaptureScreen] Camera capture failed:', e);
    }
  };

  // 3. Live Video Scanner Viewfinder
  const startLiveVideoStream = async () => {
    if (Platform.OS !== 'web') {
      // Native: real camera preview via expo-camera
      let granted = Boolean(cameraPermission?.granted);
      if (!granted) {
        const res = await requestCameraPermission();
        granted = Boolean(res?.granted);
      }
      if (!granted) {
        Alert.alert('Permission Required', 'Camera permission is required for the live viewfinder.');
        return;
      }
      setIsVideoScanOpen(true);
      return;
    }

    setIsVideoScanOpen(true);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }, 100);
      } catch (err) {
        console.warn('Camera stream notice:', err);
      }
    }
  };

  const stopLiveVideoStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
    }
    setIsVideoScanOpen(false);
  };

  const handleCaptureVideoFrame = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Batch Full', 'Maximum 6 views allowed per batch. Please analyze or remove views.');
      stopLiveVideoStream();
      return;
    }

    let capturedUri = '';
    if (Platform.OS === 'web' && videoRef.current) {
      // Guard: ensure the stream is actually attached and video dimensions are ready
      // (fixes 100ms race where srcObject may not be set yet after getUserMedia)
      if (!videoRef.current.srcObject || videoRef.current.videoWidth === 0) {
        Alert.alert('Camera Not Ready', 'Please wait a moment for the camera preview to load, then try again.');
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          capturedUri = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {
        console.warn('Canvas frame capture fallback', e);
      }

    } else if (Platform.OS !== 'web' && cameraRef.current) {
      // Native: full-resolution still from the expo-camera preview
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
        capturedUri = photo?.uri || '';
      } catch (e) {
        console.warn('Native frame capture failed', e);
      }
    }

    stopLiveVideoStream();

    if (capturedUri) {
      setCapturedViews((prev) => [
        ...prev,
        {
          id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          uri: capturedUri,
          angleLabel: scanSide === 'front' ? 'Front' : scanSide === 'back' ? 'Back / MRP' : '360°',
          analyzed: false,
        },
      ]);
    }
  };

  // Remove single view from cart.
  // If a backend session exists, discard it and reset state so the next
  // Analyze starts a fresh session consistent with the updated cart.
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

  // Reset entire session (discards backend session so temp files don't linger)
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

  // 4. Multi-Angle Analysis: upload captured views using api.scanSession()
  const handleAnalyzeCapturedViews = async () => {
    // Collect views to analyze (all views in cart up to 6)
    const unanalyzed = capturedViews.filter((v) => !v.analyzed);
    const imagesToUpload = unanalyzed.length > 0 ? unanalyzed.map((v) => v.uri) : capturedViews.map((v) => v.uri);

    if (imagesToUpload.length === 0) {
      Alert.alert('No Images', 'Please capture or select package angles first.');
      return;
    }
    if (imagesToUpload.length > 6) {
      Alert.alert('Limit Exceeded', 'Maximum 6 images can be uploaded in one batch.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      // Always await the upload/session operation before updating dependent state
      const response = await api.scanSession(imagesToUpload, sessionId || undefined);

      setSessionId(response.sessionId);
      setMergedCoverage(response.mergedCoverage);
      setCoverageFields(response.fields);
      // Mark all current views as analyzed
      setCapturedViews((prev) => prev.map((v) => ({ ...v, analyzed: true })));
    } catch (err: any) {
      console.warn('[CaptureScreen] scanSession error:', err);
      if (DEMO_MODE) {
        // Fallback for demo mode
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
            : 'Rotate package to scan consumer helpline, best before date, and FSSAI number.',
          allFound: isSecondBatch,
        });
        setCapturedViews((prev) => prev.map((v) => ({ ...v, analyzed: true })));
      } else {
        setAnalysisError(err?.message || 'Multi-angle scanning failed. Please check backend connection.');
        Alert.alert('Analysis Failed', err?.message || 'Could not analyze views');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5. Finalize Session into persistent ScanRecord via ProcessingScreen
  const handleFinalizeReport = () => {
    if (!sessionId) {
      Alert.alert('No Session', 'Please analyze views before generating audit report.');
      return;
    }
    const uris = capturedViews.map((v) => v.uri);
    navigation.navigate('Processing', { sessionId, imageUris: uris });
  };

  // 6. Secondary / Legacy Direct Single Scan
  const handleQuickSingleScan = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        navigation.navigate('Processing', { imageUri: result.assets[0].uri });
      }
    } catch (e) {
      navigation.navigate('Processing', { imageUri: '' });
    }
  };

  const handleDemoScan = () => {
    if (!DEMO_MODE) return;
    navigation.navigate('Processing', { imageUri: '' });
  };

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
            <Text style={styles.tagBadge}>MULTI-ANGLE PACKAGE SCAN</Text>
            {sessionId && <Text style={styles.sessionActiveBadge}>Session: {sessionId.slice(0, 12)}...</Text>}
          </View>
          <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>Package Angle & Panel Capture</Text>
          <Text style={styles.headerSubtitle}>
            Capture multiple package sides (front, back, flaps, MRP panel) to verify all 8 mandatory Legal Metrology declarations.
          </Text>
        </View>

        {/* Capture Drop Zone Card */}
        <GlassCard style={styles.dropZoneCard}>
          <View style={styles.dropZoneInner}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconCircleText}>SCAN</Text>
            </View>

            <Text style={styles.dropTitle}>Capture Packaging Views (1 to 6)</Text>
            <Text style={styles.dropSubtitle}>
              Select photos from gallery or capture live package panels. Views are processed sequentially to guarantee compliance.
            </Text>

            {/* Action Button Group */}
            <View style={[styles.actionButtonGroup, isMobile && styles.actionButtonGroupMobile]}>
              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
                disabled={remainingSlots <= 0}
              >
                <CameraIcon color="#FFFFFF" size={15} />
                <Text style={styles.cameraBtnText}>Capture Camera Angle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryUploadBtn}
                onPress={handlePickGallery}
                activeOpacity={0.8}
                disabled={remainingSlots <= 0}
              >
                <UploadIcon color="#FFFFFF" size={15} />
                <Text style={styles.primaryUploadBtnText}>
                  Choose Photos ({remainingSlots > 0 ? `Max ${remainingSlots}` : 'Full'})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.videoScanBtn}
                onPress={startLiveVideoStream}
                activeOpacity={0.8}
                disabled={remainingSlots <= 0}
              >
                <VideoScanIcon color="#FFFFFF" size={15} />
                <Text style={styles.videoScanBtnText}>Live Viewfinder</Text>
              </TouchableOpacity>
            </View>

            {/* Secondary Legacy / Quick Scan Link */}
            <View style={styles.secondaryLinksRow}>
              <TouchableOpacity onPress={handleQuickSingleScan} style={styles.secondaryLinkBtn}>
                <Text style={styles.secondaryLinkText}>Single-Image Quick Scan (Legacy)</Text>
              </TouchableOpacity>

              {DEMO_MODE && (
                <TouchableOpacity onPress={handleDemoScan} style={styles.demoLinkBtn}>
                  <ZapIcon color={color.primary} size={13} />
                  <Text style={styles.demoLinkText}>Demo Scan</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </GlassCard>

        {/* Error Banner */}
        {analysisError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{analysisError}</Text>
          </View>
        )}

        {/* ── 1. CAPTURE CART (Thumbnails & Actions) ───────────────────── */}
        {capturedViews.length > 0 && (
          <GlassCard style={styles.cartCard}>
            <View style={styles.cartHeaderRow}>
              <View>
                <Text style={styles.cartTitle}>Captured Package Views ({capturedViews.length}/6)</Text>
                <Text style={styles.cartSubtitle}>
                  {unanalyzedCount > 0
                    ? `${unanalyzedCount} new view(s) ready to analyze`
                    : 'All captured views analyzed across package'}
                </Text>
              </View>

              <TouchableOpacity onPress={handleResetSession} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {/* Thumbnails Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScrollView}>
              <View style={styles.thumbRow}>
                {capturedViews.map((item, idx) => (
                  <View key={item.id} style={styles.thumbContainer}>
                    <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
                    <View style={styles.thumbLabelBar}>
                      <Text style={styles.thumbLabelText}>{item.angleLabel || `Angle ${idx + 1}`}</Text>
                    </View>

                    {item.analyzed ? (
                      <View style={styles.analyzedBadge}>
                        <CheckIcon color="#FFFFFF" size={10} />
                        <Text style={styles.analyzedBadgeText}>Done</Text>
                      </View>
                    ) : (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.removeThumbBtn}
                      onPress={() => handleRemoveView(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <TrashIcon color="#FFFFFF" size={12} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Cart Primary Action Button */}
            <View style={styles.cartActionRow}>
              <TouchableOpacity
                style={[
                  styles.analyzeCartBtn,
                  isAnalyzing && { opacity: 0.65 },
                  capturedViews.length === 0 && { backgroundColor: color.surfaceBorder },
                ]}
                onPress={handleAnalyzeCapturedViews}
                disabled={isAnalyzing || capturedViews.length === 0}
                activeOpacity={0.8}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.analyzeCartBtnText}>
                    {sessionId
                      ? `Analyze & Merge Views (${capturedViews.length})`
                      : `Analyze Captured Views (${capturedViews.length})`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* ── 2. LIVE MANDATORY COVERAGE UI ───────────────────────────── */}
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

            {/* Statutory Declaration Indicators Grid */}
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

            {/* Final Action: Generate Report when all found (or user chooses to finalize) */}
            <View style={styles.finalizeSection}>
              {mergedCoverage.allFound ? (
                <View style={styles.completeBanner}>
                  <Text style={styles.completeBannerTitle}>✔ All Mandatory Declarations Detected</Text>
                  <Text style={styles.completeBannerSub}>
                    Package meets Legal Metrology Rules, 2011. You can now finalize and generate the official audit report.
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
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.finalizeReportBtnText}>
                    {mergedCoverage.allFound
                      ? 'Generate Official Audit Report →'
                      : 'Finalize Current Inspection Report →'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* ── 3. STATUTORY INSPECTION CHECKLIST (Preserved) ───────────── */}
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

        {/* ── 4. LIVE VIDEO STREAM MODAL (Preserved) ─────────────────── */}
        <Modal visible={isVideoScanOpen} animationType="fade" transparent={true} onRequestClose={stopLiveVideoStream}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.liveDot} />
                  <Text style={styles.modalTitle}>Live Package Scanner</Text>
                </View>
                <TouchableOpacity onPress={stopLiveVideoStream} style={styles.closeModalBtn}>
                  <Text style={styles.closeModalText}>Close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.videoViewport}>
                {Platform.OS === 'web' ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 12 }}
                  />
                ) : (
                  <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={false}
                  />
                )}

                <View style={styles.targetReticle}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  <Text style={styles.reticleBadge}>AIM AT PACKAGE PANEL</Text>
                </View>
              </View>

              <View style={styles.sideSelectorRow}>
                <TouchableOpacity
                  style={[styles.sideChip, scanSide === 'front' && styles.sideChipActive]}
                  onPress={() => setScanSide('front')}
                >
                  <Text style={[styles.sideChipText, scanSide === 'front' && styles.sideChipTextActive]}>Front Panel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sideChip, scanSide === 'back' && styles.sideChipActive]}
                  onPress={() => setScanSide('back')}
                >
                  <Text style={[styles.sideChipText, scanSide === 'back' && styles.sideChipTextActive]}>Back / MRP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sideChip, scanSide === 'full' && styles.sideChipActive]}
                  onPress={() => setScanSide('full')}
                >
                  <Text style={[styles.sideChipText, scanSide === 'full' && styles.sideChipTextActive]}>360° View</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.captureFrameBtn} onPress={handleCaptureVideoFrame} activeOpacity={0.85}>
                  <Text style={styles.captureFrameBtnText}>Add View to Cart ({remainingSlots} left)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    borderStyle: 'dashed',
    borderWidth: 2,
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
  iconCircleText: {
    fontSize: 11,
    fontWeight: font.weight.bold,
    color: color.primary,
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
    gap: space.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonGroupMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
  },
  cameraBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.semibold,
    fontSize: font.size.sm,
  },
  primaryUploadBtn: {
    backgroundColor: color.primary,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryUploadBtnText: {
    color: color.inkInverse,
    fontWeight: font.weight.semibold,
    fontSize: font.size.sm,
  },
  videoScanBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoScanBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.semibold,
    fontSize: font.size.sm,
  },
  secondaryLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    marginTop: space.lg,
  },
  secondaryLinkBtn: {
    paddingVertical: space.xs,
  },
  secondaryLinkText: {
    fontSize: font.size.xs,
    color: color.inkMuted,
    textDecorationLine: 'underline',
  },
  demoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: space.xs,
  },
  demoLinkText: {
    fontSize: font.size.xs,
    color: color.primary,
    fontWeight: font.weight.semibold,
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
    fontWeight: font.weight.medium,
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
  newBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: color.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: font.weight.bold,
  },
  removeThumbBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  analyzeCartBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.bold,
    fontSize: font.size.sm,
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

  /* Checklist Styles (Preserved) */
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

  /* Video Modal Styles (Preserved) */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.md,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: space.lg,
    width: '100%',
    maxWidth: 640,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  modalTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: color.ink,
  },
  closeModalBtn: {
    padding: space.xs,
  },
  closeModalText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: color.inkMuted,
  },
  videoViewport: {
    height: 320,
    backgroundColor: '#0F172A',
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetReticle: {
    position: 'absolute',
    top: 40,
    bottom: 40,
    left: 40,
    right: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.6)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: font.weight.bold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    position: 'absolute',
    top: 12,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#3B82F6',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  sideSelectorRow: {
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
    marginVertical: space.md,
  },
  sideChip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: color.surfaceHover,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  sideChipActive: {
    backgroundColor: color.primaryLight,
    borderColor: color.primaryBorder,
  },
  sideChipText: {
    fontSize: font.size.xs,
    color: color.inkSecondary,
    fontWeight: font.weight.medium,
  },
  sideChipTextActive: {
    color: color.primary,
    fontWeight: font.weight.bold,
  },
  modalActionRow: {
    alignItems: 'center',
    marginTop: space.xs,
  },
  captureFrameBtn: {
    backgroundColor: color.primary,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    borderRadius: radius.full,
    width: '100%',
    alignItems: 'center',
  },
  captureFrameBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.bold,
    fontSize: font.size.base,
  },
});
