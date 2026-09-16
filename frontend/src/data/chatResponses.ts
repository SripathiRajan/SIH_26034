import { ChatMessage, ScanRecord } from '../types';
import { rulesDatabase } from './rulesDatabase';

interface MatchResponse {
  keywords: string[];
  response: (question: string, latestScan?: ScanRecord) => { text: string; sources?: string[]; citations?: string[] };
}

const matchers: MatchResponse[] = [
  {
    keywords: ['mrp', 'price', 'tax', 'taxes', 'rupee', 'usp', 'unit sale price'],
    response: (_, latestScan) => ({
      text:
        '**Maximum Retail Price (MRP) & Unit Sale Price (USP) Rules:**\n\n' +
        '1. **MRP Format:** Under **Rule 6(1)(e)** of the Legal Metrology (Packaged Commodities) Rules, 2011, MRP must be declared in Indian Rupees as `MRP ₹ xx.xx (incl. of all taxes)`.\n\n' +
        '2. **Unit Sale Price (USP):** Mandatory since 1st Jan 2022. For products sold by weight/volume, USP must be displayed per gram, per kilogram, per millilitre, or per litre.\n\n' +
        '3. **No Dual MRP:** Dual MRP on the same commodity for different locations/consumers is illegal under Rule 18(2A).' +
        (latestScan
          ? `\n\n*Current Scan Note (${latestScan.productName}):* ${latestScan.fields.find((f) => f.label.includes('MRP'))?.ruleExplanation || 'MRP check complete.'}`
          : ''),
      sources: ['DoCA Rule 6(1)(e)', 'G.S.R. 779(E) Amendment 2021'],
      citations: ['Rule 6(1)(e)', 'Rule 18(2A)'],
    }),
  },
  {
    keywords: ['font', 'size', 'height', 'millimeter', 'mm', 'readability', 'rule 11', 'pdp', 'display panel'],
    response: () => ({
      text:
        '**Rule 11: Minimum Font Size Standards (Schedule II):**\n\n' +
        '- **PDP Area <= 50 cm²:** Minimum numeral height = **1.0 mm** (0.5 mm for net qty)\n' +
        '- **50 cm² - 100 cm²:** Minimum height = **1.5 mm**\n' +
        '- **100 cm² - 500 cm²:** Minimum height = **2.0 mm** (2.5 mm for MRP & Net Qty)\n' +
        '- **> 500 cm²:** Minimum height = **4.0 mm** (6.0 mm for MRP & Net Qty)\n\n' +
        '*Note for Officers:* Font size numbers reported by computer vision scanning are automated screening estimates. Statutory millimeter measurements must be verified with physical optical reticles during formal seizure.',
      sources: ['Legal Metrology Rules 2011 Schedule II', 'DoCA Technical SOP'],
      citations: ['Rule 11 Table 1'],
    }),
  },
  {
    keywords: ['consumer care', 'complaint', 'email', 'phone', 'helpline', 'grievance', 'contact'],
    response: (_, latestScan) => ({
      text:
        '**Rule 6(1)(g): Consumer Care Details Requirement:**\n\n' +
        'Every packaged commodity MUST prominently display:\n' +
        '1. **Designation / Name** of contact officer\n' +
        '2. **Full Postal Address** for written complaints\n' +
        '3. **Telephone / Toll-Free Helpline Number**\n' +
        '4. **Valid Email Address** for grievance redressal\n\n' +
        '*Common Violation:* Missing email address or providing only a PO Box without a phone number.' +
        (latestScan
          ? `\n\n*Latest Scan (${latestScan.productName}):* Consumer Care status is **${latestScan.fields.find((f) => f.label.includes('Consumer Care'))?.status.toUpperCase()}**.`
          : ''),
      sources: ['Rule 6(1)(g)', 'DoCA Consumer Protection Act Sync'],
      citations: ['Rule 6(1)(g)'],
    }),
  },
  {
    keywords: ['manufacturer', 'packer', 'importer', 'origin', 'country', 'address', 'pin code'],
    response: () => ({
      text:
        '**Rule 6(1)(a) & 6(1)(m): Manufacturer & Origin Rules:**\n\n' +
        '- **Manufacturer/Packer Address:** Must contain complete postal address including premises/flat number, street, city, state, and **PIN Code**.\n' +
        '- **Imported Packages (Rule 6(1)(m)):** Name of the **Country of Origin** (e.g. "Made in India" or "Country of Origin: Vietnam") must be declared in English or Hindi.\n' +
        '- **Importer Address:** For imported goods, the registered Indian importer address is mandatory.',
      sources: ['Rule 6(1)(a)', 'Rule 6(1)(m)', 'DoCA Import Notification 2020'],
      citations: ['Rule 6(1)(a)', 'Rule 6(1)(m)'],
    }),
  },
  {
    keywords: ['net quantity', 'weight', 'gram', 'kg', 'ml', 'litre', 'volume', 'si unit'],
    response: () => ({
      text:
        '**Rule 6(1)(c) & Rule 9: Net Quantity Rules:**\n\n' +
        '- **Standard Units:** Mass in grams (`g`) or kilograms (`kg`), volume in millilitres (`ml`) or litres (`l`).\n' +
        '- **Symbol Precision:** Capital letters like `GMS`, `KGMS`, `ML.` are non-compliant. Standard lowercase SI symbols (`g`, `kg`, `ml`, `l`) are mandatory.\n' +
        '- **Quantity Tolerance:** Maximum permissible errors (MPE) allowed under Schedule II range from 1% to 9% depending on pack size.',
      sources: ['Rule 6(1)(c)', 'Rule 9 Schedule II'],
      citations: ['Rule 6(1)(c)', 'Rule 9'],
    }),
  },
  {
    keywords: ['why', 'fail', 'flag', 'failed', 'issue', 'violation', 'reason'],
    response: (_, latestScan) => {
      if (!latestScan) {
        return {
          text: 'No active scan found in session. Select or perform a scan to see field failure breakdowns.',
          sources: ['Scan History Engine'],
        };
      }
      const failedFields = latestScan.fields.filter((f) => f.status !== 'pass');
      if (failedFields.length === 0) {
        return {
          text: `Product **${latestScan.productName}** passed all Legal Metrology Rule checks without any violations detected!`,
          sources: ['Scan Result Engine'],
        };
      }
      const details = failedFields
        .map(
          (f) =>
            `- **${f.label} (${f.status.toUpperCase()}):** ${f.detail || f.ruleExplanation} *(Citation: ${f.ruleRef})*`
        )
        .join('\n');
      return {
        text: `**Violation Summary for ${latestScan.productName} (${latestScan.brand}):**\n\n${details}\n\n*Action Suggested:* Enforcement officer may issue a notice under Section 36 of the Legal Metrology Act, 2009.`,
        sources: [`Scan ID #${latestScan.id}`, 'Legal Metrology Act 2009 Sec 36'],
        citations: failedFields.map((f) => f.ruleRef || 'Rule 6').filter(Boolean),
      };
    },
  },
  {
    keywords: ['notice', 'show cause', 'penalty', 'fine', 'section 36', 'prosecution', 'seizure'],
    response: () => ({
      text:
        '**Legal Provisions & Enforcement Penalties (Legal Metrology Act, 2009):**\n\n' +
        '- **Section 36(1) - Non-Compliant Packages:** Penalty up to **₹25,000** for first offence, up to **₹50,000** for second offence, and up to **₹1,00,000 or imprisonment** for subsequent offences.\n' +
        '- **Section 36(2) - Overcharging (MRP violation):** Fine up to **₹2,000** per package.\n' +
        '- **Notice Template:** Generated in PDF report with scanned visual evidence and multi-engine OCR bounding box extraction.',
      sources: ['Legal Metrology Act, 2009 Sec 36', 'DoCA SOP for Inspection'],
      citations: ['Act Sec 36(1)', 'Act Sec 36(2)'],
    }),
  },
];

