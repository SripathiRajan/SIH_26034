import { api } from '../api/client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
  Modal,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import DemoBanner from '../components/DemoBanner';
import FormattedMessage from '../components/FormattedMessage';
import { getChatScanContext } from '../services/chatContext';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: string[];
  llmGenerated?: boolean;
}

interface ChatScreenProps {
  navigation?: any;
  route?: any;
}

/* SVG Vector Icons */
function BackArrowIcon({ size = 16, color = '#06342C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="M12 19l-7-7 7-7" />
    </Svg>
  );
}

function ChatBubbleIcon({ size = 20, color = '#06342C' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </Svg>
  );
}

function SendIcon({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 2L11 13" />
      <Path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </Svg>
  );
}

function CopyIcon({ size = 13, color = '#5D6178' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

function CheckIcon({ size = 13, color = '#00C2A8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function CloseIcon({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}

/* Default Quick-start topic chips */
const DEFAULT_TOPIC_CHIPS = [
  { id: 'font', label: 'Font size rules', query: 'What are the mandatory font size rules for packaging?' },
  { id: 'mrp', label: 'MRP display', query: 'What are the rules for printing MRP on packaging?' },
  { id: 'dates', label: 'Manufacturing dates', query: 'How should manufacturing and expiry dates be declared?' },
  { id: 'importer', label: 'Importer details', query: 'What importer and manufacturer details are required on labels?' },
  { id: 'penalty', label: 'Penalty clauses', query: 'What are the penalty clauses and fine amounts for non-compliance?' },
];

/* Keyword matching canned answer engine */
function getAssistantAnswer(query: string, scanData?: any): string {
  const q = query.toLowerCase();

  if (scanData && (q.includes('this product') || q.includes('this pack') || q.includes('report') || q.includes('issue') || q.includes('violation'))) {
    const pName = scanData.productName || scanData.brand || 'This package';
    const status = scanData.status === 'pass' ? 'COMPLIANT' : scanData.status === 'warning' ? 'ACTION REQUIRED / REVIEW' : 'NON-COMPLIANT';
    const issues = (scanData.fields || []).filter((f: any) => f.status !== 'pass');
    let summary = `Regarding ${pName} (Status: ${status}):\n\n`;
    if (issues.length > 0) {
      summary += "The following statutory declarations require attention:\n";
      issues.forEach((f: any) => {
        summary += `• ${f.label}: ${f.violationReason || 'Requires review or panel scan'}\n`;
      });
      summary += "\nUnder Legal Metrology Rules, declarations directed to the bottom/flap ('See bottom of pack') require capturing the bottom panel stamp to verify statutory compliance.";
    } else {
      summary += "All 8 mandatory declarations have been audited and verified as compliant.";
    }
    return summary;
  }

  if (q.includes('font') || q.includes('size') || q.includes('height') || q.includes('display area') || q.includes('pda')) {
    return "Under Legal Metrology (Packaged Commodities) Rules, minimum font height for mandatory declarations depends on Principal Display Area (PDA):\n\n• PDA ≤ 50 cm²: Min font height 1.0 mm (0.5 mm for net qty/mrp)\n• 50 cm² < PDA ≤ 100 cm²: Min font height 1.5 mm\n• 100 cm² < PDA ≤ 500 cm²: Min font height 2.5 mm\n• 500 cm² < PDA ≤ 2500 cm²: Min font height 4.0 mm\n• PDA > 2500 cm²: Min font height 6.0 mm\n\nAll letters and numerals must maintain a minimum 3:1 height-to-width ratio.";
  }
  if (q.includes('mrp') || q.includes('price') || q.includes('retail') || q.includes('tax') || q.includes('inclusive')) {
    return "Maximum Retail Price (MRP) must be clearly printed on the package as 'Maximum Retail Price ₹...' or 'MRP ₹... (incl. of all taxes)'. Key requirements:\n\n1. Must include all applicable taxes.\n2. Must be printed directly or on an official label—no overwriting or sticky price alterations.\n3. Must maintain mandatory font size ratios based on package display area.";
  }
  if (q.includes('date') || q.includes('manufactur') || q.includes('mfd') || q.includes('expir') || q.includes('pack')) {
    return "Every pre-packaged commodity must state the Month and Year of Manufacture or Pre-packing (e.g., 'Mfd: 08/2026' or 'Packed: Aug 2026').\n\nFor food items, cosmetics, or perishable goods, 'Best Before' or 'Expiry Date' declaration is mandatory under Rule 6(1)(d) of Legal Metrology (Packaged Commodities) Rules.";
  }
  if (q.includes('import') || q.includes('pack') || q.includes('manufactur') || q.includes('address') || q.includes('contact') || q.includes('origin')) {
    return "Every pre-packaged commodity must display:\n\n1. Complete Name and Postal Address of the Manufacturer, Packer, or Importer.\n2. Country of Origin for imported packages.\n3. Customer Care contact details (Name, Address, Telephone Number, and Email ID) for consumer grievances.";
  }
  if (q.includes('penalty') || q.includes('fine') || q.includes('offence') || q.includes('violation') || q.includes('clause') || q.includes('section')) {
    return "Under Section 36(1) of the Legal Metrology Act, 2009 for non-compliant packaging:\n\n• First Offence: Fine up to ₹25,000\n• Second Offence: Fine up to ₹50,000\n• Subsequent Offences: Fine up to ₹1,00,000 or imprisonment up to 1 year, or both.";
  }
  return "For specific regulatory edge cases or commodity-specific exemptions, please check the full Legal Metrology (Packaged Commodities) Rules in the Rules Database tab.";
}

export default function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  // 1. Resolve scanData from route params or fallback to global cached scan context
  const scanData = route?.params?.scanData || getChatScanContext();

  const normalizeImageUri = (uri?: string | null): string => {
    if (!uri) return '';
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('file://')) {
      return uri;
    }
    const base = api.getBaseUrl().replace(/\/+$/, '');
    const path = uri.startsWith('/') ? uri : `/${uri}`;
    return `${base}${path}`;
  };

  const allImageUris: string[] = useMemo(() => {
    const uris: string[] = [];
    if (Array.isArray(scanData?.imageUris) && scanData.imageUris.length > 0) {
      uris.push(...scanData.imageUris);
    } else if (scanData?.imageUri) {
      uris.push(scanData.imageUri);
    }
    return uris.map((u) => normalizeImageUri(u)).filter(Boolean);
  }, [scanData?.imageUris, scanData?.imageUri]);

  // 2. Build initial greeting tailored to scan context
  const initialMessageText = useMemo(() => {
    if (!scanData) {
      return "Hello! I'm your Legal Metrology Compliance Assistant. Ask me anything about font height ratios, MRP display formats, manufacturing date declarations, importer rules, or penalty clauses.";
    }

    const pName = scanData.productName || scanData.brand || 'Scanned Package';
    const passCount = (scanData.fields || []).filter((f: any) => f.status === 'pass').length;
    const warnCount = (scanData.fields || []).filter((f: any) => f.status === 'warning').length;
    const failCount = (scanData.fields || []).filter((f: any) => f.status === 'fail').length;
    const statusLabel = scanData.status === 'pass' ? 'COMPLIANT' : scanData.status === 'warning' ? 'ACTION REQUIRED / REVIEW' : 'NON-COMPLIANT';

    const flagged = (scanData.fields || [])
      .filter((f: any) => f.status !== 'pass')
      .map((f: any) => `• ${f.label}: ${f.violationReason || (f.status === 'warning' ? 'Flap stamp required' : 'Missing declaration')}`);

    let text = `📋 **Inspection Context Loaded: ${pName}**\n\n`;
    if (scanData.brand && scanData.brand !== pName) text += `• **Brand**: ${scanData.brand}\n`;
    if (scanData.netWeight) text += `• **Net Quantity**: ${scanData.netWeight}\n`;
    text += `• **Audit Status**: **${statusLabel}** (${scanData.complianceConfidence || 0}% Confidence)\n`;
    text += `• **Declarations Audit**: ${passCount} Pass · ${warnCount} Review/Action Required · ${failCount} Fail\n`;

    if (flagged.length > 0) {
      text += `\n**Attention Items**:\n${flagged.join('\n')}\n`;
    }

    const imgCount = allImageUris.length;
    text += `\nAttached ${imgCount} captured packaging image view(s) and full statutory audit declarations to this conversation.\n\nYou can ask me about statutory citations, flap redirection validity under Rule 6, penalty liabilities, or how to resolve any flagged items.`;
    return text;
  }, [scanData, allImageUris]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: initialMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Update initial message if scanData changed
  useEffect(() => {
    if (scanData) {
      setMessages([
        {
          id: `msg-init-${scanData.id || Date.now()}`,
          sender: 'assistant',
          text: initialMessageText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [scanData?.id]);

  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // Dynamic context-aware topic chips
  const dynamicChips = useMemo(() => {
    if (!scanData) return DEFAULT_TOPIC_CHIPS;

    const pName = scanData.productName || scanData.brand || 'this product';
    const hasFlap = (scanData.fields || []).some((f: any) =>
      f.status === 'warning' || (f.violationReason && f.violationReason.toLowerCase().includes('flap'))
    );
    const hasFail = (scanData.fields || []).some((f: any) => f.status === 'fail');

    const chips: { id: string; label: string; query: string }[] = [];
    if (hasFlap) {
      chips.push({
        id: 'flap_req',
        label: 'Why bottom flap scan?',
        query: `Why does ${pName} require a bottom flap scan, and what does Legal Metrology Rule 6 specify for panel pointers?`,
      });
    }
    if (hasFail) {
      chips.push({
        id: 'penalties',
        label: 'Penalty liabilities',
        query: `What are the legal liabilities and penalty fine amounts under Section 36 for the non-compliant declarations on ${pName}?`,
      });
    }
    chips.push({
      id: 'stat_summary',
      label: 'Statutory summary',
      query: `Provide a detailed statutory compliance audit summary for ${pName} citing verified gazette rules.`,
    });
    chips.push({
      id: 'fssai_check',
      label: 'FSSAI compliance',
      query: `Is the FSSAI license declaration on ${pName} compliant with Food Safety and Standards Regulations 2020?`,
    });
    chips.push({
      id: 'notice',
      label: 'Draft legal notice',
      query: `Draft an official statutory inquiry notice to the manufacturer for the inspection findings on ${pName}.`,
    });
    return chips;
  }, [scanData]);

  // Inject Web CSS & Fonts
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('ask-assistant-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'ask-assistant-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
        document.head.appendChild(fontLink);
      }

      if (!document.getElementById('ask-assistant-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'ask-assistant-styles';
        styleTag.innerHTML = `
          @keyframes bounceDot {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-5px); opacity: 1; }
          }
          .bounce1 { animation: bounceDot 1.4s infinite ease-in-out 0s; }
          .bounce2 { animation: bounceDot 1.4s infinite ease-in-out 0.16s; }
          .bounce3 { animation: bounceDot 1.4s infinite ease-in-out 0.32s; }

          .topic-chip-btn {
            transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
            cursor: pointer;
          }
          .topic-chip-btn:hover {
            background-color: #EEF2FF !important;
            border-color: #C7D2FE !important;
            color: #6C5CE7 !important;
          }
          .topic-chip-btn:active {
            transform: scale(0.96);
          }
          .copy-btn-wrap {
            transition: color 0.12s ease;
            cursor: pointer;
          }
          .copy-btn-wrap:hover {
            color: #6C5CE7 !important;
          }
        `;
        document.head.appendChild(styleTag);
      }
    }
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Handle Back Navigation
  const handleBack = () => {
    if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else if (scanData) {
      navigation?.navigate?.('Result', { scanData, scanId: scanData.id });
    } else {
      navigation?.navigate?.('Home');
    }
  };

  // Send message flow: backend RAG chatbot with complete scan context payload
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : input).trim();
    if (!text || isTyping) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build payload including all image paths and field declarations
    const scanContextPayload = scanData
      ? {
          id: scanData.id,
          productName: scanData.productName,
          brand: scanData.brand,
          netWeight: scanData.netWeight,
          status: scanData.status,
          complianceConfidence: scanData.complianceConfidence,
          imageUris: allImageUris,
          imageUri: allImageUris[0] || scanData.imageUri,
          fields: scanData.fields,
        }
      : undefined;

    api
      .askAssistant(text, scanContextPayload)
      .then(({ answer, sources, llmGenerated }) => {
        const uniqueSources = sources
          ? Array.from(new Set(sources.map((s) => (typeof s === 'string' ? s.trim() : String(s))).filter(Boolean)))
          : undefined;
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: answer,
            timestamp: replyTime,
            citations: uniqueSources,
            llmGenerated,
          },
        ]);
        setIsTyping(false);
      })
      .catch(() => {
        // Backend unreachable — statutory canned answers keep the assistant usable offline
        const replyText = getAssistantAnswer(text, scanData);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: replyText,
            timestamp: replyTime,
            llmGenerated: false,
          },
        ]);
        setIsTyping(false);
      });
  };

  const handleCopyText = (id: string, text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const isInputEmpty = input.trim().length === 0;

  return (
    <View style={[styles.pageWrap, isMobile && styles.pageWrapMobile]}>
      <DemoBanner />
      <View style={[styles.cardContainer, isMobile && styles.cardContainerMobile]}>
        {/* Header Card with Prominent Back Button */}
        <View style={styles.headerCard}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.75}
            accessibilityLabel="Back to report or home"
          >
            <BackArrowIcon size={16} color="#06342C" />
            <Text style={styles.backBtnText}>
              {scanData ? 'Back to Report' : 'Back'}
            </Text>
          </TouchableOpacity>

          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBadge}>
              <ChatBubbleIcon size={20} color="#06342C" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Ask Assistant</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {scanData ? `Audit assistant for ${scanData.productName || scanData.brand || 'Scanned Label'}` : 'Quick, simple answers for label rules & compliance'}
              </Text>
            </View>
          </View>
        </View>

        {/* Active Scan Context Banner & Packaging Images Strip */}
        {scanData && (
          <View style={styles.activeScanCard}>
            <View style={styles.activeScanTopRow}>
              <View style={styles.activeScanMetaWrap}>
                <View style={styles.badgeRow}>
                  <Text style={styles.activeScanTag}>ACTIVE INSPECTION</Text>
                  <Text style={styles.activeScanIdText}>#{scanData.id?.toUpperCase()}</Text>
                </View>
                <Text style={styles.activeScanProductName} numberOfLines={1}>
                  {scanData.productName || scanData.brand || 'Audited Package'}
                </Text>
                <Text style={styles.activeScanSub}>
                  {scanData.brand ? `Brand: ${scanData.brand}` : ''}
                  {scanData.netWeight ? ` · Net: ${scanData.netWeight}` : ''}
                  {scanData.complianceConfidence ? ` · ${scanData.complianceConfidence}% Confidence` : ''}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  scanData.status === 'pass'
                    ? styles.statusBadgePass
                    : scanData.status === 'warning'
                    ? styles.statusBadgeWarning
                    : styles.statusBadgeFail,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    scanData.status === 'pass'
                      ? styles.statusBadgeTextPass
                      : scanData.status === 'warning'
                      ? styles.statusBadgeTextWarning
                      : styles.statusBadgeTextFail,
                  ]}
                >
                  {scanData.status === 'pass'
                    ? 'Compliant'
                    : scanData.status === 'warning'
                    ? 'Action Required'
                    : 'Non-Compliant'}
                </Text>
              </View>
            </View>

            {/* Packaging Image Gallery Strip */}
            {allImageUris.length > 0 && (
              <View style={styles.galleryStrip}>
                <Text style={styles.galleryLabel}>Attached Packaging Views ({allImageUris.length}):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryContent}>
                  {allImageUris.map((imgUri, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.thumbnailBtn}
                      activeOpacity={0.8}
                      onPress={() => setPreviewImage(imgUri)}
                    >
                      <Image source={{ uri: imgUri }} style={styles.thumbnailImg} resizeMode="cover" />
                      <View style={styles.viewNumberPill}>
                        <Text style={styles.viewNumberText}>View {idx + 1}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Field Audit Quick Chips */}
            <View style={styles.fieldsPreviewRow}>
              {(scanData.fields || []).slice(0, 5).map((f: any, idx: number) => {
                const isPass = f.status === 'pass';
                const isWarn = f.status === 'warning';
                return (
                  <View
                    key={idx}
                    style={[
                      styles.fieldItemChip,
                      isPass ? styles.fieldItemPass : isWarn ? styles.fieldItemWarning : styles.fieldItemFail,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldItemText,
                        isPass ? styles.fieldItemTextPass : isWarn ? styles.fieldItemTextWarning : styles.fieldItemTextFail,
                      ]}
                    >
                      {f.label}: {isPass ? '✓' : isWarn ? '⚠ Flap' : '✗'}
                    </Text>
                  </View>
                );
              })}
              {(scanData.fields?.length || 0) > 5 && (
                <View style={styles.fieldMoreChip}>
                  <Text style={styles.fieldMoreText}>+{(scanData.fields?.length || 0) - 5} more</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Topic Chips Row */}
        <View style={styles.topicChipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChipsContent}>
            {dynamicChips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={styles.topicChip}
                onPress={() => handleSendMessage(chip.query)}
                activeOpacity={0.85}
                // @ts-ignore
                className="topic-chip-btn"
              >
                <Text style={styles.topicChipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Message Thread Area */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.threadScrollView}
          contentContainerStyle={styles.threadContent}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isCopied = copiedId === msg.id;
            const uniqueCitations = msg.citations
              ? Array.from(new Set(msg.citations.map((c) => (typeof c === 'string' ? c.trim() : String(c))).filter(Boolean)))
              : [];

            return (
              <View
                key={msg.id}
                style={[
                  styles.msgRow,
                  isMobile && styles.msgRowMobile,
                  isUser ? styles.msgRowUser : styles.msgRowAssistant,
                ]}
              >
                {!isUser && (
                  <View style={styles.assistantAvatar}>
                    <ChatBubbleIcon size={14} color="#06342C" />
                  </View>
                )}

                <View style={[styles.msgBodyWrap, isUser && styles.msgBodyWrapUser]}>
                  <Text style={[styles.senderLabel, isUser ? styles.senderLabelUser : styles.senderLabelAssistant]}>
                    {isUser ? 'You' : 'Assistant'}
                  </Text>

                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <FormattedMessage content={msg.text} isUser={isUser} />

                    {/* Statutory Citations */}
                    {!isUser && uniqueCitations.length > 0 && (
                      <View style={styles.citationRow}>
                        {uniqueCitations.map((cit, idx) => (
                          <View key={idx} style={styles.citationChip}>
                            <Text style={styles.citationText} numberOfLines={1}>
                              {cit}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Message Timestamp & Copy Button */}
                  <View style={styles.footerRow}>
                    <Text style={styles.timestampText}>{msg.timestamp}</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopyText(msg.id, msg.text)}
                      activeOpacity={0.7}
                      // @ts-ignore
                      className="copy-btn-wrap"
                    >
                      {isCopied ? <CheckIcon size={13} color="#00C2A8" /> : <CopyIcon size={13} color="#5D6178" />}
                      <Text style={[styles.copyBtnText, isCopied && { color: '#00C2A8' }]}>
                        {isCopied ? 'Copied' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={[styles.msgRow, styles.msgRowAssistant]}>
              <View style={styles.assistantAvatar}>
                <ChatBubbleIcon size={14} color="#06342C" />
              </View>
              <View style={styles.msgBodyWrap}>
                <Text style={styles.senderLabelAssistant}>Assistant</Text>
                <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                  <View style={styles.typingDotRow}>
                    <View style={[styles.typingDot, Platform.OS === 'web' && ({ animationDelay: '0s' } as any)]} />
                    <View style={[styles.typingDot, Platform.OS === 'web' && ({ animationDelay: '0.16s' } as any)]} />
                    <View style={[styles.typingDot, Platform.OS === 'web' && ({ animationDelay: '0.32s' } as any)]} />
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Composer Input Bar */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.composerBar, isMobile && styles.composerBarMobile]}>
            <TextInput
              style={styles.composerInput}
              value={input}
              onChangeText={setInput}
              placeholder={scanData ? `Ask about ${scanData.productName || scanData.brand || 'this report'}…` : 'Ask about Legal Metrology rules…'}
              placeholderTextColor="#9498AC"
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={() => handleSendMessage()}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !isInputEmpty && styles.sendBtnActive]}
              onPress={() => handleSendMessage()}
              disabled={isInputEmpty || isTyping}
              activeOpacity={0.8}
            >
              <SendIcon size={18} color={isInputEmpty ? '#9498AC' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Full-size Packaging Image Preview Modal */}
      {previewImage && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreviewImage(null)}>
              <CloseIcon size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Image source={{ uri: previewImage }} style={styles.modalImg} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
    backgroundColor: '#F8F9FD',
    alignItems: 'center',
  },
  pageWrapMobile: {
    paddingHorizontal: 0,
  },
  cardContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 920,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E4E5F0',
    flexDirection: 'column',
  },
  cardContainerMobile: {
    maxWidth: '100%',
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },

  /* Header Card */
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E5F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#06342C',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8FBF7',
    borderWidth: 1,
    borderColor: '#B8F1E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#12141C',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#5D6178',
    marginTop: 1,
  },

  /* Active Scan Inspection Banner */
  activeScanCard: {
    backgroundColor: '#FBFBFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E5F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  activeScanTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  activeScanMetaWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  activeScanTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#6C5CE7',
    letterSpacing: 0.5,
  },
  activeScanIdText: {
    fontSize: 10,
    color: '#9498AC',
    fontWeight: '600',
  },
  activeScanProductName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#12141C',
  },
  activeScanSub: {
    fontSize: 11,
    color: '#5D6178',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgePass: {
    backgroundColor: '#E8FBF7',
    borderColor: '#B8F1E5',
  },
  statusBadgeWarning: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  statusBadgeFail: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextPass: {
    color: '#0B6B5D',
  },
  statusBadgeTextWarning: {
    color: '#C2410C',
  },
  statusBadgeTextFail: {
    color: '#DC2626',
  },

  /* Packaging Image Gallery Strip */
  galleryStrip: {
    marginTop: 10,
  },
  galleryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5D6178',
    marginBottom: 6,
  },
  galleryContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  thumbnailBtn: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    position: 'relative',
    backgroundColor: '#EAEBFA',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  viewNumberPill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18, 20, 28, 0.75)',
    paddingVertical: 1,
    alignItems: 'center',
  },
  viewNumberText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Field Audit Preview Chips */
  fieldsPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  fieldItemChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  fieldItemPass: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  fieldItemWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  fieldItemFail: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  fieldItemText: {
    fontSize: 10,
    fontWeight: '600',
  },
  fieldItemTextPass: {
    color: '#15803D',
  },
  fieldItemTextWarning: {
    color: '#B45309',
  },
  fieldItemTextFail: {
    color: '#B91C1C',
  },
  fieldMoreChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  fieldMoreText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5D6178',
  },

  /* Topic Chips Row */
  topicChipsRow: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E5F0',
    paddingVertical: 8,
  },
  topicChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  topicChip: {
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#12141C',
  },

  /* Message Thread Area */
  threadScrollView: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },
  threadContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: '85%',
  },
  msgRowMobile: {
    maxWidth: '95%',
  },
  msgRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  msgRowAssistant: {
    alignSelf: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8FBF7',
    borderWidth: 1,
    borderColor: '#B8F1E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  msgBodyWrap: {
    flex: 1,
  },
  msgBodyWrapUser: {
    alignItems: 'flex-end',
  },
  senderLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  senderLabelUser: {
    color: '#6C5CE7',
    textAlign: 'right',
  },
  senderLabelAssistant: {
    color: '#06342C',
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: '#6C5CE7',
    borderColor: '#5B4BC4',
    borderTopRightRadius: 2,
  },
  bubbleAssistant: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E5F0',
    borderTopLeftRadius: 2,
  },
  msgText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  msgTextUser: {
    color: '#FFFFFF',
  },
  msgTextAssistant: {
    color: '#12141C',
  },

  /* Statutory Citation Chips */
  citationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  citationChip: {
    backgroundColor: '#EEF6F4',
    borderWidth: 1,
    borderColor: '#C9E8E1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 260,
  },
  citationText: {
    fontSize: 10,
    color: '#0B6B5D',
    fontWeight: '600',
  },

  /* Footer & Copy */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 5,
  },
  timestampText: {
    fontSize: 10.5,
    color: '#9498AC',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    fontSize: 11.5,
    color: '#5D6178',
  },

  /* Typing Indicator */
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 16,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00C2A8',
  },

  /* Composer Input Bar */
  composerBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E5F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerBarMobile: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 14,
    color: '#12141C',
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E4E5F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#6C5CE7',
  },

  /* Full Image Preview Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  modalImg: {
    width: '90%',
    height: '80%',
  },
});
