import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, font, radius, space } from '../theme/tokens';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search scans, rules, or brands...',
  onClear,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Feather name="search" size={16} color={color.slate} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.mist}
      />
      {value ? (
        <TouchableOpacity
          onPress={() => {
            onChangeText('');
            if (onClear) onClear();
          }}
          hitSlop={8}
        >
          <Feather name="x-circle" size={16} color={color.slate} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceElevated,
    borderColor: color.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  searchIcon: {
    marginRight: space.xs,
  },
  input: {
    flex: 1,
    color: color.ink,
    fontSize: font.size.sm,
    paddingVertical: 2,
  },
});
