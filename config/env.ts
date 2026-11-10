import path from 'path';
import dotenv from 'dotenv';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function normalizePhoneNumber(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  // If Indian 10-digit number without country code, prepend 91
  if (cleaned.length === 10) {
    return '91' + cleaned;
  }
  return cleaned;
}

export interface AppConfig {
  targetGroupJid: string;
  waSessionDir: string;
  waPairingNumber: string;

  instagramUsername: string;
  instagramPassword: string;
  igSessionFile: string;
  igProxy: string | null;

  reelDuration: number;
  musicDir: string;
  videoWidth: number;
  videoHeight: number;

  enableAutoUpload: boolean;
  deleteTempAfterUpload: boolean;

  darshanStartHour: number;
  darshanEndHour: number;

  tempDir: string;
  tempImagesDir: string;
  tempVideosDir: string;
}

const config: AppConfig = {
  // WhatsApp settings
  targetGroupJid: process.env.TARGET_WHATSAPP_GROUP_JID ? process.env.TARGET_WHATSAPP_GROUP_JID.trim() : '',
  waSessionDir: path.resolve(process.cwd(), process.env.WA_SESSION_DIR || './wa-session'),
  waPairingNumber: normalizePhoneNumber(process.env.WA_PAIRING_PHONE_NUMBER),

  // Instagram credentials
  instagramUsername: process.env.INSTAGRAM_USERNAME ? process.env.INSTAGRAM_USERNAME.trim() : '',
  instagramPassword: process.env.INSTAGRAM_PASSWORD ? process.env.INSTAGRAM_PASSWORD.trim() : '',
  igSessionFile: path.resolve(process.cwd(), process.env.IG_SESSION_FILE || './ig_session.json'),
  igProxy: process.env.IG_PROXY ? process.env.IG_PROXY.trim() : null,

  // Reel settings
  reelDuration: parseInt(process.env.REEL_DURATION_SECONDS || '15', 10),
  musicDir: path.resolve(process.cwd(), process.env.MUSIC_DIR || './assets/music'),
  videoWidth: parseInt(process.env.VIDEO_WIDTH || '1080', 10),
  videoHeight: parseInt(process.env.VIDEO_HEIGHT || '1920', 10),

  // Automation flags
  enableAutoUpload: (process.env.ENABLE_AUTO_UPLOAD || 'false').toLowerCase() === 'true',
  deleteTempAfterUpload: (process.env.DELETE_TEMP_AFTER_UPLOAD || 'false').toLowerCase() === 'true',

  // Daily morning darshan allowed time window (default 5:00 AM to 12:00 PM)
  darshanStartHour: parseInt(process.env.DARSHAN_START_HOUR || '5', 10),
  darshanEndHour: parseInt(process.env.DARSHAN_END_HOUR || '12', 10),

  // Directories
  tempDir: path.resolve(process.cwd(), 'temp'),
  tempImagesDir: path.resolve(process.cwd(), 'temp', 'images'),
  tempVideosDir: path.resolve(process.cwd(), 'temp', 'videos'),
};

export default config;
