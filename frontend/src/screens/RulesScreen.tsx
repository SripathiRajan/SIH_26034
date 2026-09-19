import { api } from '../api/client';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, useWindowDimensions, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import DemoBanner from '../components/DemoBanner';
import { rulesDatabase } from '../data/rulesDatabase';

type RuleCategory = 'all' | 'mandatory' | 'font-size' | 'mrp' | 'consumer-care' | 'penalty' | 'packaging';

const CATEGORY_FILTERS: { key: RuleCategory; label: string; col: string; bg: string; border: string }[] = [
  { key: 'all', label: 'All Rules', col: '#6C5CE7', bg: '#EEF2FF', border: '#C7D2FE' },
  { key: 'mandatory', label: 'Mandatory', col: '#00C2A8', bg: '#E6F9F6', border: '#99F6E4' },
  { key: 'mrp', label: 'MRP & USP', col: '#FFB020', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'font-size', label: 'Font Size', col: '#6C5CE7', bg: '#EEF2FF', border: '#C7D2FE' },
  { key: 'consumer-care', label: 'Consumer Care', col: '#00C2A8', bg: '#E6F9F6', border: '#99F6E4' },
  { key: 'packaging', label: 'Packaging', col: '#25396B', bg: '#F3F4FA', border: '#E4E5F0' },
  { key: 'penalty', label: 'Penalties', col: '#FF5C5C', bg: '#FFF0F0', border: '#FFD1D1' },
];

