import { api } from '../api/client';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import DemoBanner from '../components/DemoBanner';
import { DEMO_MODE } from '../api/config';
import { dashboardStats } from '../data/mockData';

/* SVG Vector Icons */
function ScanIcon({ size = 16, color = '#6C5CE7' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Line x1="7" y1="8" x2="17" y2="8" />
      <Line x1="7" y1="12" x2="17" y2="12" />
      <Line x1="7" y1="16" x2="13" y2="16" />
    </Svg>
  );
}

function AlertTriangleIcon({ size = 16, color = '#F0544B' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

function CheckCircleIcon({ size = 16, color = '#17B897' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Path d="M22 4L12 14.01l-3-3" />
    </Svg>
  );
}

function ShieldAlertIcon({ size = 16, color = '#F5A623' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Line x1="12" y1="8" x2="12" y2="12" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
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

function FileTextIcon({ size = 14, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
      <Line x1="10" y1="9" x2="8" y2="9" />
    </Svg>
  );
}

/* Donut SVG Chart Component */
function DonutChart({ compliant = 83, review = 11, nonCompliant = 6 }: { compliant?: number; review?: number; nonCompliant?: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  
  const cDash = (compliant / 100) * circumference;
  const rDash = (review / 100) * circumference;
  const nDash = (nonCompliant / 100) * circumference;

  const cOffset = 0;
  const rOffset = -cDash;
  const nOffset = -(cDash + rDash);

  return (
    <View style={{ width: 100, height: 100, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={100} height={100} viewBox="0 0 100 100">
        {/* Background track */}
        <Circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" />
        {/* Compliant (Teal) */}
        <Circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#17B897"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${cDash} ${circumference}`}
          strokeDashoffset={cOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Review (Amber) */}
        <Circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#F5A623"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${rDash} ${circumference}`}
          strokeDashoffset={rOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Non-Compliant (Coral) */}
        <Circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#F0544B"
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${nDash} ${circumference}`}
          strokeDashoffset={nOffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System', fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>{compliant}%</Text>
        <Text style={{ fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System', fontSize: 9, fontWeight: '600', color: '#17B897' }}>PASS</Text>
      </View>
    </View>
  );
}

const EMPTY_DASHBOARD_STATS: any = {
  totalScans: 0,
  violationRate: 0,
  authenticityFlags: 0,
  avgSecondsPerScan: 0,
  compliantCount: 0,
  nonCompliantCount: 0,
  topViolationFields: [],
  topFlaggedBrands: [],
  dailyCounts: [],
  categoryBreakdown: [],
  zoneBreakdown: [],
};

const CATEGORY_COLORS = ['#6C5CE7', '#17B897', '#F5A623', '#F0544B', '#5B468D', '#1F2748'];

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [stats, setStats] = useState<any>(DEMO_MODE ? dashboardStats : EMPTY_DASHBOARD_STATS);

  useEffect(() => {
    api.getDashboardStats().then((data) => {
      if (data && typeof data.totalScans === 'number') setStats(data);
    }).catch(() => {});
  }, []);
  const [activeTab, setActiveTab] = useState<'weekly' | 'category' | 'zone'>('weekly');

  const maxDailyTotal = Math.max(1, ...(stats.dailyCounts || []).map((d: any) => (d.pass || 0) + (d.warning || 0) + (d.fail || 0)));
  const maxCategoryCount = Math.max(1, ...(stats.categoryBreakdown || []).map((c: any) => c.count || 0));

  // Inject Web CSS & Plus Jakarta Sans Font
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('analytics-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'analytics-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(fontLink);
      }
    }
  }, []);

  // ── Hero computed values (derived from real API stats) ──────────────────
  const heroTotal = stats.totalScans || 0;
  const heroCompliant = stats.compliantCount || 0;
  // warning = total − compliant − nonCompliant (backend rolls needs_review into nonCompliant)
  const heroNonCompliant = stats.nonCompliantCount || 0;
  const heroReview = Math.max(0, heroTotal - heroCompliant - heroNonCompliant);
  const heroCompliantPct = heroTotal > 0 ? Math.round((heroCompliant / heroTotal) * 100) : 0;
  const heroReviewPct = heroTotal > 0 ? Math.round((heroReview / heroTotal) * 100) : 0;
  // Give all remainder to non-compliant so percentages always sum to 100
  const heroNonCompliantPct = heroTotal > 0 ? Math.max(0, 100 - heroCompliantPct - heroReviewPct) : 0;

  const zoneCount = (stats.zoneBreakdown || []).length;
  const heroSubtitleZone = zoneCount > 0
    ? `Real-time compliance telemetry, field audit risks, and rule violation frequencies across ${zoneCount} enforcement zone${zoneCount !== 1 ? 's' : ''}.`
    : 'Real-time compliance telemetry, field audit risks, and rule violation frequencies.';

  return (
    <View style={{ flex: 1 }}>
      <DemoBanner />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isMobile && styles.mobileContent]}>
        {/* 1. TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.topBarTitle}>ENFORCEMENT ANALYTICS</Text>
        </View>
        <View style={styles.topBarRight}>
          <View style={styles.liveBadgePill}>
            <View style={[styles.liveDot, { backgroundColor: '#17B897' }]} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
          <View style={styles.zoneAvatar}>
            <Text style={styles.zoneAvatarText}>{zoneCount > 0 ? `${zoneCount}Z` : '—'}</Text>
          </View>
        </View>
      </View>

      {/* 2. HERO SECTION */}
      <View style={[styles.heroPanel, isMobile && styles.heroPanelMobile]}>
        <View style={[styles.heroLeft, isMobile ? styles.heroLeftMobile : styles.heroLeftDesktop]}>
          <View style={styles.rulesPill}>
            <Text style={styles.rulesPillText}>Legal Metrology (PC) Rules, 2011</Text>
          </View>
          <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile]}>
            {heroTotal > 0
              ? `${heroTotal.toLocaleString('en-IN')} scans total.\nHere's what's holding up.`
              : `No scans yet.\nStart your first inspection.`}
          </Text>
          <Text style={styles.heroSubtitle}>{heroSubtitleZone}</Text>

          <View style={styles.heroCtaGroup}>
            <TouchableOpacity style={styles.violetBtn} activeOpacity={0.85}>
              <FileTextIcon size={14} color="#FFFFFF" />
              <Text style={styles.violetBtnText}>View full audit log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tealBtn} activeOpacity={0.85}>
              <DownloadIcon size={14} color="#17B897" />
              <Text style={styles.tealBtnText}>Export this report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Right: Translucent Donut Card (hidden when no data) */}
        {heroTotal > 0 ? (
          <View style={[styles.heroDonutCard, isMobile && styles.heroDonutCardMobile]}>
            <Text style={styles.donutCardTitle}>Overall breakdown</Text>
            <View style={styles.donutRow}>
              <DonutChart compliant={heroCompliantPct} review={heroReviewPct} nonCompliant={heroNonCompliantPct} />
              <View style={styles.donutLegendCol}>
                <View style={styles.donutLegendItem}>
                  <View style={[styles.donutDot, { backgroundColor: '#17B897' }]} />
                  <Text style={styles.donutLegendText}>{heroCompliantPct}% Compliant</Text>
                </View>
                <View style={styles.donutLegendItem}>
                  <View style={[styles.donutDot, { backgroundColor: '#F5A623' }]} />
                  <Text style={styles.donutLegendText}>{heroReviewPct}% Review</Text>
                </View>
                <View style={styles.donutLegendItem}>
                  <View style={[styles.donutDot, { backgroundColor: '#F0544B' }]} />
                  <Text style={styles.donutLegendText}>{heroNonCompliantPct}% Non-Compliant</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.heroDonutCard, isMobile && styles.heroDonutCardMobile, { justifyContent: 'center', minHeight: 120 }]}>
            <Text style={[styles.donutCardTitle, { textAlign: 'center', marginBottom: 0 }]}>No scans yet</Text>
            <Text style={{ fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System', fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 6 }}>Run your first inspection to{`\n`}see the compliance breakdown.</Text>
          </View>
        )}
      </View>

      {/* 3. STAT CARDS GRID */}
      <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
        {/* Card 1: Total Scans */}
        <View style={[styles.statCard, isMobile ? styles.statCardMobile : styles.statCardDesktop]}>
          <View style={[styles.iconChip, { backgroundColor: '#ECE9FC' }]}>
            <ScanIcon size={16} color="#6C5CE7" />
          </View>
          <Text style={styles.statLabel}>Total Scans Processed</Text>
          <Text style={styles.statVal}>{stats.totalScans.toLocaleString('en-IN')}</Text>
          <View style={styles.statFooter}>
            <Text style={styles.statNote}>{zoneCount > 0 ? `Across ${zoneCount} zone${zoneCount !== 1 ? 's' : ''}` : 'All zones'}</Text>
          </View>
        </View>

        {/* Card 2: Violation Rate */}
        <View style={[styles.statCard, isMobile ? styles.statCardMobile : styles.statCardDesktop]}>
          <View style={[styles.iconChip, { backgroundColor: '#FCE7E6' }]}>
            <AlertTriangleIcon size={16} color="#F0544B" />
          </View>
          <Text style={styles.statLabel}>Overall Violation Rate</Text>
          <Text style={[styles.statVal, { color: '#F0544B' }]}>{stats.violationRate}%</Text>
          <View style={styles.statFooter}>
            <Text style={styles.statNote}>Target ≤ 6.0%</Text>
          </View>
        </View>

        {/* Card 3: Fully Compliant */}
        <View style={[styles.statCard, isMobile ? styles.statCardMobile : styles.statCardDesktop]}>
          <View style={[styles.iconChip, { backgroundColor: '#DFF6EF' }]}>
            <CheckCircleIcon size={16} color="#17B897" />
          </View>
          <Text style={styles.statLabel}>Fully Compliant</Text>
          <Text style={[styles.statVal, { color: '#17B897' }]}>{stats.compliantCount?.toLocaleString('en-IN') ?? '—'}</Text>
          <View style={styles.statFooter}>
            <Text style={styles.statNote}>Passed checks</Text>
          </View>
        </View>

        {/* Card 4: Non-Compliant */}
        <View style={[styles.statCard, isMobile ? styles.statCardMobile : styles.statCardDesktop]}>
          <View style={[styles.iconChip, { backgroundColor: '#FCE7E6' }]}>
            <AlertTriangleIcon size={16} color="#F0544B" />
          </View>
          <Text style={styles.statLabel}>Non-Compliant</Text>
          <Text style={[styles.statVal, { color: '#F0544B' }]}>{stats.nonCompliantCount?.toLocaleString('en-IN') ?? '—'}</Text>
          <View style={styles.statFooter}>
            <Text style={styles.statNote}>Violations flagged</Text>
          </View>
        </View>

        {/* Card 5: Authenticity Flags */}
        <View style={[styles.statCard, isMobile ? styles.statCardMobile : styles.statCardDesktop]}>
          <View style={[styles.iconChip, { backgroundColor: '#FDF1DD' }]}>
            <ShieldAlertIcon size={16} color="#F5A623" />
          </View>
          <Text style={styles.statLabel}>Authenticity Flags</Text>
          <Text style={[styles.statVal, { color: '#F5A623' }]}>{stats.authenticityFlags}</Text>
          <View style={styles.statFooter}>
            <Text style={styles.statNote}>Counterfeit alerts</Text>
          </View>
        </View>
      </View>

      {/* 4. CHART TABS & MAIN CHART CARD */}
      <View style={styles.chartSegmentedWrap}>
        <View style={styles.segmentedControl}>
          {([
            { key: 'weekly', label: 'Daily Volume' },
            { key: 'category', label: 'By Category' },
            { key: 'zone', label: 'By Zone' },
          ] as { key: 'weekly' | 'category' | 'zone'; label: string }[]).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.segmentBtn, activeTab === t.key && styles.segmentBtnActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segmentText, activeTab === t.key && styles.segmentTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Daily Volume Bar Chart */}
      {activeTab === 'weekly' && (
        <View style={styles.mainChartCard}>
          <View style={styles.chartCardHeader}>
            <Text style={styles.chartCardTitle}>Daily Inspection Volume</Text>
            <Text style={styles.chartCardSub}>Compliant, review, and non-compliant package scans during current week</Text>
          </View>

          <View style={styles.barChartWrap}>
            {stats.dailyCounts.map((item) => {
              const total = item.pass + item.warning + item.fail;
              const passH = (item.pass / maxDailyTotal) * 120;
              const warnH = (item.warning / maxDailyTotal) * 120;
              const failH = (item.fail / maxDailyTotal) * 120;
              return (
                <View key={item.day} style={styles.barCol}>
                  <Text style={styles.barCountText}>{total}</Text>
                  <View style={styles.stackedBar}>
                    <View style={[styles.barSegment, { height: failH, backgroundColor: '#F0544B', borderTopLeftRadius: 5, borderTopRightRadius: 5 }]} />
                    <View style={[styles.barSegment, { height: warnH, backgroundColor: '#F5A623' }]} />
                    <View style={[styles.barSegment, { height: passH, backgroundColor: '#17B897' }]} />
                  </View>
                  <Text style={styles.barDayText}>{item.day}</Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.chartLegend, isMobile && { flexWrap: 'wrap', gap: 12 }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#17B897' }]} />
              <Text style={styles.legendText}>Compliant ({stats.dailyCounts.reduce((acc, x) => acc + x.pass, 0)})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F5A623' }]} />
              <Text style={styles.legendText}>Review Required ({stats.dailyCounts.reduce((acc, x) => acc + x.warning, 0)})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F0544B' }]} />
              <Text style={styles.legendText}>Non-Compliant ({stats.dailyCounts.reduce((acc, x) => acc + x.fail, 0)})</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category Breakdown */}
      {activeTab === 'category' && (
        <View style={styles.mainChartCard}>
          <View style={styles.chartCardHeader}>
            <Text style={styles.chartCardTitle}>Violation Rate by Category</Text>
            <Text style={styles.chartCardSub}>Total package scans vs recorded non-compliance percentage</Text>
          </View>
          {(stats.categoryBreakdown || []).map((cat, idx) => (
            <View key={cat.category} style={[styles.catRow, idx === (stats.categoryBreakdown || []).length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.catLeft}>
                <View style={[styles.catColorDot, { backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.catLabel}>{cat.category}</Text>
                  <Text style={styles.catCount}>{cat.count.toLocaleString('en-IN')} scans</Text>
                </View>
              </View>
              <View style={styles.catRight}>
                <View style={styles.catProgressBg}>
                  <View
                    style={[
                      styles.catProgressFill,
                      {
                        width: `${(cat.count / maxCategoryCount) * 100}%`,
                        backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                      },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.violRateBadge,
                    {
                      backgroundColor: cat.violationRate > 25 ? '#FCE7E6' : cat.violationRate > 18 ? '#FDF1DD' : '#DFF6EF',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.violRateText,
                      { color: cat.violationRate > 25 ? '#F0544B' : cat.violationRate > 18 ? '#F5A623' : '#17B897' },
                    ]}
                  >
                    {cat.violationRate}% violations
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Zone Breakdown */}
      {activeTab === 'zone' && (
        <View style={styles.mainChartCard}>
          <View style={styles.chartCardHeader}>
            <Text style={styles.chartCardTitle}>Zone-Wise Compliance Breakdown</Text>
            <Text style={styles.chartCardSub}>Regional enforcement performance and violation concentration</Text>
          </View>
          <View style={styles.zoneTableHeader}>
            <Text style={[styles.zoneHeaderTh, { flex: 2 }]}>ZONE</Text>
            <Text style={[styles.zoneHeaderTh, { flex: 1, textAlign: 'center' }]}>TOTAL SCANS</Text>
            <Text style={[styles.zoneHeaderTh, { flex: 1, textAlign: 'center' }]}>VIOLATIONS</Text>
            <Text style={[styles.zoneHeaderTh, { flex: 1, textAlign: 'right' }]}>RATE</Text>
          </View>
          {(stats.zoneBreakdown || []).map((zone, idx) => {
            const rate = Math.round((zone.violations / zone.scans) * 100);
            return (
              <View key={zone.zone} style={[styles.zoneRow, idx === (stats.zoneBreakdown || []).length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.zoneColorBar, { backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }]} />
                  <Text style={styles.zoneLabel}>{zone.zone}</Text>
                </View>
                <Text style={[styles.zoneTd, { flex: 1, textAlign: 'center' }]}>{zone.scans.toLocaleString('en-IN')}</Text>
                <Text style={[styles.zoneTd, { flex: 1, textAlign: 'center', color: '#F0544B', fontWeight: '700' }]}>
                  {zone.violations}
                </Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View
                    style={[
                      styles.violRateBadge,
                      {
                        backgroundColor: rate > 25 ? '#FCE7E6' : rate > 18 ? '#FDF1DD' : '#DFF6EF',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.violRateText,
                        { color: rate > 25 ? '#F0544B' : rate > 18 ? '#F5A623' : '#17B897' },
                      ]}
                    >
                      {rate}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 5. BOTTOM LISTS GRID */}
      <View style={[styles.bottomListsGrid, isMobile && styles.bottomListsGridMobile]}>
        {/* Most Common Rule Breaches */}
        <View style={[styles.bottomListCol, isMobile ? styles.bottomListColMobile : styles.bottomListColDesktop]}>
          <View style={styles.listCard}>
            <View style={styles.chartCardHeader}>
              <Text style={styles.chartCardTitle}>Most Common Rule Breaches</Text>
              <Text style={styles.chartCardSub}>Highest frequency label non-compliance triggers</Text>
            </View>
            {stats.topViolationFields.map((item, i) => (
              <View key={item.label} style={[styles.rankRow, i < stats.topViolationFields.length - 1 && styles.listDivider]}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rankTopRow}>
                    <Text style={styles.rankLabel}>{item.label}</Text>
                    <Text style={styles.rankPercentage}>{item.percentage}%</Text>
                  </View>
                  <View style={styles.coralTrackBg}>
                    <View style={[styles.coralFillBar, { width: `${item.percentage}%` }]} />
                  </View>
                  <Text style={styles.rankCount}>{item.count} labels flagged</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Brands Requiring Field Audit */}
        <View style={[styles.bottomListCol, isMobile ? styles.bottomListColMobile : styles.bottomListColDesktop]}>
          <View style={styles.listCard}>
            <View style={styles.chartCardHeader}>
              <Text style={styles.chartCardTitle}>Brands Requiring Field Audit</Text>
              <Text style={styles.chartCardSub}>Manufacturers with repeat rule violations</Text>
            </View>
            {stats.topFlaggedBrands.map((item, i) => (
              <View key={item.brand} style={[styles.brandRow, i < stats.topFlaggedBrands.length - 1 && styles.listDivider]}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.brandName}>{item.brand}</Text>
                  <Text style={styles.brandCategory}>FMCG & Packaged Commodities</Text>
                </View>
                <View style={styles.coralPillBadge}>
                  <Text style={styles.coralPillBadgeText}>{item.violations} Violations</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFF8',
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

  /* 1. Top Bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F0544B',
  },
  topBarTitle: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '800',
    color: '#1F2748',
    letterSpacing: 0.6,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DFF6EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveBadgeText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '700',
    color: '#17B897',
  },
  zoneAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F2748',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoneAvatarText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* 2. Hero Section */
  heroPanel: {
    backgroundColor: '#171C38',
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    shadowColor: '#1F2748',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  heroPanelMobile: {
    flexDirection: 'column',
    padding: 20,
    gap: 20,
  },
  heroLeft: {
  },
  heroLeftDesktop: {
    flex: 1,
  },
  heroLeftMobile: {
    width: '100%',
  },
  rulesPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(23, 184, 151, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  rulesPillText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '700',
    color: '#17B897',
  },
  heroHeadline: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 8,
  },
  heroHeadlineMobile: {
    fontSize: 22,
    lineHeight: 28,
  },
  heroSubtitle: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 13.5,
    color: '#9CA3AF',
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 520,
  },
  heroCtaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  violetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  violetBtnText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DFF6EF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tealBtnText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12.5,
    fontWeight: '700',
    color: '#17B897',
  },

  /* Donut Card in Hero */
  heroDonutCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    alignItems: 'center',
    minWidth: 260,
  },
  heroDonutCardMobile: {
    width: '100%',
    minWidth: '100%',
  },
  donutCardTitle: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutLegendCol: {
    gap: 8,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  donutDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  donutLegendText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* 3. Stat Cards Grid */
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statsGridMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E4F1',
    shadowColor: '#1F2748',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  statCardDesktop: {
    flex: 1,
  },
  statCardMobile: {
    width: '100%',
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  statVal: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2748',
    marginBottom: 8,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statNote: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 10.5,
    color: '#6B7280',
  },

  /* 4. Segmented Control & Chart Card */
  chartSegmentedWrap: {
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7E4F1',
  },
  segmentBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: '#6C5CE7',
  },
  segmentText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  mainChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E7E4F1',
    marginBottom: 20,
    shadowColor: '#1F2748',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  chartCardHeader: {
    marginBottom: 16,
  },
  chartCardTitle: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2748',
  },
  chartCardSub: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 2,
  },

  barChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 160,
    paddingTop: 16,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  stackedBar: {
    width: 22,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#F1EFF8',
  },
  barSegment: {
    width: '100%',
  },
  barDayText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '600',
  },
  barCountText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 10.5,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E7E4F1',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  /* Category Rows */
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E4F1',
    gap: 16,
  },
  catLeft: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catLabel: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1F2748',
  },
  catCount: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 1,
  },
  catRight: {
    flex: 2,
    gap: 6,
  },
  catProgressBg: {
    height: 6,
    backgroundColor: '#F1EFF8',
    borderRadius: 999,
    overflow: 'hidden',
  },
  catProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  violRateBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  violRateText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Zone Table */
  zoneTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1EFF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  zoneHeaderTh: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E4F1',
  },
  zoneColorBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  zoneLabel: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1F2748',
  },
  zoneTd: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 13,
    color: '#6B7280',
  },

  /* 5. Bottom Lists Grid */
  bottomListsGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  bottomListsGridMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  bottomListCol: {
  },
  bottomListColDesktop: {
    flex: 1,
  },
  bottomListColMobile: {
    width: '100%',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E7E4F1',
    shadowColor: '#1F2748',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E7E4F1',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#ECE9FC',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rankBadgeText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '800',
    color: '#6C5CE7',
  },
  rankTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  rankLabel: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2748',
    flex: 1,
  },
  rankPercentage: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F0544B',
    flexShrink: 0,
  },
  coralTrackBg: {
    height: 6,
    backgroundColor: '#FCE7E6',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  coralFillBar: {
    height: '100%',
    backgroundColor: '#F0544B',
    borderRadius: 999,
  },
  rankCount: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    color: '#6B7280',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  brandName: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1F2748',
  },
  brandCategory: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 1,
  },
  coralPillBadge: {
    backgroundColor: '#FCE7E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  coralPillBadgeText: {
    fontFamily: Platform.OS === 'web' ? "'Plus Jakarta Sans', sans-serif" : 'System',
    fontSize: 11,
    fontWeight: '700',
    color: '#F0544B',
  },
});
