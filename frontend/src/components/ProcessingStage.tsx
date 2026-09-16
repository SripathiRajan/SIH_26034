import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, font, radius, space } from '../theme/tokens';
import { ProcessingStageInfo } from '../types';

interface ProcessingStageProps {
  stage: ProcessingStageInfo;
  status: 'pending' | 'active' | 'completed';
}

export default function ProcessingStage({ stage, status }: ProcessingStageProps) {
  const isPending = status === 'pending';
  const isActive = status === 'active';
  const isCompleted = status === 'completed';

  return (
    <View
      style={[
        styles.container,
        isActive && styles.activeContainer,
        isCompleted && styles.completedContainer,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          isPending && styles.pendingIcon,
          isActive && styles.activeIcon,
          isCompleted && styles.completedIcon,
        ]}
      >
        {isCompleted ? (
          <Feather name="check" size={14} color={color.pass} />
        ) : isActive ? (
          <ActivityIndicator size="small" color={color.accent} />
        ) : (
          <Feather name={stage.iconName as any} size={14} color={color.slate} />
        )}
      </View>

      <View style={styles.textWrap}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.stageName,
              isPending && styles.pendingText,
              isActive && styles.activeText,
              isCompleted && styles.completedText,
            ]}
          >
            {stage.name}
          </Text>
          <Text style={styles.engineText}>{stage.engine}</Text>
        </View>

        <Text style={styles.descriptionText} numberOfLines={1}>
          {stage.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: color.surfaceElevated,
    borderColor: color.surfaceBorder,
    borderWidth: 1,
    marginBottom: space.xs + 2,
    opacity: 0.6,
  },
  activeContainer: {
    opacity: 1,
    borderColor: color.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  completedContainer: {
    opacity: 1,
    borderColor: color.passBorder,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  pendingIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeIcon: {
    backgroundColor: color.accentSoft,
  },
  completedIcon: {
    backgroundColor: color.passSoft,
  },
  textWrap: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageName: {
    fontSize: font.size.xs + 1,
    fontWeight: font.weight.semibold,
  },
  pendingText: {
    color: color.slate,
  },
  activeText: {
    color: color.white,
  },
  completedText: {
    color: color.pass,
  },
  engineText: {
    fontSize: 10,
    color: color.slate,
    fontWeight: font.weight.medium,
  },
  descriptionText: {
    fontSize: 11,
    color: color.slate,
    marginTop: 1,
  },
});
