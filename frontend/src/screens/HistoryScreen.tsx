import { api } from '../api/client';
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, useWindowDimensions, Platform } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import StatusPill from '../components/StatusPill';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { recentScans } from '../data/mockData';

interface Props {
  navigation: any;
}

function SearchIcon({ color = '#5D6178', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  );
}

function ClearIcon({ color = '#5D6178', size = 14 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18" />
      <Path d="M6 6l12 12" />
    </Svg>
  );
}

function DownloadIcon({ size = 14, color = '#17B897' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

function PlusIcon({ size = 14, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

const FILTERS = [
  { key: 'all', label: 'All Inspections' },
  { key: 'pass', label: 'Compliant' },
  { key: 'warning', label: 'Review Needed' },
  { key: 'fail', label: 'Non-Compliant' },
];

const DATE_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

const SORT_OPTIONS = [
  { key: 'date', label: 'Date ↓' },
  { key: 'status', label: 'Status' },
  { key: 'brand', label: 'Brand A–Z' },
];

function exportCsv(scans: typeof recentScans) {
  if (Platform.OS !== 'web') return;
  const header = ['Audit ID', 'Product Name', 'Brand', 'Category', 'Net Quantity', 'Status', 'Compliance Confidence', 'Scanned At'];
  const rows = scans.map((s) => [
    s.id, s.productName, s.brand, s.category || 'General',
    s.netWeight, s.status, s.complianceConfidence,
    s.scannedAt ? new Date(s.scannedAt).toLocaleString('en-IN') : ''
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `legal-metrology-audits-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryScreen({ navigation }: Props) {
  const [liveScans, setLiveScans] = useState<any[]>(DEMO_MODE ? recentScans : []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.listScans().then((data) => {
        if (!cancelled && data && data.length > 0) setLiveScans(data);
      }).catch(() => {});
    };
    load();
    // Retry once: the OCR backend may still be warming up on first mount,
    // and listScans failures leave the list empty (no silent mock fallback).
    const retry = setTimeout(load, 4000);
    return () => { cancelled = true; clearTimeout(retry); };
  }, []);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('history-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'history-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
        document.head.appendChild(fontLink);
      }
    }
  }, []);

  const filteredScans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    let results = liveScans.filter((scan) => {
      const matchesFilter = filter === 'all' ? true : scan.status === filter;
      if (!matchesFilter) return false;

      if (dateFilter !== 'all' && scan.scannedAt) {
        const scanDate = new Date(scan.scannedAt);
        if (dateFilter === 'today') {
          const isToday = scanDate.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (scanDate < weekAgo) return false;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (scanDate < monthAgo) return false;
        }
      }

      if (!q) return true;

      const inId = scan.id ? scan.id.toLowerCase().includes(q) : false;
      const inProduct = scan.productName ? scan.productName.toLowerCase().includes(q) : false;
      const inBrand = scan.brand ? scan.brand.toLowerCase().includes(q) : false;
      const inCategory = scan.category ? scan.category.toLowerCase().includes(q) : false;
      const inNetWeight = scan.netWeight ? scan.netWeight.toLowerCase().includes(q) : false;

      return inId || inProduct || inBrand || inCategory || inNetWeight;
    });

    if (sortBy === 'date') {
      results = results.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
    } else if (sortBy === 'status') {
      const order: Record<string, number> = { fail: 0, warning: 1, pass: 2 };
      results = results.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    } else if (sortBy === 'brand') {
      results = results.sort((a, b) => a.brand.localeCompare(b.brand));
    }

    return results;
  }, [filter, searchQuery, dateFilter, sortBy]);

  return (
    <View style={{ flex: 1 }}>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
        {/* Header Panel */}
      <View style={[styles.headerBanner, isMobile && styles.mobileHeaderBanner]}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowBadge}>
            <Text style={styles.eyebrowBadgeText}>ENFORCEMENT AUDIT LOGS</Text>
          </View>
          <Text style={[styles.headerTitle, isMobile && styles.mobileTitle]}>Inspection History</Text>
          <Text style={styles.headerSubtitle}>{filteredScans.length} verified audit records in central database</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.csvBtn}
              onPress={() => exportCsv(filteredScans)}
              activeOpacity={0.85}
            >
              <Text style={styles.csvBtnText}>Export CSV</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Capture')}
            activeOpacity={0.85}
          >
            <PlusIcon size={14} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>New Inspection</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Controls */}
      <View style={styles.controlsCard}>
        <View style={styles.searchBox}>
          <SearchIcon color="#5D6178" size={16} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by product name, brand, category, or audit ID..."
            placeholderTextColor="#9498AC"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <ClearIcon color="#5D6178" size={14} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filters */}
        <View style={[styles.filterRow, isMobile && { flexWrap: 'wrap' }]}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date + Sort Options */}
        <View style={[styles.filterRow, isMobile && { flexWrap: 'wrap' }]}>
          <Text style={styles.filterGroupLabel}>Date:</Text>
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setDateFilter(f.key)}
                style={[styles.filterChip, active && styles.dateChipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterLabel, active && styles.dateLabelActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ flex: 1 }} />
          <Text style={styles.filterGroupLabel}>Sort:</Text>
          {SORT_OPTIONS.map((s) => {
            const active = sortBy === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => setSortBy(s.key)}
                style={[styles.filterChip, active && styles.sortChipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterLabel, active && styles.sortLabelActive]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Audit Table Card */}
      <View style={styles.tableCard}>
        {!isMobile && (
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1.2 }]}>AUDIT ID</Text>
            <Text style={[styles.th, { flex: 2.2 }]}>PRODUCT & BRAND</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>CATEGORY</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>NET QTY</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>STATUS</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>ACTION</Text>
          </View>
        )}

        {filteredScans.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No audit records match your current filter settings.</Text>
          </View>
        ) : (
          filteredScans.map((item, idx) => (
            <View key={item.id || idx} style={[
              styles.tr, 
              isMobile && styles.trMobile,
              idx === filteredScans.length - 1 && styles.trLast
            ]}>
              <View style={{ flex: isMobile ? undefined : 1.2 }}>
                <Text style={styles.tdBold}>{item.id}</Text>
                <Text style={styles.tdSub}>{item.scannedAt ? item.scannedAt.slice(0, 10) : '2026-09-14'}</Text>
              </View>

              <View style={{ flex: isMobile ? undefined : 2.2, marginVertical: isMobile ? 4 : 0 }}>
                <Text style={styles.tdMain}>{item.productName}</Text>
                <Text style={styles.tdSub}>{item.brand} · {item.netWeight || 'N/A'}</Text>
              </View>

              <View style={{ flex: isMobile ? undefined : 1.5, marginVertical: isMobile ? 2 : 0 }}>
                <Text style={styles.tdSub}>{item.category || 'General'}</Text>
              </View>

              <View style={{ flex: isMobile ? undefined : 1.2, marginVertical: isMobile ? 2 : 0 }}>
                <Text style={styles.tdSub}>{item.netWeight || 'N/A'}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: isMobile ? undefined : 2.2, marginTop: isMobile ? 6 : 0 }}>
                <StatusPill status={item.status} size="sm" />

                <TouchableOpacity 
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('Result', { scanData: item })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>View Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  csvBtn: {
    backgroundColor: '#00C2A8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  csvBtnText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    color: '#06342C',
    fontWeight: '700',
    fontSize: 12.5,
  },

  /* Controls Card */
  controlsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E5F0',
    marginBottom: 20,
    gap: 12,
  },
  searchBox: {
    backgroundColor: '#F3F4FA',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E4E5F0',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 13.5,
    color: '#12141C',
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  filterChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterLabel: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 12,
    color: '#5D6178',
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  filterGroupLabel: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5D6178',
  },
  dateChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  dateLabelActive: {
    color: '#6C5CE7',
  },
  sortChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  sortLabelActive: {
    color: '#6C5CE7',
  },

  /* Table Card */
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E5F0',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4FA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E5F0',
  },
  th: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '700',
    color: '#5D6178',
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E5F0',
  },
  trMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 16,
  },
  trLast: {
    borderBottomWidth: 0,
  },
  tdBold: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 13,
    fontWeight: '700',
    color: '#25396B',
  },
  tdMain: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 13.5,
    color: '#12141C',
    fontWeight: '600',
  },
  tdSub: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 12,
    color: '#9498AC',
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6C5CE7',
    backgroundColor: '#EEF2FF',
  },
  actionBtnText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    color: '#5D6178',
    fontSize: 13.5,
  },
});
