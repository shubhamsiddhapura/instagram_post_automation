
/**
 * config/captions.ts
 *
 * 🌺 MomaiDham Caption & Hashtags Configuration
 *
 * All caption and hashtag settings are managed right here in this file (not in .env).
 * Format:
 * 1. Date Day Year | Tithi (in Gujarati)
 * 2. Jay Momai Ma
 * 3. 5 Trending Viral Hashtags
 */

export interface CaptionConfig {
  captionPrefix: string;
  hashtags: string;
}

export interface PanchangInfo {
  dateStr: string;
  dayName: string;
  year: number;
  tithi: string;
}

export interface CaptionOptions {
  customText?: string;
  date?: Date;
}

// ----------------- Caption & Hashtags ---------------------
// 👉 You can edit your caption text and hashtags directly here:
export const CAPTION_CONFIG: CaptionConfig = {
  // Greeting text in Gujarati
  captionPrefix: 'જય મોમાઈ માં 🙏✨\nશ્રી મોમાઈ ધામ દર્શન',

  // 5 Trending hashtags to make the Reel viral on Instagram
  hashtags: '#momaidham #jaymomaima #reelsindia #trendingreels #viralreels'
};

// ----------------- Gujarati Panchang Dictionaries ---------
export const GUJARATI_DAYS: readonly string[] = [
  'રવિવાર',   // Sunday
  'સોમવાર',   // Monday
  'મંગળવાર',  // Tuesday
  'બુધવાર',   // Wednesday
  'ગુરુવાર',  // Thursday
  'શુક્રવાર',  // Friday
  'શનિવાર'    // Saturday
];

export const HINDU_MONTHS_GUJ: readonly string[] = [
  'ચૈત્ર', 'વૈશાખ', 'જેઠ', 'અષાઢ', 'શ્રાવણ', 'ભાદરવો',
  'આસો', 'કાર્તક', 'માગશર', 'પોષ', 'મહા', 'ફાગણ'
];

export const TITHI_NAMES_GUJ: readonly string[] = [
  // સુદ (શુક્લ પક્ષ)
  'સુદ એકમ', 'સુદ બીજ', 'સુદ ત્રીજ', 'સુદ ચોથ', 'સુદ પાંચમ',
  'સુદ છઠ', 'સુદ સાતમ', 'સુદ આઠમ', 'સુદ નોમ', 'સુદ દસમ',
  'સુદ અગિયારસ', 'સુદ બારસ', 'સુદ તેરસ', 'સુદ ચૌદશ', 'પૂનમ',

  // વદ (કૃષ્ણ પક્ષ)
  'વદ એકમ', 'વદ બીજ', 'વદ ત્રીજ', 'વદ ચોથ', 'વદ પાંચમ',
  'વદ છઠ', 'વદ સાતમ', 'વદ આઠમ', 'વદ નોમ', 'વદ દસમ',
  'વદ અગિયારસ', 'વદ બારસ', 'વદ તેરસ', 'વદ ચૌદશ', 'અમાસ'
];

/**
 * Calculates dynamic Hindu Panchang Tithi based on Moon and Sun longitudes.
 */
export function calculateGujaratiPanchang(date: Date = new Date()): PanchangInfo {
  const jd = (date.getTime() / 86400000.0) + 2440587.5;
  const d = jd - 2451545.0;
  const rad = Math.PI / 180;

  // Solar longitude
  const L0 = (280.46646 + 0.98564736 * d) % 360;
  const M0 = (357.52911 + 0.98560028 * d) % 360;
  const C0 = (1.914602 - 0.004817 * (d / 36525)) * Math.sin(M0 * rad) + 0.019993 * Math.sin(2 * M0 * rad);
  let sunLong = (L0 + C0) % 360;
  if (sunLong < 0) sunLong += 360;

  // Lunar longitude
  const Lm = (218.3165 + 13.176396 * d) % 360;
  const Mm = (134.9634 + 13.064993 * d) % 360;
  let moonLong = (Lm + 6.289 * Math.sin(Mm * rad) - 1.274 * Math.sin((Mm - 2 * (Lm - sunLong)) * rad) + 0.658 * Math.sin(2 * (Lm - sunLong) * rad)) % 360;
  if (moonLong < 0) moonLong += 360;

  // Angular distance between Moon and Sun
  let diff = (moonLong - sunLong) % 360;
  if (diff < 0) diff += 360;

  const tithiIndex = Math.floor(diff / 12) + 1; // 1 to 30
  const siderealSun = (sunLong - 24.1 + 360) % 360;
  const rashiIndex = Math.floor(siderealSun / 30);
  const hinduMonth = HINDU_MONTHS_GUJ[(rashiIndex + 1) % 12];
  const tithiName = TITHI_NAMES_GUJ[(tithiIndex - 1) % 30];

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dayName = GUJARATI_DAYS[date.getDay()];

  return {
    dateStr: `${day}/${month}/${year}`,
    dayName,
    year,
    tithi: `${hinduMonth} ${tithiName}`
  };
}

/**
 * Builds the full Gujarati Instagram caption.
 */
export function generateReelCaption(options: CaptionOptions = {}): string {
  const now = options.date || new Date();
  const panchang = calculateGujaratiPanchang(now);

  const lines: string[] = [
    // 1. Date Day Year | Tithi
    `🗓️ ${panchang.dateStr}, ${panchang.dayName} | તિથિ: ${panchang.tithi}`,
    ''
  ];

  // Optional extra text if sent with the WhatsApp photo
  if (options.customText && options.customText.trim()) {
    lines.push(options.customText.trim(), '');
  }

  // 2. Jay Momai Ma (Caption Prefix)
  lines.push(CAPTION_CONFIG.captionPrefix);
  lines.push('');

  // 3. 5 Trending Viral Hashtags
  lines.push(CAPTION_CONFIG.hashtags);

  return lines.join('\n');
}

/**
 * Message template sent to the WhatsApp group when a Reel is uploaded.
 */
export function generateWhatsAppShareMessage(reelUrl: string, date: Date = new Date()): string {
  const panchang = calculateGujaratiPanchang(date);
  return [
    '🌺 જય મોમાઈ માં 🙏✨',
    `🗓️ ${panchang.dateStr}, ${panchang.dayName} | તિથિ: ${panchang.tithi}`,
    '',
    'આજના માતાજીના દર્શન ની Instagram Reel અપલોડ થઈ ગઈ છે:',
    `🔗 ${reelUrl}`,
    '',
    '👉 Reel ને Like કરો, Follow કરો અને Share કરો! 🙏✨',
    '(Do Like, Follow & Share ❤️)'
  ].join('\n');
}
