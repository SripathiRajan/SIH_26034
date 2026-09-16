import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { pramanColor, pramanFont, shadow } from '../theme/tokens';
import { PRAMAN_LOGO_BASE64 } from '../assets/pramanLogoBase64';

interface Props {
  subtitle?: string;
}

export default function LogoHeader({ subtitle }: Props) {
  return (
    <View style={styles.container}>
      {/* 80px Circular Seal Outer Ring */}
      <View style={styles.sealWrapper}>
        <View style={styles.sealRing}>
          <Image
            source={require('../assets/praman-logo.png')}
            defaultSource={{ uri: PRAMAN_LOGO_BASE64 }}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* App Name PRAMAN */}
      <Text style={styles.appName}>PRAMAN</Text>

      {/* Optional Subtitle */}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  sealWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F3EFE6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: pramanColor.borderColor,
    marginBottom: 12,
    ...shadow.sm,
  },
  sealRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5C9BA',
    shadowColor: pramanColor.deepBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  appName: {
    fontFamily: pramanFont.heading,
    fontSize: 28,
    fontWeight: '700',
    color: pramanColor.deepBlue,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: pramanFont.body,
    fontSize: 10.5,
    fontWeight: '600',
    color: pramanColor.mutedText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
  },
});
