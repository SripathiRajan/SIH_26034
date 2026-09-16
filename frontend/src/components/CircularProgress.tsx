import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color, font } from '../theme/tokens';

interface CircularProgressProps {
  percentage: number; // 0 - 100
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
  label?: string;
}

export default function CircularProgress({
  percentage,
  size = 90,
  strokeWidth = 8,
  accentColor = color.pass,
  label = 'Score',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          stroke="rgba(255, 255, 255, 0.1)"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={accentColor}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textWrap}>
        <Text style={[styles.percentageText, { color: accentColor }]}>{percentage}%</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  labelText: {
    fontSize: 9,
    color: color.slate,
    fontWeight: font.weight.medium,
    marginTop: -2,
    textTransform: 'uppercase',
  },
});