function SearchIcon({ col = '#5D6178', size = 16 }: { col?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

export default function RulesScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(rulesDatabase[0]?.id || null);
  const [activeCategory, setActiveCategory] = useState<RuleCategory>('all');
  const [allRules, setAllRules] = useState<any[]>(rulesDatabase);

  useEffect(() => {
    api.getRules().then((data) => {
      if (data && data.length > 0) setAllRules(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('rules-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'rules-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
        document.head.appendChild(fontLink);
      }
    }
  }, []);

  const filteredRules = allRules.filter((rule) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      rule.section.toLowerCase().includes(q) ||
      rule.title.toLowerCase().includes(q) ||
      rule.summary.toLowerCase().includes(q) ||
      rule.tags.some((tag) => tag.toLowerCase().includes(q));
    const matchesCategory = activeCategory === 'all' || rule.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const activeCat = CATEGORY_FILTERS.find((c) => c.key === activeCategory)!;

  return (
    <View style={{ flex: 1 }}>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
        {/* Header Banner */}
      <View style={[styles.headerBanner, isMobile && styles.mobileHeaderBanner]}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowBadge}>
            <Text style={styles.eyebrowBadgeText}>STATUTORY RULES DATABASE</Text>
          </View>
          <Text style={[styles.headerTitle, isMobile && styles.mobileTitle]}>Legal Metrology Rules, 2011</Text>
          <Text style={styles.headerSubtitle}>
            Official statutory rules, gazette notifications & penalty provisions — Department of Consumer Affairs
          </Text>
        </View>
        <View style={styles.ruleCountBox}>
          <Text style={styles.ruleCountNum}>{rulesDatabase.length}</Text>
          <Text style={styles.ruleCountLabel}>Rules</Text>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <SearchIcon col="#5D6178" size={16} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search section, keyword, MRP, font height, penalty..."
            placeholderTextColor="#9498AC"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catRow}>
        {CATEGORY_FILTERS.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.catChip,
                isActive && { backgroundColor: cat.bg, borderColor: cat.border, borderWidth: 1.5 }
              ]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.catChipText, isActive && { color: cat.col, fontWeight: '700' }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results Label */}
      <Text style={styles.resultsLabel}>
        {filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''} found
        {activeCategory !== 'all' ? ` in ${activeCat.label}` : ''}
        {searchQuery ? ` matching "${searchQuery}"` : ''}
      </Text>

      {/* Rules Accordion List */}
      <View style={styles.rulesList}>
        {filteredRules.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No statutory rules match your search criteria.</Text>
          </View>
        ) : (
          filteredRules.map((rule) => {
            const isExpanded = expandedId === rule.id;
            const catInfo = CATEGORY_FILTERS.find((c) => c.key === rule.category) || CATEGORY_FILTERS[0];
            return (
              <View key={rule.id} style={styles.ruleCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setExpandedId(isExpanded ? null : rule.id)}
                  style={[styles.cardHeader, isMobile && { flexDirection: 'column', gap: 8 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>{rule.section}</Text>
                    </View>
                    <View style={[styles.catBadge, { backgroundColor: catInfo.bg, borderColor: catInfo.border }]}>
                      <Text style={[styles.catBadgeText, { color: catInfo.col }]}>{catInfo.label}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    <Text style={styles.ruleSummary} numberOfLines={isExpanded ? undefined : 2}>
                      {rule.summary}
                    </Text>
                  </View>
                  <View style={styles.expandToggle}>
                    <Text style={styles.expandToggleText}>{isExpanded ? 'Hide ▲' : 'View Rule ▼'}</Text>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.divider} />
                    <Text style={styles.fullTextHeader}>📋 Statutory Provision:</Text>
                    <Text style={styles.fullText}>{rule.fullText}</Text>

                    {rule.penalty && (
                      <View style={styles.penaltyBox}>
                        <Text style={styles.penaltyHeading}>⚖ Penalty Provision:</Text>
                        <Text style={styles.penaltyText}>{rule.penalty}</Text>
                      </View>
                    )}

                    {rule.amendment ? (
                      <View style={styles.amendmentBox}>
                        <Text style={styles.amendmentHeading}>📌 Gazette Amendment Note:</Text>
                        <Text style={styles.amendmentText}>{rule.amendment}</Text>
                      </View>
                    ) : null}

                    <View style={styles.tagsRow}>
                      {rule.tags.map((tag, idx) => (
                        <View key={idx} style={styles.tagChip}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Footer Citation Note */}
      <View style={styles.footerNote}>
        <Text style={styles.footerNoteText}>
          Legal Metrology (Packaged Commodities) Rules, 2011 & Gazette Amendments — Ministry of Consumer Affairs, Food & Public Distribution, Government of India.
        </Text>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4FA',
  },
  contentContainer: {
    padding: 24,
    maxWidth: 1120,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  mobileContent: {
    padding: 16,
    paddingBottom: 96,
  },

  /* Header Banner */
  headerBanner: {
    backgroundColor: '#25396B',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 24,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#101B3D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  mobileHeaderBanner: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 20,
    gap: 16,
  },
  eyebrowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 168, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 8,
  },
  eyebrowBadgeText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 10.5,
    fontWeight: '700',
    color: '#00C2A8',
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mobileTitle: {
    fontSize: 20,
  },
  headerSubtitle: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 13.5,
    color: '#B9BFDA',
    maxWidth: 620,
  },
  ruleCountBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 194, 168, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 194, 168, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 70,
  },
  ruleCountNum: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 26,
    fontWeight: '700',
    color: '#00C2A8',
  },
  ruleCountLabel: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 10,
    color: '#00C2A8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  /* Search Card */
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E5F0',
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 6,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13.5,
    color: '#12141C',
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  clearBtn: {
    fontSize: 14,
    color: '#5D6178',
    paddingHorizontal: 6,
  },

  /* Category Scroll */
  catScroll: {
    marginBottom: 12,
  },
  catRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  catChipText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 12,
    color: '#5D6178',
    fontWeight: '600',
  },
  resultsLabel: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 12,
    color: '#9498AC',
    marginBottom: 16,
    fontWeight: '500',
  },

  /* Rules List */
  rulesList: {
    gap: 14,
    marginBottom: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  emptyText: {
    color: '#5D6178',
    fontSize: 13.5,
  },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  sectionBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sectionBadgeText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  catBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  catBadgeText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 10.5,
    fontWeight: '700',
  },
  ruleTitle: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 16,
    fontWeight: '700',
    color: '#25396B',
    marginBottom: 4,
    marginTop: 4,
  },
  ruleSummary: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 13,
    color: '#5D6178',
    lineHeight: 20,
  },
  expandToggle: {
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  expandToggleText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5D6178',
  },

  /* Expanded Section */
  expandedSection: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E4E5F0',
    marginBottom: 14,
  },
  fullTextHeader: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 12,
    fontWeight: '700',
    color: '#6C5CE7',
    marginBottom: 6,
  },
  fullText: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 13.5,
    color: '#12141C',
    lineHeight: 22,
  },
  penaltyBox: {
    backgroundColor: '#FFF0F0',
    borderColor: '#FFD1D1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  penaltyHeading: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 12,
    fontWeight: '700',
    color: '#FF5C5C',
    marginBottom: 2,
  },
  penaltyText: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 12.5,
    color: '#C23A3A',
    lineHeight: 19,
  },
  amendmentBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  amendmentHeading: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 12,
    fontWeight: '700',
    color: '#B9760A',
    marginBottom: 2,
  },
  amendmentText: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 12.5,
    color: '#B9760A',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
  },
  tagChip: {
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '600',
    color: '#5D6178',
  },
  footerNote: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#25396B',
    borderRadius: 14,
  },
  footerNoteText: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 11.5,
    color: '#B9BFDA',
    lineHeight: 18,
    textAlign: 'center',
  },
});
