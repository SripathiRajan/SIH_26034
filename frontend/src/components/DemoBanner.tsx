import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DEMO_MODE } from '../api/config';

export default function DemoBanner() {
  if (!DEMO_MODE) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>⚠ DEMO — SAMPLE DATA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 9999,
  },
  bannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
