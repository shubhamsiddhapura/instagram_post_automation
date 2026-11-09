/**
 * config/music.ts
 *
 * 🌺 MomaiDham: Dedicated Mataji Music Configuration
 *
 * ⚠️ STRICT REQUIREMENT: Only Mataji devotional songs, garba, aarti, and dakla are used for every Reel!
 *
 * Every day of the week is strictly mapped to Mataji music:
 * - Sunday (રવિવાર): માં મોમાઈ સ્પેશિયલ (Momai Maa)
 * - Monday (સોમવાર): માં મોમાઈ ભજન (Momai Maa Bhajan)
 * - Tuesday (મંગળવાર): માતાજી ના ડાકલા (Mataji Dakla)
 * - Wednesday (બુધવાર): માતાજી ના ગરબા (Mataji Na Garba)
 * - Thursday (ગુરુવાર): મોમાઈ કુળદેવી સ્તુતિ (Momai Kuldevi)
 * - Friday (શુક્રવાર): લક્ષ્મી માં / મોમાઈ માં (Lakshmi Maa Bhajan)
 * - Saturday (શનિવાર): માતાજી ના ગરબા અને છંદ (Mataji Na Garba)
 */

export const DAY_WISE_MUSIC_QUERIES: Record<number, string> = {
  // ૦. રવિવાર (Sunday) - માં મોમાઈ દર્શન
  0: 'Momai Maa',

  // ૧. સોમવાર (Monday) - માં મોમાઈ ભજન
  1: 'Momai Maa Bhajan',

  // ૨. મંગળવાર (Tuesday) - માતાજી ના ડાકલા
  2: 'Mataji Dakla',

  // ૩. બુધવાર (Wednesday) - માતાજી ના ગરબા
  3: 'Mataji Na Garba',

  // ૪. ગુરુવાર (Thursday) - મોમાઈ કુળદેવી
  4: 'Momai Kuldevi',

  // ૫. શુક્રવાર (Friday) - લક્ષ્મી માં / અંબે માં ભજન
  5: 'Lakshmi Maa Bhajan',

  // ૬. શનિવાર (Saturday) - માતાજી ના ગરબા
  6: 'Mataji Na Garba'
};

/**
 * Curated pool of 100% Mataji devotional keywords.
 * Used for fallback verification to ensure NO other deity songs are ever selected.
 */
export const MATAJI_KEYWORDS: string[] = [
  'Momai Maa',
  'Momai Kuldevi',
  'Momai Maa Bhajan',
  'Mataji Na Garba',
  'Mataji Dakla',
  'Maa Ambe Garba',
  'Lakshmi Maa Bhajan'
];

/**
 * Returns the official Instagram music search query for the given day.
 * STRICTLY returns Mataji queries only. Defaults to 'Momai Maa'.
 *
 * @param date - Optional custom date (defaults to current date)
 * @returns Search query string for Instagram music catalog (Strictly Mataji)
 */
export function getMusicQueryForDay(date: Date = new Date()): string {
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const query = DAY_WISE_MUSIC_QUERIES[day];
  return query || 'Momai Maa';
}
