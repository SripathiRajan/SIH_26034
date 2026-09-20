import { api } from '../api/client';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import GlassCard from '../components/GlassCard';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { color, font, space, radius } from '../theme/tokens';
import { OCR_PIPELINE_STAGES, simulateScanPipeline } from '../services/scanSimulator';

import DottedBackground from '../components/DottedBackground';

interface Props {
  navigation: any;
  route: any;
}

export default function ProcessingScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [extractedLogs, setExtractedLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const imageUri = route.params?.imageUri;
  const sessionId = route.params?.sessionId;
  const imageUris = route.params?.imageUris;
  const isSessionMode = Boolean(sessionId);
  const isMultiAngle = Boolean(Array.isArray(imageUris) && imageUris.length > 1);

  const runOfflineVerification = () => {
    setError(null);
    const targetUri = (imageUris && imageUris[0]) || imageUri || '';
    setExtractedLogs((prev) => [
      ...prev,
      'Activating offline statutory inspection engine...',
      'Synthesizing Rule 6 mandatory declarations locally...',
    ]);
    simulateScanPipeline(
      targetUri,
      (stageIdx) => setCurrentStageIndex(stageIdx),
      (snippet) => setExtractedLogs((prev) => [...prev, snippet])
    ).then((resultScan) => {
      const offlineRecord = {
        ...resultScan,
        facesScanned: imageUris ? imageUris.map((_: string, idx: number) => `view_${idx + 1}`) : ['front'],
        imageUris: imageUris || (imageUri ? [imageUri] : []),
      };
      setTimeout(() => {
        navigation.replace('Result', { scanData: offlineRecord, imageUris: offlineRecord.imageUris });
      }, 500);
    });
  };

  useEffect(() => {
    let isMounted = true;

    if (Array.isArray(imageUris) && imageUris.length > 0) {
      const viewCount = imageUris.length;
      setExtractedLogs([
        `Statutory inspection: synthesizing declarations across ${viewCount} view${viewCount === 1 ? '' : 's'}...`,
        'Running multi-engine statutory OCR and Rule 6 entity parsing...',
      ]);

      setCurrentStageIndex(1);
      const stageTimer = setInterval(() => {
        if (isMounted) {
          setCurrentStageIndex((prev) => Math.min(prev + 1, OCR_PIPELINE_STAGES.length - 1));
        }
      }, 700);

      (async () => {
        try {
          let activeSessionId = sessionId;
          if (!activeSessionId) {
            const sessRes = await api.scanSession(imageUris);
            activeSessionId = sessRes.sessionId;
            if (isMounted) {
              setExtractedLogs((prev) => [
                ...prev,
                `Session established: ${sessRes.sessionId.slice(0, 10)}...`,
                `Identified ${sessRes.mergedCoverage?.found?.length || 0} statutory declarations across captured views.`,
              ]);
              setCurrentStageIndex(2);
            }
          }

          const resultScan = await api.finalizeSession(activeSessionId);
          clearInterval(stageTimer);
          if (isMounted) {
            setCurrentStageIndex(OCR_PIPELINE_STAGES.length);
            if (resultScan.fields && resultScan.fields.length > 0) {
              resultScan.fields.forEach((f) => {
                setExtractedLogs((prev) => [
                  ...prev,
                  "Verified " + f.label + ": " + (f.extractedValue || f.extractedText || "DETECTED") + " [" + (f.status || 'pass').toUpperCase() + "]"
                ]);
              });
            }
            setTimeout(() => {
              navigation.replace('Result', { scanData: resultScan, imageUris });
            }, 600);
          }
        } catch (err: any) {
          clearInterval(stageTimer);
          if (DEMO_MODE) {
            simulateScanPipeline(
              imageUris[0] || '',
              (stageIdx) => {
                if (isMounted) setCurrentStageIndex(stageIdx);
              },
              (snippet) => {
                if (isMounted) setExtractedLogs((prev) => [...prev, snippet]);
              }
            ).then((resultScan) => {
              if (isMounted) {
                const demoMultiScan = {
                  ...resultScan,
                  facesScanned: imageUris.map((_: string, idx: number) => `view_${idx + 1}`),
                  imageUris: imageUris,
                };
                setTimeout(() => {
                  navigation.replace('Result', { scanData: demoMultiScan, imageUris });
                }, 500);
              }
            });
          } else {
            if (isMounted) {
              setError(err?.message || 'Finalization failed. Backend may be offline or unreachable.');
            }
          }
        }
      })();

      return () => {
        isMounted = false;
        clearInterval(stageTimer);
      };
    } else if (sessionId) {
      setExtractedLogs([
        `Multi-angle session: ${sessionId.slice(0, 8)}...`,
        `Synthesizing declarations across captured package views...`,
      ]);

      setCurrentStageIndex(1);
      const stageTimer = setInterval(() => {
        if (isMounted) {
          setCurrentStageIndex((prev) => Math.min(prev + 1, OCR_PIPELINE_STAGES.length - 1));
        }
      }, 500);

      api.finalizeSession(sessionId)
        .then((resultScan) => {
          clearInterval(stageTimer);
          if (isMounted) {
            setCurrentStageIndex(OCR_PIPELINE_STAGES.length);
            if (resultScan.fields && resultScan.fields.length > 0) {
              resultScan.fields.forEach((f) => {
                setExtractedLogs((prev) => [
                  ...prev,
                  "Verified " + f.label + ": " + (f.extractedValue || f.extractedText || "DETECTED") + " [" + (f.status || 'pass').toUpperCase() + "]"
                ]);
              });
            }
            setTimeout(() => {
              navigation.replace('Result', { scanData: resultScan, imageUris });
            }, 600);
          }
        })
        .catch((err: any) => {
          clearInterval(stageTimer);
          if (DEMO_MODE) {
            simulateScanPipeline(
              imageUri || '',
              (stageIdx) => {
                if (isMounted) setCurrentStageIndex(stageIdx);
              },
              (snippet) => {
                if (isMounted) setExtractedLogs((prev) => [...prev, snippet]);
              }
            ).then((resultScan) => {
              if (isMounted) {
                setTimeout(() => {
                  navigation.replace('Result', { scanData: resultScan });
                }, 500);
              }
            });
          } else {
            if (isMounted) {
              setError(err?.message || 'Finalization failed. Backend may be offline or unreachable.');
            }
          }
        });

      return () => {
        isMounted = false;
        clearInterval(stageTimer);
      };
    } else {
      // Single-image flow
      setExtractedLogs([
        'Initializing cascaded OCR engines...',
        'Running primary PaddleOCR detection on package label...',
      ]);
      setCurrentStageIndex(1);

      const stageTimer = setInterval(() => {
        if (isMounted) {
          setCurrentStageIndex((prev) => {
            if (prev < OCR_PIPELINE_STAGES.length - 1) {
              const next = prev + 1;
              const stageName = OCR_PIPELINE_STAGES[next]?.name || 'Verifying declarations';
              setExtractedLogs((logs) => [...logs, `Running ${stageName}...`]);
              return next;
            }
            return prev;
          });
        }
      }, 7000);

      api.analyzeImage(imageUri || '', (stageIdx) => {
        if (isMounted) setCurrentStageIndex(stageIdx);
      }).then((resultScan) => {
        clearInterval(stageTimer);
        if (isMounted) {
          setCurrentStageIndex(OCR_PIPELINE_STAGES.length);
          if (resultScan.fields && resultScan.fields.length > 0) {
            resultScan.fields.forEach((f) => {
              setExtractedLogs((prev) => [...prev, "Verified " + f.label + ": " + (f.extractedValue || f.extractedText || "DETECTED") + " [" + f.status.toUpperCase() + "]"]);
            });
          }
          setTimeout(() => {
            navigation.replace('Result', { scanData: resultScan });
          }, 600);
        }
      }).catch((err: any) => {
        clearInterval(stageTimer);
        if (DEMO_MODE) {
          simulateScanPipeline(
            imageUri || '',
            (stageIdx) => {
              if (isMounted) setCurrentStageIndex(stageIdx);
            },
            (snippet) => {
              if (isMounted) setExtractedLogs((prev) => [...prev, snippet]);
            }
          ).then((resultScan) => {
            if (isMounted) {
              setTimeout(() => {
                navigation.replace('Result', { scanData: resultScan });
              }, 500);
            }
          });
        } else {
          if (isMounted) {
            setError(err?.message || 'Processing failed. Backend may be offline or unreachable.');
          }
        }
      });

      return () => {
        isMounted = false;
        clearInterval(stageTimer);
      };
    }
  }, [retryCount]);

  return (
    <DottedBackground>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, error ? styles.liveDotError : null]} />
            <Text style={[styles.liveBadgeText, error ? styles.liveBadgeTextError : null]}>
              {error ? 'PROCESSING FAILED' : isMultiAngle ? 'FINALIZING MULTI-ANGLE SCAN' : isSessionMode ? 'FINALIZING INSPECTION' : 'VERIFYING DECLARATIONS'}
            </Text>
          </View>
          <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
            {error
              ? 'Inspection Error'
              : isMultiAngle
                ? `Finalizing inspection across ${(imageUris?.length || 1)} views...`
                : isSessionMode
                ? 'Finalizing inspection report...'
                : 'Processing Packaging Label...'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {error
              ? 'An error occurred while communicating with the inspection backend.'
              : isMultiAngle
                ? `Synthesizing statutory declarations across ${(imageUris?.length || 1)} captured package views into a unified compliance audit.`
                : isSessionMode
                ? 'Consolidating statutory declarations into a unified compliance audit.'
                : 'Reading label text and checking mandatory declarations against Legal Metrology Rules, 2011.'}
          </Text>
        </View>

        {error && (
          <GlassCard style={[styles.terminalCard, styles.errorCard]}>
            <Text style={[styles.terminalTitle, styles.errorTitle]}>Error Details</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <View style={styles.errorActionsRow}>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setError(null);
                  setRetryCount((prev) => prev + 1);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>↻ Retry Inspection</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.offlineBtn}
                onPress={runOfflineVerification}
                activeOpacity={0.8}
              >
                <Text style={styles.offlineBtnText}>⚡ Run Offline Inspection</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.returnBtn}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.8}
              >
                <Text style={styles.returnBtnText}>Return to Scanner</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Verification Log Stream */}
        <GlassCard style={styles.terminalCard}>
          <View style={styles.terminalHeader}>
            <Text style={styles.terminalBadge}>VERIFICATION LOG</Text>
            <Text style={styles.terminalTitle}>Extracted Label Text & Verification Progress</Text>
          </View>

          <View style={styles.terminalBody}>
            {extractedLogs.map((log, idx) => (
              <Text key={idx} style={styles.terminalLine}>
                <Text style={styles.terminalPrompt}>❯ </Text>
                {log}
              </Text>
            ))}
          </View>
        </GlassCard>

        {/* Pipeline Progress Stages */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verification Progress</Text>
        </View>

        <View style={styles.stagesList}>
          {OCR_PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isActive = idx === currentStageIndex;

            return (
              <GlassCard key={stage.id} style={[styles.stageCard, isActive ? styles.activeStageCard : {}]}>
                <View style={styles.stageRow}>
                  <View style={[
                    styles.stageStatusBadge,
                    isCompleted && styles.completedBadge,
                    isActive && styles.activeBadge,
                  ]}>
                    <Text style={[
                      styles.stageStatusText,
                      isCompleted && styles.completedText,
                      isActive && styles.activeText,
                    ]}>
                      {isCompleted ? 'Passed' : isActive ? 'Running' : 'Pending'}
                    </Text>
                  </View>

                  <View style={styles.stageContentCol}>
                    <Text style={styles.stageTitle}>{stage.title}</Text>
                    <Text style={styles.stageSub}>{stage.subtitle}</Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
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
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  mobileContent: {
    padding: space.md,
    paddingBottom: 96,
  },
  navBar: {
    marginBottom: space.md,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.primary,
  },
  liveBadgeText: {
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    color: color.primary,
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
  terminalCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    marginBottom: space.xl,
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: space.xs,
  },
  terminalBadge: {
    backgroundColor: color.primary,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    fontSize: 10,
    fontWeight: font.weight.bold,
    color: '#FFFFFF',
  },
  terminalTitle: {
    fontSize: font.size.xs,
    color: '#94A3B8',
    fontWeight: font.weight.semibold,
  },
  terminalBody: {
    gap: space.xs,
    minHeight: 120,
  },
  terminalLine: {
    fontSize: font.size.xs,
    color: '#E2E8F0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  terminalPrompt: {
    color: '#38BDF8',
    fontWeight: font.weight.bold,
  },
  sectionHeader: {
    marginBottom: space.md,
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: color.ink,
  },
  stagesList: {
    gap: space.sm,
    marginBottom: space.xl,
  },
  stageCard: {
    padding: space.md,
    borderRadius: radius.lg,
  },
  activeStageCard: {
    borderColor: color.primaryBorder,
    backgroundColor: color.primaryLight,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  stageStatusBadge: {
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: color.surfaceHover,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  completedBadge: {
    backgroundColor: color.successBg,
    borderColor: color.successBorder,
  },
  activeBadge: {
    backgroundColor: color.primaryLight,
    borderColor: color.primaryBorder,
  },
  stageStatusText: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: color.inkMuted,
  },
  completedText: {
    color: color.success,
  },
  activeText: {
    color: color.primary,
  },
  stageTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: color.ink,
  },
  stageSub: {
    fontSize: font.size.xs,
    color: color.inkSecondary,
  },
  liveDotError: {
    backgroundColor: color.danger,
  },
  liveBadgeTextError: {
    color: color.danger,
  },
  headerTitleMobile: {
    fontSize: 20,
  },
  errorCard: {
    borderColor: color.danger,
    padding: space.lg,
    marginBottom: space.lg,
  },
  errorTitle: {
    color: color.danger,
    marginBottom: space.xs,
  },
  errorMessage: {
    color: '#E2E8F0',
    fontSize: 13,
    marginBottom: space.md,
  },
  returnBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  returnBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.semibold,
    fontSize: 13,
  },
  errorActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: space.sm,
  },
  retryBtn: {
    backgroundColor: color.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.semibold,
    fontSize: 13,
  },
  offlineBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  offlineBtnText: {
    color: '#FFFFFF',
    fontWeight: font.weight.semibold,
    fontSize: 13,
  },
  stageContentCol: {
    flex: 1,
  },
});
