import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { pramanColor, pramanFont, shadow } from '../theme/tokens';
import { UserRole } from '../types';

interface RoleOption {
  key: UserRole;
  label: string;
}

const ROLES: RoleOption[] = [
  { key: 'officer', label: 'Field Officer' },
  { key: 'admin', label: 'Dept. Admin' },
  { key: 'viewer', label: 'Viewer' },
];

interface Props {
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export default function RoleTabs({ selectedRole, onSelectRole }: Props) {
  const { width } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const selectedIndex = ROLES.findIndex((r) => r.key === selectedRole);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedIndex,
      useNativeDriver: Platform.OS !== 'web',
      friction: 8,
      tension: 50,
    }).start();
  }, [selectedIndex, slideAnim]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Select Access Role</Text>
      
      {/* Segmented Control Container */}
      <View style={styles.segmentContainer}>
        {ROLES.map((role) => {
          const isActive = selectedRole === role.key;
          return (
            <TouchableOpacity
              key={role.key}
              style={[
                styles.tabButton,
                isActive && styles.activeTabButton,
              ]}
              onPress={() => onSelectRole(role.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Select ${role.label} role`}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.activeTabText,
                ]}
                numberOfLines={1}
              >
                {role.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: pramanFont.body,
    fontSize: 11,
    fontWeight: '700',
    color: pramanColor.mutedText,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: pramanColor.tabInactiveBg,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: pramanColor.borderColor,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: pramanColor.cardWhite,
    borderWidth: 1,
    borderColor: '#D0D4C5',
    ...shadow.sm,
  },
  tabText: {
    fontFamily: pramanFont.body,
    fontSize: 12.5,
    fontWeight: '600',
    color: pramanColor.mutedText,
    textAlign: 'center',
  },
  activeTabText: {
    color: pramanColor.deepBlue,
    fontWeight: '700',
  },
});
