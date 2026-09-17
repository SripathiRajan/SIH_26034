import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import GlassCard from '../components/GlassCard';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { color, font, space, radius } from '../theme/tokens';

interface Props {
  navigation: any;
}

/* Vector SVG Icons */
function UploadIcon({ color = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M17 8l-5-5-5 5" />
      <Line x1="12" y1="3" x2="12" y2="15" />
    </Svg>
  );
}

function CameraIcon({ color = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

function VideoScanIcon({ color = '#FFFFFF', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="4" width="20" height="16" rx="3" />
      <Path d="M2 10h20" />
      <Circle cx="7" cy="7" r="1.5" fill={color} />
      <Circle cx="11" cy="7" r="1.5" fill={color} />
    </Svg>
  );
}

function ZapIcon({ color = '#475569', size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

export default function CaptureScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [isVideoScanOpen, setIsVideoScanOpen] = useState(false);
  const [scanSide, setScanSide] = useState<'front' | 'back' | 'full'>('front');
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);

  // 1. Pick from gallery
  const handlePickGallery = async () => {
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

  // 2. Take Live Photo
  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        alert("Camera permission is required to capture live package photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
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

  // 3. Live Product Stream Video Scan
  const startLiveVideoStream = async () => {
    setIsVideoScanOpen(true);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
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

  const handleCaptureVideoFrame = () => {
    let capturedUri = '';
    if (Platform.OS === 'web' && videoRef.current) {
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
    }
    stopLiveVideoStream();
    navigation.navigate('Processing', { imageUri: capturedUri });
  };

  const handleDemoScan = () => {
    if (!DEMO_MODE) return;
    navigation.navigate('Processing', { imageUri: '' });
  };

  return (
    <View style={{ flex: 1 }}>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
        {/* Navigation Bar */}
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>Select Package Label Image</Text>
          <Text style={styles.headerSubtitle}>
            Upload file, capture live photo, or scan entire 360° product video to verify mandatory Legal Metrology declarations.
          </Text>
        </View>

        {/* Upload Drop Zone Card */}
        <GlassCard style={styles.dropZoneCard}>
          <View style={styles.dropZoneInner}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconCircleText}>SCAN</Text>
            </View>

            <Text style={styles.dropTitle}>Select Packaging Image for Inspection</Text>
            <Text style={styles.dropSubtitle}>
              Supports JPEG, PNG, WEBP files up to 25 MB. Automatically detects layout, text alignment, font sizes, and mandatory fields.
            </Text>

            <View style={[styles.actionButtonGroup, isMobile && styles.actionButtonGroupMobile]}>
              <TouchableOpacity 
                style={styles.primaryUploadBtn} 
                onPress={handlePickGallery}
                activeOpacity={0.8}
              >
                <UploadIcon color="#FFFFFF" size={15} />
                <Text style={styles.primaryUploadBtnText}>Choose Image File</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.videoScanBtn} 
                onPress={startLiveVideoStream}
                activeOpacity={0.8}
              >
                <VideoScanIcon color="#FFFFFF" size={15} />
                <Text style={styles.videoScanBtnText}>Live Product Scan</Text>
              </TouchableOpacity>

              {DEMO_MODE && (
                <TouchableOpacity 
                  style={styles.secondaryDemoBtn} 
                  onPress={handleDemoScan}
                  activeOpacity={0.8}
                >
                  <ZapIcon color="#475569" size={15} />
                  <Text style={styles.secondaryDemoBtnText}>Run Sample Demo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </GlassCard>

      {/* Live Video Product Scanner Modal */}
      <Modal visible={isVideoScanOpen} animationType="fade" transparent={true} onRequestClose={stopLiveVideoStream}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.liveDot} />
                <Text style={styles.modalTitle}>Live Product Scanner</Text>
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
                <View style={styles.nativeCameraFallback}>
                  <Text style={styles.nativeCameraText}>Live Camera Viewfinder Stream</Text>
                </View>
              )}

              <View style={styles.targetReticle}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
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
                <Text style={[styles.sideChipText, scanSide === 'full' && styles.sideChipTextActive]}>360° Entire Product</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.captureFrameBtn} onPress={handleCaptureVideoFrame} activeOpacity={0.85}>
                <Text style={styles.captureFrameBtnText}>Capture Frame & Analyze</Text>
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
    maxWidth: 900,
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
    padding: space.xxl,
    borderRadius: radius.xl,
    marginBottom: space.xl,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: color.primaryBorder,
    backgroundColor: color.surface,
  },
  dropZoneInner: {
    alignItems: 'center',
    textAlign: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
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
  },
  dropSubtitle: {
    fontSize: font.size.sm,
    color: color.inkSecondary,
    maxWidth: 500,
    textAlign: 'center',
    marginBottom: space.xl,
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
  secondaryDemoBtn: {
    backgroundColor: color.surfaceHover,
    borderWidth: 1,
    borderColor: color.surfaceBorderDark,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryDemoBtnText: {
    color: color.inkSecondary,
    fontWeight: font.weight.semibold,
    fontSize: font.size.sm,
  },
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
  },
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
  nativeCameraFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCameraText: {
    color: '#94A3B8',
    fontSize: font.size.base,
    fontWeight: font.weight.medium,
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

