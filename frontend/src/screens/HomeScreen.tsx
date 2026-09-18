import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform, Modal, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import DemoBanner from '../components/DemoBanner';
import { useAuth } from '../context/AuthContext';

interface Props {
  navigation: any;
}

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

export default function HomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;
  const { currentUser, logout } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      `End the session for ${currentUser?.name || 'this officer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  // Toast state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastShow, setToastShow] = useState<boolean>(false);
  const toastTimer = useRef<any>(null);

  // Interactive scanner states
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isHeroCameraActive, setIsHeroCameraActive] = useState<boolean>(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);

  // Modal camera scanner state
  const [isVideoScanOpen, setIsVideoScanOpen] = useState<boolean>(false);
  const [scanSide, setScanSide] = useState<'front' | 'back' | 'full'>('front');

  // DOM Refs
  const heroVideoRef = useRef<any>(null);
  const heroStreamRef = useRef<any>(null);
  const modalVideoRef = useRef<any>(null);
  const modalStreamRef = useRef<any>(null);
  const fileInputRef = useRef<any>(null);

  // Inject Web Google Fonts and CSS Keyframes
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
          @keyframes scan {
            0%, 100% { top: 8px; }
            50% { top: calc(100% - 10px); }
          }
          .scan-target {
            position: relative !important;
            width: 120px !important;
            height: 150px !important;
            border: 2px solid rgba(255,255,255,.35) !important;
            border-radius: 10px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            cursor: pointer;
            transition: border-color 0.2s ease, transform 0.15s ease;
          }
          .scan-target:hover {
            border-color: rgba(0, 194, 168, 0.85) !important;
            transform: scale(1.02);
          }
          .scan-target .corner {
            position: absolute !important;
            width: 16px !important;
            height: 16px !important;
            border-color: #00C2A8 !important;
            z-index: 10 !important;
          }
          .scan-target .tl {
            top: -2px !important; left: -2px !important;
            border-top: 3px solid #00C2A8 !important;
            border-left: 3px solid #00C2A8 !important;
            border-radius: 6px 0 0 0 !important;
          }
          .scan-target .tr {
            top: -2px !important; right: -2px !important;
            border-top: 3px solid #00C2A8 !important;
            border-right: 3px solid #00C2A8 !important;
            border-radius: 0 6px 0 0 !important;
          }
          .scan-target .bl {
            bottom: -2px !important; left: -2px !important;
            border-bottom: 3px solid #00C2A8 !important;
            border-left: 3px solid #00C2A8 !important;
            border-radius: 0 0 0 6px !important;
          }
          .scan-target .br {
            bottom: -2px !important; right: -2px !important;
            border-bottom: 3px solid #00C2A8 !important;
            border-right: 3px solid #00C2A8 !important;
            border-radius: 0 0 6px 0 !important;
          }
          .scan-line {
            position: absolute !important;
            left: 6px !important;
            right: 6px !important;
            height: 2px !important;
            background: #00C2A8 !important;
            box-shadow: 0 0 10px 2px rgba(0,194,168,.7) !important;
            animation: scan 2.2s ease-in-out infinite !important;
            z-index: 12 !important;
          }
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

  // Process image analysis with visual laser sweep animation
  const processImageScan = (uri: string, name: string = 'Image') => {
    setPreviewImageUri(uri);
    setIsScanningActive(true);
    showToast(`Analyzing ${name}…`);
    setTimeout(() => {
      setIsScanningActive(false);
      navigation.navigate('Processing', { imageUri: uri });
    }, 700);
  };

  // Image upload handler
  const handleChooseImage = async () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          processImageScan(result.assets[0].uri, 'Selected photo');
        }
      } catch (e) {
        navigation.navigate('Processing', { imageUri: '' });
      }
    }
  };

  const handleWebFileChange = (e: any) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const uri = URL.createObjectURL(file);
      processImageScan(uri, file.name);
    }
  };

  // Drag and drop handlers for web
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
        const file = e.dataTransfer.files[0];
        const uri = URL.createObjectURL(file);
        processImageScan(uri, file.name);
      }
    }
  };

  // Toggle interactive camera stream inside the Hero scanner target box
  const toggleHeroCamera = async () => {
    if (isHeroCameraActive) {
      // Stop hero camera
      if (heroStreamRef.current) {
        heroStreamRef.current.getTracks().forEach((track: any) => track.stop());
        heroStreamRef.current = null;
      }
      setIsHeroCameraActive(false);
      showToast('Camera stopped');
    } else {
      // Start hero camera stream
      showToast('Opening live camera stream…');
      setIsHeroCameraActive(true);
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          heroStreamRef.current = stream;
          setTimeout(() => {
            if (heroVideoRef.current) heroVideoRef.current.srcObject = stream;
          }, 150);
        } catch (err) {
          console.warn('Hero camera notice:', err);
          showToast('Camera access unavailable');
          setIsHeroCameraActive(false);
        }
      }
    }
  };

  const captureHeroFrame = () => {
    let capturedUri = '';
    if (heroVideoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = heroVideoRef.current.videoWidth || 640;
        canvas.height = heroVideoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(heroVideoRef.current, 0, 0, canvas.width, canvas.height);
          capturedUri = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {
        console.warn('Canvas capture fallback', e);
      }
    }
    // Stop camera
    if (heroStreamRef.current) {
      heroStreamRef.current.getTracks().forEach((track: any) => track.stop());
      heroStreamRef.current = null;
    }
    setIsHeroCameraActive(false);
    processImageScan(capturedUri, 'Captured photo');
  };

  // Run instant sample demo scan
  const runDemoScan = () => {
    showToast('Loading sample product packaging…');
    processImageScan('', 'Sample packaging');
  };

  // Modal video camera scanner
  const handleStartModalScan = async () => {
    showToast('Opening camera scanner…');
    setIsVideoScanOpen(true);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        modalStreamRef.current = stream;
        setTimeout(() => {
          if (modalVideoRef.current) modalVideoRef.current.srcObject = stream;
        }, 100);
      } catch (err) {
        console.warn('Modal camera stream notice:', err);
      }
    }
  };

  const handleStopModalScan = () => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach((track: any) => track.stop());
      modalStreamRef.current = null;
    }
    setIsVideoScanOpen(false);
  };

  const captureModalFrame = () => {
    let capturedUri = '';
    if (modalVideoRef.current) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = modalVideoRef.current.videoWidth || 640;
        canvas.height = modalVideoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(modalVideoRef.current, 0, 0, canvas.width, canvas.height);
          capturedUri = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {
        console.warn('Canvas capture fallback', e);
      }
    }
    handleStopModalScan();
    processImageScan(capturedUri, 'Scanned product');
  };

  return (
    <View style={styles.bodyWrap}>
      <DemoBanner />
      {/* Hidden file input for web */}
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
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
              <Text style={styles.roleChipText}>OFFICER</Text>
            </View>
            <TouchableOpacity
              style={styles.avatar}
              onPress={handleSignOut}
              activeOpacity={0.8}
              // @ts-ignore
              className="inspect-avatar"
            >
              <Text style={styles.avatarText}>
                {(currentUser?.name || currentUser?.id || 'OFF')
                  .trim()
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 4)
                  .toUpperCase()}
              </Text>
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
          <View style={styles.heroCopy}>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>Legal Metrology compliance</Text>
            </View>
            <Text style={styles.heroH1}>Scan any label. Know in seconds if it holds up.</Text>
            <Text style={styles.heroP}>
              Select a packaging image, capture a live photo, or scan a product to verify MRP, net quantity, dates, and mandatory font ratios.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={handleChooseImage}
                activeOpacity={0.85}
                // @ts-ignore
                className="inspect-btn"
              >
                <UploadIcon size={16} color="#FFFFFF" />
                <Text style={styles.actionPrimaryText}>Choose image file</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionScan, isHeroCameraActive && styles.actionScanActive]}
                onPress={toggleHeroCamera}
                activeOpacity={0.85}
                // @ts-ignore
                className="inspect-btn"
              >
                <CameraIcon size={16} color={isHeroCameraActive ? '#FFFFFF' : '#062E28'} />
                <Text style={[styles.actionScanText, isHeroCameraActive && styles.actionScanTextActive]}>
                  {isHeroCameraActive ? 'Close camera' : 'Live product scan'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionMultiAngle]}
                onPress={() => navigation.navigate('Capture')}
                activeOpacity={0.85}
                // @ts-ignore
                className="inspect-btn"
              >
                <LayersIcon size={16} color="#FFFFFF" />
                <Text style={styles.actionMultiAngleText}>Multi-angle capture</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Right Visual Scanner Target Box */}
          <View
            style={[
              styles.scanVisual,
              isMobile && styles.scanVisualMobile,
              isDragOver && styles.scanVisualDragOver,
              isHeroCameraActive && styles.scanVisualCameraActive,
            ]}
            // @ts-ignore
            onDragOver={handleDragOver}
            // @ts-ignore
            onDragLeave={handleDragLeave}
            // @ts-ignore
            onDrop={handleDrop}
          >
            <TouchableOpacity
              style={[
                styles.scanTarget,
                isDragOver && styles.scanTargetDragOver,
                isHeroCameraActive && styles.scanTargetCameraActive,
              ]}
              onPress={isHeroCameraActive ? captureHeroFrame : handleChooseImage}
              activeOpacity={0.9}
              // @ts-ignore
              className="scan-target"
            >
              {/* 4 Bracket Corners */}
              {/* @ts-ignore */}
              <View style={[styles.corner, styles.cornerTL]} className="corner tl" />
              {/* @ts-ignore */}
              <View style={[styles.corner, styles.cornerTR]} className="corner tr" />
              {/* @ts-ignore */}
              <View style={[styles.corner, styles.cornerBL]} className="corner bl" />
              {/* @ts-ignore */}
              <View style={[styles.corner, styles.cornerBR]} className="corner br" />

              {/* Faint Outlined Label Icon Centered Inside Scan Target */}
              {!isHeroCameraActive && !previewImageUri && (
                <View style={styles.centerIconWrap}>
                  <ScanVisualIcon size={34} color="rgba(255,255,255,0.5)" />
                </View>
              )}

              {/* Live Camera Stream or Image Preview */}
              {isHeroCameraActive ? (
                <View style={styles.heroCameraContainer}>
                  {Platform.OS === 'web' ? (
                    <video
                      ref={heroVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <Text style={styles.liveBadgeText}>CAMERA ACTIVE</Text>
                  )}
                  <View style={styles.captureOverlayBadge}>
                    <Text style={styles.captureOverlayBadgeText}>CLICK TO CAPTURE</Text>
                  </View>
                </View>
              ) : previewImageUri ? (
                <Image source={{ uri: previewImageUri }} style={styles.previewImage as any} resizeMode="cover" />
              ) : null}

              {/* Horizontal Teal Animated Scan Line */}
              <View
                style={styles.scanLine}
                // @ts-ignore
                className="scan-line"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Compliance Services Section */}
        <Text style={styles.sectionLabel}>Compliance services</Text>

        <View style={[styles.services, isMobile && styles.servicesMobile]}>
          {/* Card 1: Inspection records */}
          <TouchableOpacity
            style={styles.serviceCard}
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
            style={styles.serviceCard}
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
            style={styles.serviceCard}
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
            style={styles.serviceCard}
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

      {/* Live Video Camera Stream Modal */}
      <Modal visible={isVideoScanOpen} animationType="fade" transparent={true} onRequestClose={handleStopModalScan}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.liveDot} />
                <Text style={styles.modalTitle}>Live Product Scanner</Text>
              </View>
              <TouchableOpacity onPress={handleStopModalScan} style={styles.closeModalBtn}>
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.videoViewport}>
              {Platform.OS === 'web' ? (
                <video
                  ref={modalVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 12 }}
                />
              ) : (
                <View style={styles.nativeCameraFallback}>
                  <Text style={styles.nativeCameraText}>Live Camera Viewfinder Stream</Text>
                </View>
              )}

              <View style={styles.targetReticle}>
                <View style={[styles.cornerModal, styles.topLeftModal]} />
                <View style={[styles.cornerModal, styles.topRightModal]} />
                <View style={[styles.cornerModal, styles.bottomLeftModal]} />
                <View style={[styles.cornerModal, styles.bottomRightModal]} />
                <Text style={styles.reticleBadge}>AIM PACKAGING LABEL</Text>
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
                <Text style={[styles.sideChipText, scanSide === 'full' && styles.sideChipTextActive]}>360° Product</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.captureFrameBtn} onPress={captureModalFrame} activeOpacity={0.85}>
                <Text style={styles.captureFrameBtnText}>Capture Frame & Analyze</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  heroCopy: {
    flex: 1.2,
    zIndex: 2,
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
  heroP: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    color: '#B9BFDA',
    fontSize: 14.5,
    lineHeight: 23,
    marginBottom: 22,
    maxWidth: 420,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  actionPrimary: {
    backgroundColor: '#6C5CE7',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '600',
  },
  actionScan: {
    backgroundColor: '#00C2A8',
  },
  actionScanActive: {
    backgroundColor: '#FF5C5C',
  },
  actionMultiAngle: {
    backgroundColor: '#4F46E5',
  },
  actionMultiAngleText: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '600',
  },
  actionScanText: {
    color: '#062E28',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '600',
  },
  actionScanTextActive: {
    color: '#FFFFFF',
  },
  actionDemo: {
    backgroundColor: 'rgba(255,255,255,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.2)',
  },
  actionDemoText: {
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Scan visual box */
  scanVisual: {
    flex: 1,
    height: 220,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.14)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
    width: '100%',
  },
  scanVisualMobile: {
    height: 170,
  },
  scanVisualDragOver: {
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    borderColor: '#00C2A8',
  },
  scanVisualCameraActive: {
    borderColor: '#00C2A8',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanTarget: {
    width: 140,
    height: 165,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.35)',
    borderRadius: 10,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanTargetDragOver: {
    borderColor: '#00C2A8',
  },
  scanTargetCameraActive: {
    borderColor: '#00C2A8',
    width: '90%',
    height: 180,
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#00C2A8',
    zIndex: 10,
  },
  cornerHighlight: {
    borderColor: '#00C2A8',
    borderWidth: 3,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2,
    backgroundColor: '#00C2A8',
    shadowColor: '#00C2A8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    zIndex: 12,
  },
  scanLineActive: {
    backgroundColor: '#FF5C5C',
    shadowColor: '#FF5C5C',
  },
  centerIconWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  dragHintText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  heroCameraContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadgeText: {
    color: '#00C2A8',
    fontSize: 12,
    fontWeight: '700',
  },
  captureOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: '#00C2A8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 15,
  },
  captureOverlayBadgeText: {
    color: '#062E28',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
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

  /* Live camera modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 20, 28, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 640,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5C5C',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#12141C',
  },
  closeModalBtn: {
    padding: 4,
  },
  closeModalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9498AC',
  },
  videoViewport: {
    height: 320,
    backgroundColor: '#12141C',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCameraFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCameraText: {
    color: '#9498AC',
    fontSize: 15,
    fontWeight: '500',
  },
  targetReticle: {
    position: 'absolute',
    top: 40,
    bottom: 40,
    left: 40,
    right: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 194, 168, 0.6)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBadge: {
    backgroundColor: 'rgba(0, 194, 168, 0.85)',
    color: '#062E28',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    position: 'absolute',
    top: 12,
  },
  cornerModal: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#00C2A8',
  },
  topLeftModal: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRightModal: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeftModal: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRightModal: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  sideSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 16,
  },
  sideChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  sideChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  sideChipText: {
    fontSize: 12,
    color: '#5D6178',
    fontWeight: '500',
  },
  sideChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalActionRow: {
    alignItems: 'center',
  },
  captureFrameBtn: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
  },
  captureFrameBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});


