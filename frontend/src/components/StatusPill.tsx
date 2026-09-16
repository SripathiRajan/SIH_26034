import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, font, radius } from '../theme/tokens';

type StatusType = 'compliant' | 'non-compliant' | 'warning' | 'info' | 'pending' | string;

interface Props {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
}

export default function StatusPill({ status, label, size = 'md' }: Props) {
  const normalized = (status || '').toLowerCase();
  
  let bg = '#F0F9FF';
  let text = '#0369A1';
  let border = '#BAE6FD';
  let dotColor = '#0EA5E9';
  let defaultLabel = (status || 'UNKNOWN').toUpperCase();

  if (normalized.includes('pass') || (normalized.includes('compliant') && !normalized.includes('non'))) {
    bg = '#ECFDF5';
    text = '#047857';
    border = '#A7F3D0';
    dotColor = '#10B981';
    defaultLabel = 'Compliant';
  } else if (normalized.includes('fail') || normalized.includes('non-compliant') || normalized.includes('violation') || normalized.includes('breach')) {
    bg = '#FEF2F2';
    text = '#B91C1C';
    border = '#FECACA';
    dotColor = '#EF4444';
    defaultLabel = 'Non-Compliant';
  } else if (normalized.includes('warn') || normalized.includes('flag') || normalized.includes('partial')) {
    bg = '#FFFBEB';
    text = '#B45309';
    border = '#FDE68A';
    dotColor = '#F59E0B';
    defaultLabel = 'Review Needed';
  } else if (normalized.includes('pend') || normalized.includes('process')) {
    bg = '#EEF2FF';
    text = '#4338CA';
    border = '#C7D2FE';
    dotColor = '#4F46E5';
    defaultLabel = 'Pending';
  }

  const displayText = label ? label : defaultLabel;

  return (
    <View style={[
      styles.pill,
      { backgroundColor: bg, borderColor: border },
      size === 'sm' && styles.pillSm
    ]}>
      <View style={[styles.dot, { backgroundColor: dotColor }, size === 'sm' && styles.dotSm]} />
      <Text style={[
        styles.text,
        { color: text },
        size === 'sm' && styles.textSm
      ]}>
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSm: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  textSm: {
    fontSize: 11,
  }
});
