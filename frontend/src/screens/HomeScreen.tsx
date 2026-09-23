import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import DemoBanner from '../components/DemoBanner';
import { useAuth } from '../context/AuthContext';
import { DEMO_MODE } from '../api/config';
import { api } from '../api/client';
import { MergedCoverage } from '../types';
import { captureFromDeviceCamera, compressImageFile } from '../utils/webCameraHelper';

interface Props {
  navigation: any;
}

export interface PackagePhoto {
  id: string;
  uri: string;
  name?: string;
}

export const STATUTORY_DECLARATIONS = [
  { key: 'net_quantity', label: 'Net Quantity', section: '§6(1)(c)' },
  { key: 'mrp', label: 'MRP', section: '§6(1)(e)' },
  { key: 'manufacturer', label: 'Manufacturer', section: '§6(1)(a)' },
  { key: 'manufacture_date', label: 'Mfg Date', section: '§6(1)(d)' },
  { key: 'use_by', label: 'Use By', section: '§6(1)(da)' },
  { key: 'consumer_care', label: 'Helpline', section: '§6(2)' },
  { key: 'fssai', label: 'FSSAI Lic.', section: 'FSS §2.1' },
  { key: 'country_of_origin', label: 'Origin', section: '§6(1)(aa)' },
];

/* Icons matching the mockup SVG definitions */
function UploadIcon({ size = 16, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Path d="M12 3v12" />
    </Svg>
  );
}

