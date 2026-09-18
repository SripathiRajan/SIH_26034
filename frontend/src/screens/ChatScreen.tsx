import { api } from '../api/client';
import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import DemoBanner from '../components/DemoBanner';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: string[];
  llmGenerated?: boolean;
}

/* SVG Vector Icons */
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

/* Quick-start topic chips */
const TOPIC_CHIPS = [
  { id: 'font', label: 'Font size rules', query: 'What are the mandatory font size rules for packaging?' },
  { id: 'mrp', label: 'MRP display', query: 'What are the rules for printing MRP on packaging?' },
  { id: 'dates', label: 'Manufacturing dates', query: 'How should manufacturing and expiry dates be declared?' },
  { id: 'importer', label: 'Importer details', query: 'What importer and manufacturer details are required on labels?' },
  { id: 'penalty', label: 'Penalty clauses', query: 'What are the penalty clauses and fine amounts for non-compliance?' },
];

/* Keyword matching canned answer engine */
function getAssistantAnswer(query: string): string {
  const q = query.toLowerCase();

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

export default function ChatScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 760;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: "Hello! I'm your Legal Metrology Compliance Assistant. Ask me anything about font height ratios, MRP display formats, manufacturing date declarations, importer rules, or penalty clauses.",
      timestamp: '10:00 AM',
    },
  ]);

  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

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

  // Auto-scroll to bottom on new message or typing indicator
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

  // Send message flow: backend RAG chatbot first, canned engine as offline fallback
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

    api
      .askAssistant(text)
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
        const replyText = getAssistantAnswer(text);
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

  // Copy text to clipboard
  const handleCopyText = (id: string, text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const isInputEmpty = input.trim().length === 0;

  return (
    <View style={styles.pageWrap}>
      <DemoBanner />
      <View style={[styles.cardContainer, isMobile && styles.cardContainerMobile]}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerIconBadge}>
            <ChatBubbleIcon size={20} color="#06342C" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Ask assistant</Text>
            <Text style={styles.headerSubtitle}>Quick, simple answers for label rules & compliance</Text>
          </View>
        </View>

        {/* Topic Chips Row */}
        <View style={styles.topicChipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicChipsContent}>
            {TOPIC_CHIPS.map((chip) => (
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
                  isUser ? styles.msgRowUser : styles.msgRowAssistant,
                ]}
              >
                {/* Assistant Avatar */}
                {!isUser && (
                  <View style={styles.assistantAvatar}>
                    <ChatBubbleIcon size={14} color="#06342C" />
                  </View>
                )}

                <View style={[styles.bubbleCol, isUser && { alignItems: 'flex-end' }]}>
                  {/* Sender Label */}
                  <Text style={[styles.senderLabel, isUser ? styles.senderLabelUser : styles.senderLabelAssistant]}>
                    {isUser ? 'You' : 'Assistant'}
                  </Text>

                  {/* Message Bubble */}
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAssistant]}>
                      {msg.text}
                    </Text>
                  </View>

                  {/* Statutory citations from the RAG knowledge base */}
                  {!isUser && uniqueCitations.length > 0 && (
                    <View style={styles.citationRow}>
                      {uniqueCitations.slice(0, 3).map((cite, ci) => (
                        <View key={`${msg.id}-cite-${ci}`} style={styles.citationChip}>
                          <Text style={styles.citationText} numberOfLines={1}>
                            {cite}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Timestamp & Copy Button */}
                  <View style={[styles.footerRow, isUser && { justifyContent: 'flex-end' }]}>
                    <Text style={styles.timestampText}>{msg.timestamp}</Text>

                    {!isUser && (
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={() => handleCopyText(msg.id, msg.text)}
                        activeOpacity={0.7}
                        // @ts-ignore
                        className="copy-btn-wrap"
                      >
                        {isCopied ? (
                          <>
                            <CheckIcon size={12} color="#00C2A8" />
                            <Text style={[styles.copyBtnText, { color: '#00C2A8', fontWeight: '600' }]}>Copied!</Text>
                          </>
                        ) : (
                          <>
                            <CopyIcon size={12} color="#5D6178" />
                            <Text style={styles.copyBtnText}>Copy</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Animated Typing Indicator */}
          {isTyping && (
            <View style={[styles.msgRow, styles.msgRowAssistant]}>
              <View style={styles.assistantAvatar}>
                <ChatBubbleIcon size={14} color="#06342C" />
              </View>
              <View style={styles.bubbleCol}>
                <Text style={styles.senderLabelAssistant}>Assistant</Text>
                <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                  <View style={styles.typingDotRow}>
                    <View style={[styles.typingDot, Platform.OS === 'web' && ({ animation: 'bounceDot 1.4s infinite ease-in-out 0s' } as any)]} />
                    <View style={[styles.typingDot, Platform.OS === 'web' && ({ animation: 'bounceDot 1.4s infinite ease-in-out 0.16s' } as any)]} />
                    <View style={[styles.typingDot, Platform.OS === 'web' && ({ animation: 'bounceDot 1.4s infinite ease-in-out 0.32s' } as any)]} />
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Composer Input Bar */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.composerBar}>
            <TextInput
              style={styles.composerInput}
              placeholder="Type your question here…"
              placeholderTextColor="#9498AC"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
              editable={!isTyping}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!isInputEmpty || isTyping) && styles.sendBtnActive,
              ]}
              onPress={() => handleSendMessage()}
              disabled={isInputEmpty || isTyping}
              activeOpacity={0.85}
            >
              <SendIcon size={18} color={isInputEmpty ? '#9498AC' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
    backgroundColor: '#F3F4FA',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 16 : 0,
  },
  cardContainer: {
    maxWidth: 820,
    width: '100%',
    height: '100%',
    maxHeight: 840,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E4E5F0',
    shadowColor: '#101B3D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  cardContainerMobile: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },

  /* Header Card */
  headerCard: {
    backgroundColor: '#25396B',
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#00C2A8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 13.5,
    color: '#B9BFDA',
    marginTop: 2,
  },

  /* Topic Chips Row */
  topicChipsRow: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E5F0',
    paddingVertical: 10,
  },
  topicChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4FA',
    borderWidth: 1,
    borderColor: '#E4E5F0',
  },
  topicChipText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontSize: 12.5,
    fontWeight: '600',
    color: '#25396B',
  },

  /* Thread Scroll Area */
  threadScrollView: {
    flex: 1,
    backgroundColor: '#F3F4FA',
  },
  threadContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },

  /* Message Rows */
  msgRow: {
    marginBottom: 18,
    maxWidth: '78%',
    flexDirection: 'row',
  },
  msgRowAssistant: {
    alignSelf: 'flex-start',
    gap: 10,
  },
  msgRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#00C2A8',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  bubbleCol: {
    flex: 1,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  senderLabelAssistant: {
    color: '#00C2A8',
  },
  senderLabelUser: {
    color: '#6C5CE7',
    alignSelf: 'flex-end',
  },

  /* Message Bubbles */
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
  },
  bubbleAssistant: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E5F0',
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#6C5CE7',
    borderTopRightRadius: 4,
  },
  msgText: {
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
    fontSize: 13.5,
    lineHeight: 21,
  },
  msgTextAssistant: {
    color: '#12141C',
  },
  msgTextUser: {
    color: '#FFFFFF',
  },

  /* Statutory citation chips */
  citationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  citationChip: {
    backgroundColor: '#EEF6F4',
    borderWidth: 1,
    borderColor: '#C9E8E1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 240,
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

  /* Typing Indicator dots */
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
    cursor: 'pointer',
  },
});
