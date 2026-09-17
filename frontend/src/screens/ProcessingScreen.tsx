import { api } from '../api/client';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import GlassCard from '../components/GlassCard';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { color, font, space, radius } from '../theme/tokens';
import { OCR_PIPELINE_STAGES, simulateScanPipeline } from '../services/scanSimulator';

import DottedBackground from '../components/DottedBackground';
import LogoHeader from '../components/LogoHeader';

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
  const imageUri = route.params?.imageUri;

  useEffect(() => {
    let isMounted = true;

    api.analyzeImage(imageUri || '', (stageIdx) => {
      if (isMounted) setCurrentStageIndex(stageIdx);
    }).then((resultScan) => {
      if (isMounted) {
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
    };
  }, []);

  return (
    <DottedBackground>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, error ? { backgroundColor: color.danger } : {}]} />
          <Text style={[styles.liveBadgeText, error ? { color: color.danger } : {}]}>
            {error ? 'PROCESSING FAILED' : 'VERIFYING DECLARATIONS'}
          </Text>
        </View>
        <Text style={[styles.headerTitle, isMobile && { fontSize: 20 }]}>
          {error ? 'Inspection Error' : 'Processing Packaging Label...'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {error
            ? 'An error occurred while communicating with the inspection backend.'
            : 'Reading label text and checking mandatory declarations against Legal Metrology Rules, 2011.'}
        </Text>
      </View>

      {error && (
        <GlassCard style={[styles.terminalCard, { borderColor: color.danger, padding: 20, marginBottom: 20 }]}>
          <Text style={[styles.terminalTitle, { color: color.danger, marginBottom: 8 }]}>Error Details</Text>
          <Text style={{ color: '#E2E8F0', fontSize: 13, marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity
            style={{
              backgroundColor: color.primary,
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 8,
              alignSelf: 'flex-start',
            }}
            onPress={() => navigation.navigate('Capture')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Return to Scanner</Text>
          </TouchableOpacity>
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

                <View style={{ flex: 1 }}>
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
  }
});
