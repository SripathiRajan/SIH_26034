import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassCard from './GlassCard';
import { color, font, space, radius } from '../theme/tokens';

interface Props {
  label: string;
  value: string | number;
  subLabel?: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
}

export default function MetricCard({ label, value, subLabel, trend, trendType = 'positive' }: Props) {
  return (
    <GlassCard style={styles.container}>
      <View style={styles.topAccent} />
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {trend && (
          <View style={[
            styles.trendBadge,
            trendType === 'positive' && styles.trendPos,
            trendType === 'negative' && styles.trendNeg,
            trendType === 'neutral' && styles.trendNeu,
          ]}>
            <Text style={[
              styles.trendText,
              trendType === 'positive' && { color: '#047857' },
              trendType === 'negative' && { color: '#B91C1C' },
              trendType === 'neutral' && { color: color.inkMuted },
            ]}>
              {trend}
            </Text>
          </View>
        )}
      </View>
      {subLabel && <Text style={styles.subLabel} numberOfLines={1}>{subLabel}</Text>}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 160,
    margin: space.xs,
    padding: space.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4F46E5',
  },
  label: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: color.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  value: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.ink,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  trendPos: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  trendNeg: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  trendNeu: {
    backgroundColor: color.surfaceHover,
  },
  trendText: {
    fontSize: 10,
    fontWeight: font.weight.semibold,
  },
  subLabel: {
    fontSize: 11,
    color: color.inkSecondary,
    marginTop: 2,
  }
});
