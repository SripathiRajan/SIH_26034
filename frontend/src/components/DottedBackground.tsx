import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Svg, { Pattern, Rect, Circle, Defs } from 'react-native-svg';
import { pramanColor } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
}

export default function DottedBackground({ children }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      {/* Subtle Dotted Paper Texture SVG Overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id="dot-pattern"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <Circle cx="12" cy="12" r="1.2" fill="#CBD0C0" opacity={0.45} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dot-pattern)" />
        </Svg>
      </View>

      {/* Main Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: pramanColor.bgIvory,
    position: 'relative',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
