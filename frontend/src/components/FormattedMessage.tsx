import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

interface FormattedMessageProps {
  content: string;
  isUser?: boolean;
}

/**
 * Parses inline markdown such as **bold** and `code` into styled Text spans.
 */
function renderInlineText(text: string, baseStyle: any, boldStyle: any, codeStyle: any) {
  // Regex to split by **bold** or `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      return (
        <Text key={index} style={boldStyle}>
          {inner}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      return (
        <Text key={index} style={codeStyle}>
          {inner}
        </Text>
      );
    }
    return (
      <Text key={index} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

/**
 * Cleanly parse pipe-delimited markdown table lines.
 */
function parseTableLines(lines: string[]) {
  const tableRows = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) => {
      const cells = line.split('|').slice(1, -1);
      return cells.map((c) => c.trim());
    });

  if (tableRows.length < 2) return null;

  const header = tableRows[0];
  // Check if second row is separator like |--|--|
  const isSep = tableRows[1].every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, '')));
  const dataRows = isSep ? tableRows.slice(2) : tableRows.slice(1);

  return { header, dataRows };
}

export default function FormattedMessage({ content, isUser = false }: FormattedMessageProps) {
  const baseTextColor = isUser ? '#FFFFFF' : '#12141C';
  const boldTextColor = isUser ? '#FFFFFF' : '#06342C';

  const baseStyle = [styles.baseText, { color: baseTextColor }];
  const boldStyle = [styles.boldText, { color: boldTextColor }];
  const codeStyle = [
    styles.codeText,
    isUser ? styles.codeUser : styles.codeAssistant,
  ];

  // Parse blocks: tables vs paragraphs vs lists vs headers
  const rawLines = content.split('\n');
  const blocks: Array<
    | { type: 'header'; level: number; text: string }
    | { type: 'table'; header: string[]; rows: string[][] }
    | { type: 'bullet'; text: string }
    | { type: 'numbered'; num: string; text: string }
    | { type: 'paragraph'; text: string }
  > = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Check for markdown table start
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        tableLines.push(rawLines[i]);
        i++;
      }
      const parsed = parseTableLines(tableLines);
      if (parsed) {
        blocks.push({
          type: 'table',
          header: parsed.header,
          rows: parsed.dataRows,
        });
        continue;
      }
      // If table parsing failed, fall through to render lines
      for (const tLine of tableLines) {
        blocks.push({ type: 'paragraph', text: tLine });
      }
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'header', level: 3, text: trimmed.slice(4).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'header', level: 2, text: trimmed.slice(3).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'header', level: 1, text: trimmed.slice(2).trim() });
      i++;
      continue;
    }

    // Bullet points (•, -, *)
    const bulletMatch = trimmed.match(/^([•\-\*])\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', text: bulletMatch[2].trim() });
      i++;
      continue;
    }

    // Numbered items (1., 2., etc.)
    const numMatch = trimmed.match(/^(\d+[\.\)])\s+(.+)$/);
    if (numMatch) {
      blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2].trim() });
      i++;
      continue;
    }

    // Standard paragraph
    blocks.push({ type: 'paragraph', text: trimmed });
    i++;
  }

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (block.type === 'header') {
          const headerLevelStyle =
            block.level === 1
              ? styles.h1
              : block.level === 2
              ? styles.h2
              : styles.h3;
          return (
            <View key={idx} style={styles.headerWrap}>
              <Text style={[styles.headerText, headerLevelStyle, { color: boldTextColor }]}>
                {block.text}
              </Text>
            </View>
          );
        }

        if (block.type === 'bullet') {
          return (
            <View key={idx} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: isUser ? '#FFFFFF' : '#0B6B5D' }]}>•</Text>
              <Text style={styles.bulletContent}>
                {renderInlineText(block.text, baseStyle, boldStyle, codeStyle)}
              </Text>
            </View>
          );
        }

        if (block.type === 'numbered') {
          return (
            <View key={idx} style={styles.numberedRow}>
              <View style={[styles.numBadge, isUser && styles.numBadgeUser]}>
                <Text style={[styles.numBadgeText, isUser && styles.numBadgeTextUser]}>{block.num}</Text>
              </View>
              <Text style={styles.numberedContent}>
                {renderInlineText(block.text, baseStyle, boldStyle, codeStyle)}
              </Text>
            </View>
          );
        }

        if (block.type === 'table') {
          return (
            <View key={idx} style={styles.tableCard}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.tableScroll}
              >
                <View style={styles.tableInner}>
                  {/* Table Header Row */}
                  <View style={styles.tableHeaderRow}>
                    {block.header.map((col, cIdx) => (
                      <View key={cIdx} style={[styles.tableHeaderCell, cIdx === 0 && styles.firstColCell]}>
                        <Text style={styles.tableHeaderText}>{col}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Table Body Rows */}
                  {block.rows.map((row, rIdx) => {
                    const isEven = rIdx % 2 === 0;
                    return (
                      <View
                        key={rIdx}
                        style={[
                          styles.tableDataRow,
                          isEven ? styles.tableRowEven : styles.tableRowOdd,
                          rIdx === block.rows.length - 1 && styles.lastDataRow,
                        ]}
                      >
                        {row.map((cell, cIdx) => (
                          <View key={cIdx} style={[styles.tableDataCell, cIdx === 0 && styles.firstColCell]}>
                            <Text style={styles.tableDataText}>
                              {renderInlineText(cell, styles.tableCellBase, styles.tableCellBold, styles.codeAssistant)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          );
        }

        // Paragraph
        return (
          <Text key={idx} style={[styles.paragraph, baseStyle]}>
            {renderInlineText(block.text, baseStyle, boldStyle, codeStyle)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  baseText: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  boldText: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  codeText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codeUser: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#FFFFFF',
  },
  codeAssistant: {
    backgroundColor: '#EEF2F6',
    color: '#06342C',
  },
  headerWrap: {
    marginTop: 6,
    marginBottom: 2,
  },
  headerText: {
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    fontWeight: '700',
  },
  h1: {
    fontSize: 16,
    lineHeight: 22,
  },
  h2: {
    fontSize: 15,
    lineHeight: 21,
  },
  h3: {
    fontSize: 14,
    lineHeight: 20,
  },
  paragraph: {
    marginBottom: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginVertical: 2,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 20,
    marginRight: 8,
    fontWeight: '700',
  },
  bulletContent: {
    flex: 1,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginVertical: 3,
  },
  numBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  numBadgeUser: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  numBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#06342C',
  },
  numBadgeTextUser: {
    color: '#FFFFFF',
  },
  numberedContent: {
    flex: 1,
  },

  /* Sleek Responsive Table Card */
  tableCard: {
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4E2DF',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tableScroll: {
    flexGrow: 1,
  },
  tableInner: {
    minWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#06342C',
    borderBottomWidth: 1,
    borderBottomColor: '#04251F',
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 150,
    maxWidth: 260,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#0B483D',
  },
  firstColCell: {
    minWidth: 180,
  },
  tableHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'web' ? "'Space Grotesk', sans-serif" : 'System',
    lineHeight: 16,
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E6EFEF',
  },
  lastDataRow: {
    borderBottomWidth: 0,
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#F9FCFB',
  },
  tableDataCell: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 150,
    maxWidth: 260,
    justifyContent: 'flex-start',
    borderRightWidth: 1,
    borderRightColor: '#E6EFEF',
  },
  tableDataText: {
    fontSize: 12,
    lineHeight: 17,
  },
  tableCellBase: {
    color: '#2D3748',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
  tableCellBold: {
    color: '#06342C',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.OS === 'web' ? "'IBM Plex Sans', sans-serif" : 'System',
  },
});
