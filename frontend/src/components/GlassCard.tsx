import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { color, radius, shadow } from '../theme/tokens';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'flat' | 'elevated' | 'bordered';
}

export default function GlassCard({ children, style, variant = 'elevated' }: Props) {
  return (
    <View style={[
      styles.card,
      variant === 'elevated' && styles.elevated,
      variant === 'bordered' && styles.bordered,
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: 18,
    borderWidth: 1,
    borderColor: color.surfaceBorder,
  },
  elevated: {
    ...shadow.sm,
    borderColor: color.surfaceBorder,
  },
  bordered: {
    borderColor: color.surfaceBorderDark,
    backgroundColor: color.surfaceHover,
  }
});
