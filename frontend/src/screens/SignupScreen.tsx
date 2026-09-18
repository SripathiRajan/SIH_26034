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
import { api } from '../api/client';

interface Props {
  onSignup?: (user: OfficerUser) => void;
  onNavigateToLogin?: () => void;
}

function PersonIcon({ color = pramanColor.mutedText }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

function BadgeIcon({ color = pramanColor.mutedText }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 15l-2 5l2-1l2 1l-2-5" />
      <Circle cx="12" cy="9" r="6" />
    </Svg>
  );
}

function EmailIcon({ color = pramanColor.mutedText }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
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

export default function SignupScreen({ onSignup, onNavigateToLogin }: Props) {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('officer');
  const [fullName, setFullName] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  interface FormErrors {
    fullName?: string;
    officerId?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }
  const [errors, setErrors] = useState<FormErrors>({});

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
    const newErrors: FormErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    }

    if (!officerId.trim()) {
      newErrors.officerId = 'Officer ID / Badge Number is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.trim().length < 6) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Real backend registration; the server locks the role to "inspector"
      // regardless of the selected tab (admins are seeded server-side).
      const username = (email.trim() || officerId.trim()).toLowerCase();
      const reg = await api.register(username, email.trim(), password, fullName.trim());
      if (!reg.success) {
        setIsLoading(false);
        setErrors({ confirmPassword: reg.error || 'Registration failed' });
        return;
      }
      // Auto-login after successful registration to obtain a JWT.
      const res = await login(username, password);
      setIsLoading(false);
      if (!res.success) {
        if (onNavigateToLogin) onNavigateToLogin();
        return;
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrors({ confirmPassword: err?.message || 'Registration failed' });
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
          {/* Centered Signup Card */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Header with 80px Circular Logo Seal & PRAMAN */}
            <LogoHeader />

            {/* Role Selection Segmented Control */}
            <RoleTabs selectedRole={selectedRole} onSelectRole={setSelectedRole} />

            {/* Input 1: Full Name */}
            <CustomInput
              label="Full Name"
              placeholder="e.g. Ramesh Kumar"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              error={errors.fullName}
              isRequired
              icon={<PersonIcon color={fullName ? pramanColor.primaryBlue : pramanColor.mutedText} />}
            />

            {/* Input 2: Officer ID / Badge Number */}
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
              icon={<BadgeIcon color={officerId ? pramanColor.primaryBlue : pramanColor.mutedText} />}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* Input 3: Email */}
            <CustomInput
              label="Email Address"
              placeholder="officer@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              error={errors.email}
              isRequired
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<EmailIcon color={email ? pramanColor.primaryBlue : pramanColor.mutedText} />}
            />

            {/* Input 4: Password */}
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
            />

            {/* Input 5: Confirm Password */}
            <CustomInput
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              error={errors.confirmPassword}
              isPassword
              isRequired
              icon={<LockIcon color={confirmPassword ? pramanColor.primaryBlue : pramanColor.mutedText} />}
              onSubmitEditing={handleCreateAccount}
            />

            {/* Primary Action Button */}
            <PrimaryButton
              title="Create Account"
              onPress={handleCreateAccount}
              isLoading={isLoading}
            />

            {/* Secondary Action: Link back to Sign In */}
            <View style={styles.secondaryRow}>
              <Text style={styles.secondaryText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => {
                  if (onNavigateToLogin) onNavigateToLogin();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLink}>Sign In</Text>
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
    maxWidth: 450,
    backgroundColor: pramanColor.cardWhite,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: pramanColor.borderColor,
    padding: 28,
    ...shadow.lg,
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
  loginLink: {
    fontFamily: pramanFont.body,
    fontSize: 13.5,
    fontWeight: '700',
    color: pramanColor.primaryBlue,
    textDecorationLine: 'underline',
  },
});
