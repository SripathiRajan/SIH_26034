import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import DottedBackground from '../components/DottedBackground';
import LogoHeader from '../components/LogoHeader';
import RoleTabs from '../components/RoleTabs';
import DemoBanner from '../components/DemoBanner';
import CustomInput from '../components/CustomInput';
import PrimaryButton from '../components/PrimaryButton';
import { pramanColor, pramanFont, radius, shadow } from '../theme/tokens';
import { UserRole, OfficerUser } from '../types';
import { useAuth } from '../context/AuthContext';

interface Props {
  onLogin?: (user: OfficerUser) => void;
  onNavigateToSignup?: () => void;
}

function PersonIcon({ color = pramanColor.mutedText }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function LockIcon({ color = pramanColor.mutedText }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

export default function LoginScreen({ onLogin, onNavigateToSignup }: Props) {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('officer');
  const [officerId, setOfficerId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ officerId?: string; password?: string; form?: string }>({});

  // Fade-in animation for card
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const validateForm = () => {
    const newErrors: { officerId?: string; password?: string } = {};

    if (!officerId.trim()) {
      newErrors.officerId = 'Officer ID / Badge Number is required';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Real backend authentication — issues and persists a JWT.
      // Role spoofing is impossible: the role comes from the server user record.
      const res = await login(officerId.trim(), password);
      setIsLoading(false);
      if (!res.success) {
        setErrors({ form: res.error || 'Authentication failed' });
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrors({ form: err?.message || 'Authentication failed' });
    }
  };

  return (
    <DottedBackground>
      <DemoBanner />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Centered Compliance Form Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Header with 80px Circular Logo & Project Name PRAMAN */}
            <LogoHeader />

            {/* Role Selection Segmented Control */}
            <RoleTabs selectedRole={selectedRole} onSelectRole={setSelectedRole} />

            {/* Input 1: Officer ID / Badge Number */}
            <CustomInput
              label="Officer ID / Badge Number"
              placeholder="OFF-2601"
              value={officerId}
              onChangeText={(text) => {
                setOfficerId(text);
                if (errors.officerId) setErrors((prev) => ({ ...prev, officerId: undefined }));
              }}
              error={errors.officerId}
              isRequired
              icon={<PersonIcon color={officerId ? pramanColor.primaryBlue : pramanColor.mutedText} />}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* Input 2: Password */}
            <CustomInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={errors.password}
              isPassword
              isRequired
              icon={<LockIcon color={password ? pramanColor.primaryBlue : pramanColor.mutedText} />}
              onSubmitEditing={handleSignIn}
            />

            {errors.form ? <Text style={styles.formErrorText}>{errors.form}</Text> : null}

            {/* Primary Sign In Button */}
            <PrimaryButton
              title="Sign in to PRAMAN"
              onPress={handleSignIn}
              isLoading={isLoading}
            />

            {/* Secondary Action: Create Account */}
            <View style={styles.secondaryRow}>
              <Text style={styles.secondaryText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => {
                  if (onNavigateToSignup) onNavigateToSignup();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DottedBackground>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: pramanColor.cardWhite,
    borderRadius: radius.md, // 12px rounded corners
    borderWidth: 1,
    borderColor: pramanColor.borderColor,
    padding: 28,
    ...shadow.lg,
  },
  formErrorText: {
    fontFamily: pramanFont.body,
    color: pramanColor.dangerRed,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  secondaryText: {
    fontFamily: pramanFont.body,
    fontSize: 13.5,
    color: pramanColor.mutedText,
  },
  signupLink: {
    fontFamily: pramanFont.body,
    fontSize: 13.5,
    fontWeight: '700',
    color: pramanColor.primaryBlue,
    textDecorationLine: 'underline',
  },
});
