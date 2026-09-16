import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { pramanColor, pramanFont, radius } from '../theme/tokens';

interface CustomInputProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
  isRequired?: boolean;
  icon?: React.ReactNode;
}

function EyeIcon({ open = false }: { open?: boolean }) {
  if (open) {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={pramanColor.accentBlue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <Circle cx="12" cy="12" r="3" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={pramanColor.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Path d="M1 1l22 22" />
    </Svg>
  );
}

export default function CustomInput({
  label,
  error,
  isPassword = false,
  isRequired = false,
  icon,
  style,
  value,
  onChangeText,
  placeholder,
  ...restProps
}: CustomInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {/* Field Label */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isRequired && <Text style={styles.requiredStar}>*</Text>}
      </View>

      {/* Input Wrapper */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
      >
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

        <TextInput
          style={[
            styles.input,
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
            style,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={pramanColor.mutedText}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
          accessibilityHint={`Enter ${label}`}
          {...restProps}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={showPassword} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: pramanFont.body,
    fontSize: 11.5,
    fontWeight: '700',
    color: pramanColor.darkText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: pramanColor.dangerRed,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: pramanColor.inputBg,
    borderWidth: 1.2,
    borderColor: pramanColor.borderColor,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
  },
  inputFocused: {
    borderColor: pramanColor.accentBlue,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: pramanColor.dangerRed,
    backgroundColor: pramanColor.dangerBg,
  },
  iconWrap: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: pramanFont.mono,
    fontSize: 14,
    color: pramanColor.deepBlue,
    height: 48,
    paddingVertical: 8,
  },
  eyeBtn: {
    padding: 8,
    marginLeft: 4,
  },
  errorText: {
    fontFamily: pramanFont.body,
    color: pramanColor.dangerRed,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
    fontWeight: '500',
  },
});