export function getIntelligentResponse(
  question: string,
  latestScan?: ScanRecord
): { text: string; sources?: string[]; citations?: string[] } {
  const q = question.toLowerCase();

  for (const matcher of matchers) {
    if (matcher.keywords.some((kw) => q.includes(kw))) {
      return matcher.response(question, latestScan);
    }
  }

  const matchingRule = rulesDatabase.find(
    (r) =>
      q.includes(r.section.toLowerCase()) ||
      r.tags.some((tag) => q.includes(tag.toLowerCase())) ||
      q.includes(r.title.toLowerCase())
  );

  if (matchingRule) {
    return {
      text: `**${matchingRule.section} — ${matchingRule.title}:**\n\n${matchingRule.fullText}\n\n*Amendment Info:* ${matchingRule.amendment || 'Standard 2011 rule.'}`,
      sources: ['DoCA Knowledge Base', matchingRule.section],
      citations: [matchingRule.section],
    };
  }

  return {
    text:
      `I searched the Legal Metrology (Packaged Commodities) Rules 2011 knowledge base for "${question}".\n\n` +
      `Under **Rule 6**, mandatory declarations include: (a) Manufacturer Address, (b) Commodity Name, (c) Net Quantity, (d) Month/Year of Mfg, (e) MRP inclusive of taxes & USP, and (g) Consumer Care details.\n\n` +
      `Try asking specific questions like:\n` +
      `- *"What is the minimum font size for 200g pack?"*\n` +
      `- *"Why did the latest scan fail?"*\n` +
      `- *"What are the penalties under Section 36?"*`,
    sources: ['Legal Metrology Rules 2011 Knowledge Base'],
    citations: ['Rule 6', 'Rule 11'],
  };
}
