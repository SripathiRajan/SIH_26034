import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { color, font, radius, space } from '../theme/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  category?: string;
  swatchColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
}

export default function ListRow({
  title,
  subtitle,
  category,
  swatchColor = color.accent,
  right,
  onPress,
  showDivider = true,
}: ListRowProps) {
  const content = (
    <>
      <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle} {category ? `· ${category}` : ''}
        </Text>
      </View>
      {right}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.row, showDivider && styles.divider]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.row, showDivider && styles.divider]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: color.surfaceBorder,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    opacity: 0.9,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: font.size.body,
    color: color.ink,
    fontWeight: font.weight.semibold,
  },
  subtitle: {
    fontSize: font.size.xs,
    color: color.slate,
    marginTop: 2,
  },
});
