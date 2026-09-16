import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { color, font, radius, space } from '../theme/tokens';
import StatusPill from './StatusPill';
import { FieldCheck } from '../types';

export default function ComplianceFieldCard({ field }: { field: FieldCheck }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setExpanded(!expanded)}
      style={[
        styles.card,
        field.status === 'fail'
          ? styles.borderFail
          : field.status === 'warning'
          ? styles.borderWarning
          : styles.borderPass,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.leftCol}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          {field.extractedValue ? (
            <Text style={styles.extractedText} numberOfLines={expanded ? undefined : 1}>
              Extracted: <Text style={styles.valueHighlight}>{field.extractedValue}</Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.rightCol}>
          <StatusPill status={field.status} />
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={color.slate}
            style={styles.chevron}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />
          
          {field.detail ? (
            <View style={styles.detailRow}>
              <Feather name="info" size={13} color={color.warning} />
              <Text style={styles.detailText}>{field.detail}</Text>
            </View>
          ) : null}

          {field.ruleExplanation ? (
            <Text style={styles.explanationText}>{field.ruleExplanation}</Text>
          ) : null}

          <View style={styles.metaRow}>
            {field.ruleRef ? (
              <View style={styles.citationBadge}>
                <Feather name="bookmark" size={11} color={color.accent} />
                <Text style={styles.citationText}>{field.ruleRef}</Text>
              </View>
            ) : null}
            {field.confidence ? (
              <Text style={styles.confidenceText}>OCR Confidence: {field.confidence}%</Text>
            ) : null}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surfaceElevated,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
  },
  borderPass: {
    borderColor: color.surfaceBorder,
  },
  borderWarning: {
    borderColor: color.warningBorder,
  },
  borderFail: {
    borderColor: color.failBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    flex: 1,
    paddingRight: space.xs,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  fieldLabel: {
    fontSize: font.size.body,
    fontWeight: font.weight.semibold,
    color: color.ink,
  },
  extractedText: {
    fontSize: font.size.xs,
    color: color.slate,
    marginTop: 3,
  },
  valueHighlight: {
    color: color.white,
    fontWeight: font.weight.medium,
  },
  chevron: {
    marginLeft: 4,
  },
  expandedContent: {
    marginTop: space.sm,
  },
  divider: {
    height: 1,
    backgroundColor: color.surfaceBorder,
    marginVertical: space.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.xs,
    backgroundColor: color.warningSoft,
    padding: space.xs + 2,
    borderRadius: radius.sm,
  },
  detailText: {
    fontSize: font.size.xs,
    color: color.warning,
    flex: 1,
    fontWeight: font.weight.medium,
  },
  explanationText: {
    fontSize: font.size.xs,
    color: color.slate,
    lineHeight: 18,
    marginBottom: space.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  citationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: color.accentSoft,
    paddingHorizontal: space.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  citationText: {
    fontSize: 11,
    color: color.accent,
    fontWeight: font.weight.semibold,
  },
  confidenceText: {
    fontSize: 11,
    color: color.mist,
  },
});
