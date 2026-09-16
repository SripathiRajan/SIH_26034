import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { color, font, radius, space } from '../theme/tokens';
import { gradients } from '../theme/gradients';
import { ChatMessage } from '../types';

export default function ChatBubble({ message }: { message: ChatMessage }) {
  const isOfficer = message.role === 'officer';

  if (isOfficer) {
    return (
      <View style={[styles.bubbleWrap, styles.officerWrap]}>
        <LinearGradient
          colors={gradients.accent as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.officerBubble}
        >
          <Text style={styles.officerText}>{message.text}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrap, styles.assistantWrap]}>
      <View style={styles.assistantAvatar}>
        <Feather name="shield" size={14} color={color.accent} />
      </View>

      <View style={styles.assistantBubble}>
        <Text style={styles.assistantTitle}>Legal Metrology AI Assistant</Text>
        <Text style={styles.assistantText}>{message.text}</Text>

        {message.citations && message.citations.length > 0 ? (
          <View style={styles.citationsRow}>
            {message.citations.map((citation, i) => (
              <View key={i} style={styles.citationBadge}>
                <Feather name="book-open" size={10} color={color.accentCyan} />
                <Text style={styles.citationText}>{citation}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {message.sources && message.sources.length > 0 ? (
          <View style={styles.sourcesFooter}>
            <Text style={styles.sourcesLabel}>Sources: {message.sources.join(' · ')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: {
    marginVertical: space.xs,
    maxWidth: '88%',
  },
  officerWrap: {
    alignSelf: 'flex-end',
  },
  assistantWrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  officerBubble: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
  },
  officerText: {
    color: color.white,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    lineHeight: 20,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  assistantBubble: {
    flex: 1,
    backgroundColor: color.surfaceElevated,
    borderColor: color.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.xs,
    padding: space.md,
  },
  assistantTitle: {
    fontSize: 11,
    fontWeight: font.weight.bold,
    color: color.accent,
    marginBottom: space.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assistantText: {
    color: color.ink,
    fontSize: font.size.sm,
    lineHeight: 21,
  },
  citationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space.sm,
  },
  citationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: space.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  citationText: {
    fontSize: 10,
    color: color.accentCyan,
    fontWeight: font.weight.semibold,
  },
  sourcesFooter: {
    marginTop: space.xs + 2,
    borderTopWidth: 1,
    borderTopColor: color.surfaceBorder,
    paddingTop: space.xs,
  },
  sourcesLabel: {
    fontSize: 10,
    color: color.slate,
  },
});