function CameraIcon({ size = 16, color = '#062E28' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

function LayersIcon({ size = 16, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2L2 7l10 5 10-5-10-5Z" />
      <Path d="M2 17l10 5 10-5" />
      <Path d="M2 12l10 5 10-5" />
    </Svg>
  );
}

function ScanVisualIcon({ size = 34, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="6" width="16" height="12" rx="1" />
      <Path d="M4 10h16M9 14h3" />
    </Svg>
  );
}

function CheckIcon({ size = 13, color = '#00C2A8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function CloseIcon({ size = 10, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function PlusIcon({ size = 16, color = '#00C2A8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

function TrashIcon({ size = 14, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

function RecordsIcon({ size = 19, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <Path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
      <Path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
      <Path d="M9 13h6M9 17h6" />
    </Svg>
  );
}

function RulesDbIcon({ size = 19, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <Path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />
    </Svg>
  );
}

function AnalyticsChartIcon({ size = 19, color = '#5A3B04' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3v18h18M8 17V9m5 8V5m5 12v-6" />
    </Svg>
  );
}

function AssistantChatIcon({ size = 19, color = '#06342C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </Svg>
  );
}

function ChevronRightIcon({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

function SignOutIcon({ size = 14, color = '#DC2626' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const { currentUser, logout } = useAuth();

  const handleSignOut = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to sign out of PRAMAN?')) {
        logout();
      }
    } else {
      Alert.alert(
        'Sign Out',
        `End the session for ${currentUser?.name || 'this user'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
        ]
      );
    }
  };

  // Toast state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastShow, setToastShow] = useState<boolean>(false);
  const toastTimer = useRef<any>(null);

  // Drag & drop state for web
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Multi-photo state for inline inspection
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);
  const [isAnalysing, setIsAnalysing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [mergedCoverage, setMergedCoverage] = useState<MergedCoverage | null>(null);
  const [coverageFields, setCoverageFields] = useState<Record<string, any> | null>(null);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);

  // Hidden multi-file input ref for web
  const multiFileInputRef = useRef<any>(null);

  // Inject Web Google Fonts
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('inspection-portal-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'inspection-portal-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
        document.head.appendChild(fontLink);
      }

      if (!document.getElementById('inspection-portal-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'inspection-portal-styles';
        styleTag.innerHTML = `
          .inspect-hero::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: radial-gradient(circle, rgba(255,255,255,.08) 1.5px, transparent 1.5px);
            background-size: 20px 20px;
            opacity: .5;
            pointer-events: none;
          }
          .inspect-hero::after {
            content: '';
            position: absolute;
            width: 340px; height: 340px;
            border-radius: 50%;
            background: radial-gradient(circle, #6C5CE7 0%, transparent 70%);
            opacity: .35;
            top: -140px; right: -100px;
            pointer-events: none;
          }
          .inspect-service-card {
            transition: transform .15s ease, box-shadow .15s ease;
          }
          .inspect-service-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 24px rgba(16,27,61,.08);
          }
          .inspect-service-card:active {
            transform: translateY(-1px) scale(.99);
          }
          .inspect-btn {
            transition: transform .1s ease, filter .12s ease;
          }
          .inspect-btn:active {
            transform: scale(.96);
          }
          .inspect-avatar:active {
            transform: scale(.9);
          }
        `;
        document.head.appendChild(styleTag);
      }
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastShow(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 1800);
  };

  // 1. Take photo via device camera (works over HTTP on web via webCameraHelper)
  const handleTakePhoto = async () => {
    if (photos.length >= 6) {
      Alert.alert('Batch Full', 'Maximum 6 photos allowed per package inspection.');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        const uri = await captureFromDeviceCamera();
        if (uri) {
          setPhotos((prev) => [
            ...prev,
            {
              id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              uri,
              name: `Photo ${prev.length + 1}`,
            },
          ]);
          setMergedCoverage(null);
          setCoverageFields(null);
          setScanSessionId(null);
          setAnalysisError(null);
        }
      } catch (e) {
        console.warn('[HomeScreen] Camera capture failed:', e);
      }
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera access is required to capture photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos((prev) => [
          ...prev,
          {
            id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            uri: result.assets[0].uri,
            name: `Photo ${prev.length + 1}`,
          },
        ]);
        setMergedCoverage(null);
        setCoverageFields(null);
        setScanSessionId(null);
        setAnalysisError(null);
      }
    } catch (e) {
      console.warn('[HomeScreen] Native camera error:', e);
    }
  };

  // 2. Pick multiple photos from gallery
  const handlePickGallery = async () => {
    const remaining = Math.max(0, 6 - photos.length);
    if (remaining <= 0) {
      Alert.alert('Batch Full', 'Maximum 6 photos allowed per package inspection.');
      return;
    }

    if (Platform.OS === 'web') {
      if (multiFileInputRef.current) {
        multiFileInputRef.current.click();
      }
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const added: PackagePhoto[] = result.assets.slice(0, remaining).map((asset, i) => ({
          id: `photo-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          uri: asset.uri,
          name: `Photo ${photos.length + i + 1}`,
        }));
        setPhotos((prev) => [...prev, ...added]);
        setMergedCoverage(null);
        setCoverageFields(null);
        setScanSessionId(null);
        setAnalysisError(null);
      }
    } catch (e) {
      console.warn('[HomeScreen] Gallery pick error:', e);
    }
  };

  // 3. Web multi-file input change handler (with client-side canvas compression to avoid OOM)
  const handleMultiWebFileChange = async (e: any) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const remaining = Math.max(0, 6 - photos.length);
      const filesToAdd = files.slice(0, remaining);

      for (const file of filesToAdd) {
        try {
          const uri = await compressImageFile(file, 1600, 0.82);
          if (uri) {
            setPhotos((prev) => {
              if (prev.length >= 6) return prev;
              return [
                ...prev,
                { id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, uri, name: file.name },
              ];
            });
          }
        } catch (err) {
          console.warn('[HomeScreen] Compress file fallback:', err);
          const reader = new FileReader();
          reader.onload = (event) => {
            const uri = event.target?.result as string;
            if (uri) {
              setPhotos((prev) => {
                if (prev.length >= 6) return prev;
                return [
                  ...prev,
                  { id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, uri, name: file.name },
                ];
              });
            }
          };
          reader.readAsDataURL(file);
        }
      }
      setMergedCoverage(null);
      setCoverageFields(null);
      setScanSessionId(null);
      setAnalysisError(null);
      e.target.value = '';
    }
  };

  // 4. Remove a photo
  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setMergedCoverage(null);
    setCoverageFields(null);
    setAnalysisError(null);
    if (scanSessionId) {
      api.discardSession(scanSessionId);
      setScanSessionId(null);
    }
  };

  // 5. Clear all photos
  const handleClearAll = () => {
    if (scanSessionId) {
      api.discardSession(scanSessionId);
    }
    setPhotos([]);
    setMergedCoverage(null);
    setCoverageFields(null);
    setScanSessionId(null);
    setAnalysisError(null);
  };

  // 6. Analyse captured photos with OCR — immediately redirects to inspection processing
  const handleAnalyse = () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please take or upload at least 1 photo.');
      return;
    }
    const uris = photos.map((p) => p.uri);
    navigation.navigate('Processing', {
      imageUris: uris,
      imageUri: uris[0],
      sessionId: scanSessionId || undefined,
    });
  };

  // 7. Navigate to Processing Screen to finalize and view full report
  const handleGenerateReport = () => {
    if (scanSessionId) {
      navigation.navigate('Processing', {
        sessionId: scanSessionId,
        imageUris: photos.map((p) => p.uri),
      });
    } else if (photos.length > 0) {
      navigation.navigate('Processing', {
        imageUri: photos[0].uri,
      });
    }
  };

  // 8. Web Drag and Drop
  const handleDragOver = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: any) => {
    if (Platform.OS === 'web') {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files) as File[];
        const remaining = Math.max(0, 6 - photos.length);
        const filesToAdd = files.slice(0, remaining);
        filesToAdd.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const uri = event.target?.result as string;
            if (uri) {
              setPhotos((prev) => {
                if (prev.length >= 6) return prev;
                return [
                  ...prev,
                  { id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, uri, name: file.name },
                ];
              });
            }
          };
          reader.readAsDataURL(file);
        });
        setMergedCoverage(null);
        setCoverageFields(null);
        setScanSessionId(null);
        setAnalysisError(null);
      }
    }
  };

  return (
    <View style={styles.bodyWrap}>
      <DemoBanner />
      {/* Hidden multi-file input for web */}
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={multiFileInputRef}
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleMultiWebFileChange}
        />
      )}

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.wrap}>
        {/* Topbar */}
        <View style={styles.topbar}>
          <TouchableOpacity
            style={styles.portalTag}
            onPress={() => showToast('Inspection Portal Active')}
            activeOpacity={0.8}
          >
            <View style={styles.dot} />
            <Text style={styles.portalTagText}>INSPECTION PORTAL</Text>
          </TouchableOpacity>

          <View style={styles.topbarRight}>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>USER</Text>
            </View>
            <TouchableOpacity
              style={styles.avatar}
              onPress={handleSignOut}
              activeOpacity={0.8}
              // @ts-ignore
              className="inspect-avatar"
            >
              <Text style={styles.avatarText}>
                {(currentUser?.name || currentUser?.id || 'USR')
                  .trim()
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 4)
                  .toUpperCase()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <SignOutIcon size={14} color="#EF4444" />
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        <View
          style={[styles.hero, isMobile && styles.heroMobile]}
          // @ts-ignore
          className="inspect-hero"
        >
          {/* Hero Left Copy */}
          <View style={[styles.heroCopy, isMobile && styles.heroCopyMobile]}>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>Legal Metrology compliance</Text>
            </View>
            <Text style={[styles.heroH1, isMobile && styles.heroH1Mobile]}>
              Scan any label. Know in seconds if it holds up.
            </Text>
            <Text style={[styles.heroP, isMobile && styles.heroPMobile]}>
              Capture or upload up to 6 package angles (Front, Back, MRP panel, FSSAI). Hit Analyse to run OCR instantly and inspect statutory declarations.
            </Text>

            <View style={[styles.actions, isMobile && styles.actionsMobile]}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionCamera, isMobile && styles.actionBtnMobile]}
                onPress={handleTakePhoto}
                activeOpacity={0.85}
                // @ts-ignore
                className="inspect-btn"
              >
                <CameraIcon size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Take photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionGallery, isMobile && styles.actionBtnMobile]}
                onPress={handlePickGallery}
                activeOpacity={0.85}
                // @ts-ignore
                className="inspect-btn"
              >
                <UploadIcon size={16} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Upload images</Text>
              </TouchableOpacity>

              {photos.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionClear, isMobile && styles.actionBtnMobile]}
                  onPress={handleClearAll}
                  activeOpacity={0.85}
                  // @ts-ignore
                  className="inspect-btn"
                >
                  <TrashIcon size={14} color="#FF7B7B" />
                  <Text style={styles.actionClearText}>Clear ({photos.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Hero Right Visual / Captured Views & Analysis Panel */}
          <View
            style={[
              styles.scanVisual,
              isMobile && styles.scanVisualMobile,
              isDragOver && styles.scanVisualDragOver,
              photos.length > 0 && styles.scanVisualWithPhotos,
            ]}
            // @ts-ignore
            onDragOver={handleDragOver}
            // @ts-ignore
            onDragLeave={handleDragLeave}
            // @ts-ignore
            onDrop={handleDrop}
          >
            {photos.length === 0 ? (
              <TouchableOpacity
                style={styles.scanTargetEmpty}
                onPress={handlePickGallery}
                activeOpacity={0.85}
              >
                <View style={styles.emptyIconCircle}>
                  <CameraIcon size={24} color="#00C2A8" />
                </View>
                <Text style={styles.emptyPromptTitle}>No package photos yet</Text>
                <Text style={styles.emptyPromptSub}>
                  {Platform.OS === 'web'
                    ? 'Click or drag & drop up to 6 angles'
                    : 'Tap Take photo or Upload images to add up to 6 views'}
                </Text>
                <View style={styles.emptyBadgeRow}>
                  <Text style={styles.emptyBadge}>Front</Text>
                  <Text style={styles.emptyBadge}>Back</Text>
                  <Text style={styles.emptyBadge}>MRP Panel</Text>
                  <Text style={styles.emptyBadge}>FSSAI</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.photosPanel}>
                {/* Header row with count & batch status */}
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.panelHeaderTitle}>
                    Captured Views ({photos.length}/6)
                  </Text>
                  {mergedCoverage && (
                    <View
                      style={[
                        styles.coverageBadgePill,
                        mergedCoverage.found.length >= 6
                          ? styles.coverageBadgePillGreen
                          : styles.coverageBadgePillAmber,
                      ]}
                    >
                      <Text style={styles.coverageBadgePillText}>
                        {mergedCoverage.found.length}/8 Statutory Found
                      </Text>
                    </View>
                  )}
                </View>

                {/* Horizontal thumbnail scroll */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbnailStrip}
                >
                  {photos.map((photo, index) => (
                    <View key={photo.id} style={styles.thumbCard}>
                      <Image source={{ uri: photo.uri }} style={styles.thumbImage} resizeMode="cover" />
                      <View style={styles.thumbIndexBadge}>
                        <Text style={styles.thumbIndexText}>#{index + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.thumbRemoveBtn}
                        onPress={() => handleRemovePhoto(photo.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <CloseIcon size={10} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add more button if slots remain */}
                  {photos.length < 6 && (
                    <TouchableOpacity
                      style={styles.thumbAddCard}
                      onPress={handlePickGallery}
                      activeOpacity={0.8}
                    >
                      <PlusIcon size={18} color="#00C2A8" />
                      <Text style={styles.thumbAddText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>

                {/* Prominent Analyse Button inside Captured Views Section */}
                <TouchableOpacity
                  style={styles.panelAnalyseBtn}
                  onPress={handleAnalyse}
                  activeOpacity={0.85}
                  // @ts-ignore
                  className="inspect-btn"
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#062E28" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </Svg>
                  <Text style={styles.panelAnalyseBtnText}>
                    Analyse Package ({photos.length} {photos.length === 1 ? 'view' : 'views'}) →
                  </Text>
                </TouchableOpacity>

                {/* Analysis Loading State */}
                {isAnalysing && (
                  <View style={styles.analysisLoadingBox}>
                    <ActivityIndicator size="small" color="#00C2A8" />
                    <Text style={styles.analysisLoadingText}>
                      Running OCR across {photos.length} {photos.length === 1 ? 'view' : 'views'}…
                    </Text>
                  </View>
                )}

                {/* Analysis Error */}
                {analysisError && (
                  <View style={styles.analysisErrorBox}>
                    <Text style={styles.analysisErrorText}>{analysisError}</Text>
                  </View>
                )}

                {/* Live Statutory Declarations Badges */}
                {mergedCoverage && !isAnalysing && (
                  <View style={styles.declarationsSection}>
                    <View style={styles.declarationsGrid}>
                      {STATUTORY_DECLARATIONS.map((decl) => {
                        const isFound = mergedCoverage.found.includes(decl.key);
                        return (
                          <View
                            key={decl.key}
                            style={[
                              styles.declChip,
                              isFound ? styles.declChipFound : styles.declChipMissing,
                            ]}
                          >
                            {isFound ? (
                              <CheckIcon size={11} color="#00C2A8" />
                            ) : (
                              <Text style={styles.declMissingMark}>✕</Text>
                            )}
                            <Text
                              style={[
                                styles.declChipText,
                                isFound ? styles.declChipTextFound : styles.declChipTextMissing,
                              ]}
                              numberOfLines={1}
                            >
                              {decl.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* View Full Report Button */}
                    <TouchableOpacity
                      style={styles.generateReportBtn}
                      onPress={handleGenerateReport}
                      activeOpacity={0.85}
                      // @ts-ignore
                      className="inspect-btn"
                    >
                      <Text style={styles.generateReportBtnText}>
                        View Full Inspection Report →
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Compliance Services Section */}
        <Text style={styles.sectionLabel}>Compliance services</Text>

        <View style={[styles.services, isMobile && styles.servicesMobile]}>
          {/* Card 1: Inspection records */}
          <TouchableOpacity
            style={[styles.serviceCard, isMobile && styles.serviceCardMobile]}
            onPress={() => {
              showToast('Opening inspection records…');
              setTimeout(() => navigation.navigate('HistoryTab'), 200);
            }}
            activeOpacity={0.9}
            // @ts-ignore
            className="inspect-service-card"
          >
            <View style={[styles.serviceIcon, { backgroundColor: '#6C5CE7' }]}>
              <RecordsIcon size={19} color="#FFFFFF" />
            </View>
            <Text style={styles.cardH4}>Inspection records</Text>
            <Text style={styles.cardP}>
              Search, filter, and review previous product audit reports and compliance verdicts.
            </Text>
            <View style={styles.goRow}>
              <Text style={[styles.goRowText, { color: '#6C5CE7' }]}>Open records</Text>
              <ChevronRightIcon size={13} color="#6C5CE7" />
            </View>
          </TouchableOpacity>

          {/* Card 2: Rules database */}
          <TouchableOpacity
            style={[styles.serviceCard, isMobile && styles.serviceCardMobile]}
            onPress={() => {
              showToast('Opening rules database…');
              setTimeout(() => navigation.navigate('RulesTab'), 200);
            }}
            activeOpacity={0.9}
            // @ts-ignore
            className="inspect-service-card"
          >
            <View style={[styles.serviceIcon, { backgroundColor: '#2F4A8A' }]}>
              <RulesDbIcon size={19} color="#FFFFFF" />
            </View>
            <Text style={styles.cardH4}>Rules database</Text>
            <Text style={styles.cardP}>
              Browse Legal Metrology (Packaged Commodities) rules, specifications, and font ratios.
            </Text>
            <View style={styles.goRow}>
              <Text style={[styles.goRowText, { color: '#2F4A8A' }]}>Browse rules</Text>
              <ChevronRightIcon size={13} color="#2F4A8A" />
            </View>
          </TouchableOpacity>

          {/* Card 3: Compliance analytics */}
          <TouchableOpacity
            style={[styles.serviceCard, isMobile && styles.serviceCardMobile]}
            onPress={() => {
              showToast('Opening compliance analytics…');
              setTimeout(() => navigation.navigate('DashboardTab'), 200);
            }}
            activeOpacity={0.9}
            // @ts-ignore
            className="inspect-service-card"
          >
            <View style={[styles.serviceIcon, { backgroundColor: '#FFB020' }]}>
              <AnalyticsChartIcon size={19} color="#5A3B04" />
            </View>
            <Text style={styles.cardH4}>Compliance analytics</Text>
            <Text style={styles.cardP}>
              View enforcement metrics, violation breakdown by rule, and category risk tracking.
            </Text>
            <View style={styles.goRow}>
              <Text style={[styles.goRowText, { color: '#B9760A' }]}>View analytics</Text>
              <ChevronRightIcon size={13} color="#B9760A" />
            </View>
          </TouchableOpacity>

          {/* Card 4: Ask assistant */}
          <TouchableOpacity
            style={[styles.serviceCard, isMobile && styles.serviceCardMobile]}
            onPress={() => {
              showToast('Opening assistant…');
              setTimeout(() => navigation.navigate('AssistantTab'), 200);
            }}
            activeOpacity={0.9}
            // @ts-ignore
            className="inspect-service-card"
          >
            <View style={[styles.serviceIcon, { backgroundColor: '#00C2A8' }]}>
              <AssistantChatIcon size={19} color="#06342C" />
            </View>
            <Text style={styles.cardH4}>Ask assistant</Text>
            <Text style={styles.cardP}>
              Ask specific regulatory questions about font ratios, display areas, or penalty clauses.
            </Text>
            <View style={styles.goRow}>
              <Text style={[styles.goRowText, { color: '#068F7B' }]}>Start chat</Text>
              <ChevronRightIcon size={13} color="#068F7B" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating Toast Notification */}
      {toastShow && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  bodyWrap: {
    flex: 1,
    backgroundColor: '#F3F4FA',
  },
  scrollContainer: {
    flex: 1,
  },
  wrap: {
    maxWidth: 1120,
    width: '100%',
    marginHorizontal: 'auto',
    paddingBottom: 96,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    maxWidth: 1120,
    width: '100%',
    marginHorizontal: 'auto',
  },
  portalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF5C5C',
  },
  portalTagText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.14,
    color: '#25396B',
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleChip: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#25396B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 6,
  },
  signOutBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FF6B6B',
  },

  /* Hero styles */
  hero: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 28,
    backgroundColor: '#25396B',
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 36,
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 28,
    alignItems: 'center',
  },
  heroMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 18,
    paddingVertical: 24,
    marginHorizontal: 14,
    gap: 18,
  },
  heroCopy: {
    flex: 1.2,
    zIndex: 2,
  },
  heroCopyMobile: {
    width: '100%',
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,194,168,.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  eyebrowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00C2A8',
  },
  heroH1: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 37,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  heroH1Mobile: {
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 10,
  },
  heroP: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    color: '#B9BFDA',
    fontSize: 14.5,
    lineHeight: 23,
    marginBottom: 22,
    maxWidth: 420,
  },
  heroPMobile: {
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 18,
    maxWidth: '100%',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionsMobile: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  actionBtn: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnMobile: {
    width: '100%',
    justifyContent: 'center',
  },
  actionCamera: {
    backgroundColor: '#00C2A8',
  },
  actionGallery: {
    backgroundColor: '#6C5CE7',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '600',
  },
  actionAnalyse: {
    backgroundColor: '#00C2A8',
  },
  actionAnalyseDisabled: {
    opacity: 0.7,
  },
  actionAnalyseText: {
    color: '#062E28',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '700',
  },
  actionClear: {
    backgroundColor: 'rgba(255, 92, 92, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 92, 0.3)',
  },
  actionClearText: {
    color: '#FF7B7B',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Scan visual box */
  scanVisual: {
    flex: 1.1,
    minHeight: 220,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.14)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
    width: '100%',
    padding: 16,
  },
  scanVisualMobile: {
    width: '100%',
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    marginTop: 14,
    minHeight: 180,
  },
  scanVisualDragOver: {
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    borderColor: '#00C2A8',
  },
  scanVisualWithPhotos: {
    backgroundColor: 'rgba(18, 28, 54, 0.7)',
    borderColor: 'rgba(0, 194, 168, 0.35)',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },

  /* Empty scan target prompt */
  scanTargetEmpty: {
    width: '100%',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 194, 168, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyPromptTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    marginBottom: 4,
  },
  emptyPromptSub: {
    color: '#B9BFDA',
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 12,
  },
  emptyBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#00C2A8',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  /* Photos panel */
  photosPanel: {
    width: '100%',
    gap: 12,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    letterSpacing: 0.2,
  },
  coverageBadgePill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  coverageBadgePillGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  coverageBadgePillAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  coverageBadgePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Thumbnail strip */
  thumbnailStrip: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  thumbCard: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#0F1A30',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbIndexBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  thumbIndexText: {
    color: '#00C2A8',
    fontSize: 9,
    fontWeight: '700',
  },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbAddCard: {
    width: 68,
    height: 68,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 194, 168, 0.5)',
    backgroundColor: 'rgba(0, 194, 168, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbAddText: {
    color: '#00C2A8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  /* Analysis states */
  panelAnalyseBtn: {
    backgroundColor: '#00C2A8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  panelAnalyseBtnText: {
    color: '#062E28',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  analysisLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 194, 168, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 168, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  analysisLoadingText: {
    color: '#00C2A8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  analysisErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  analysisErrorText: {
    color: '#FF8A8A',
    fontSize: 12,
    fontWeight: '500',
  },

  /* Live Statutory Declarations */
  declarationsSection: {
    gap: 10,
    marginTop: 4,
  },
  declarationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  declChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  declChipFound: {
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    borderColor: 'rgba(0, 194, 168, 0.4)',
  },
  declChipMissing: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  declMissingMark: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontWeight: '700',
  },
  declChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  declChipTextFound: {
    color: '#00C2A8',
  },
  declChipTextMissing: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  generateReportBtn: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  generateReportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
  },

  /* Section label & Services grid */
  sectionLabel: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 13,
    fontWeight: '600',
    color: '#9498AC',
    letterSpacing: 0.39,
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  services: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 20,
  },
  servicesMobile: {
    flexDirection: 'column',
  },
  serviceCard: {
    width: (Platform.OS === 'web' ? 'calc(50% - 7px)' : '100%') as any,
    minWidth: 280,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    borderRadius: 16,
    padding: 20,
  },
  serviceCardMobile: {
    width: '100%',
    minWidth: '100%',
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardH4: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 15.5,
    fontWeight: '600',
    color: '#12141C',
    marginBottom: 6,
  },
  cardP: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 13,
    color: '#5D6178',
    lineHeight: 20,
  },
  goRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
  },
  goRowText: {
    fontSize: 12.5,
    fontWeight: '600',
  },

  /* Toast notification */
  toastContainer: {
    position: 'absolute',
    bottom: 26,
    alignSelf: 'center',
    backgroundColor: '#12141C',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});



