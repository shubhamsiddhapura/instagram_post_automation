/**
 * scripts/post-last-image.ts
 * Run: npm run post:last
 *
 * Connects to WhatsApp, fetches the most recent image from the configured group,
 * converts it into a 9:16 vertical Reel, and posts it to Instagram!
 */

import './patch-baileys.js';
import fs from 'fs';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  WAMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';

import config from '../config/env';
import Logger from '../src/utils/logger';
import { generateReelFromImage } from '../src/video/reelGenerator';
import { frameDarshanImage } from '../src/video/imageFramer';
import { generateReelCaption } from '../config/captions';
import { getMusicQueryForDay } from '../config/music';
import { uploadReel, prepareOfficialTrack } from '../src/instagram/uploader';
import { downloadWhatsAppImage, isImageMessage, getImageCaption } from '../src/whatsapp/mediaHelper';
import { ensureDirectories } from '../src/utils/cleanup';

const logger = Logger.forModule('PostLastImage');
const baileyLogger = pino({ level: 'silent' });

function extractNumericGroupId(jid?: string | null): string {
  if (!jid) return '';
  return jid.replace(/@.*$/, '').replace(/:.*$/, '').trim();
}

function getISTTime(date: Date): { hours: number; minutes: number; timeInMinutes: number; timeStr: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour')?.value || '0';
  const minutePart = parts.find(p => p.type === 'minute')?.value || '0';
  const hours = parseInt(hourPart, 10) % 24;
  const minutes = parseInt(minutePart, 10);
  const timeInMinutes = hours * 60 + minutes;
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} IST`;
  return { hours, minutes, timeInMinutes, timeStr };
}

async function run(): Promise<void> {
  console.log('\n======================================================');
  console.log('       🌺 MomaiDham: Post Last Image to Instagram 🌺     ');
  console.log('======================================================\n');

  ensureDirectories([
    config.tempDir,
    config.tempImagesDir,
    config.tempVideosDir,
    config.musicDir,
    config.waSessionDir
  ]);

  const targetGroupId = extractNumericGroupId(config.targetGroupJid);
  if (!targetGroupId) {
    logger.error('TARGET_WHATSAPP_GROUP_JID is not set in .env! Run "npm run wa:scan" to find your group ID.');
    process.exit(1);
  }

  logger.info(`Target Group: ${config.targetGroupJid} (ID: ${targetGroupId})`);
  logger.info(`Instagram Account: @${config.instagramUsername}`);

  // Check if an image path was provided directly as an argument
  const customImagePath = process.argv[2];
  if (customImagePath && fs.existsSync(customImagePath)) {
    logger.info(`Using provided image from path: ${customImagePath}`);
    await processAndUpload(customImagePath, 'આજના મંગળા દર્શન');
    return;
  }

  const { state } = await useMultiFileAuthState(config.waSessionDir);
  const { version } = await fetchLatestBaileysVersion();

  logger.info('Connecting to WhatsApp...');

  const sock = makeWASocket({
    version,
    logger: baileyLogger,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: true,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
  });

  const capturedImages: WAMessage[] = [];

  // Listen to history sync
  sock.ev.on('messaging-history.set', ({ messages }) => {
    logger.info(`Received history sync with ${messages.length} message(s)...`);
    for (const m of messages) {
      const msgGroupId = extractNumericGroupId(m.key?.remoteJid);
      if (msgGroupId === targetGroupId && isImageMessage(m.message)) {
        capturedImages.push(m);
      }
    }
  });

  // Listen to message upserts
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const m of messages) {
      const msgGroupId = extractNumericGroupId(m.key?.remoteJid);
      if (msgGroupId === targetGroupId && isImageMessage(m.message)) {
        capturedImages.push(m);
      }
    }
  });

  // Wait for connection to open
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timed out after 30 seconds.'));
    }, 30_000);

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        clearTimeout(timeout);
        logger.success('✅ Connected to WhatsApp!');
        resolve();
      }
      if (connection === 'close') {
        clearTimeout(timeout);
        reject(new Error(`Connection closed: ${JSON.stringify(lastDisconnect?.error)}`));
      }
    });
  });

  logger.info('Syncing recent group messages (waiting 8 seconds)...');
  await new Promise((r) => setTimeout(r, 8000));

  if (capturedImages.length === 0) {
    logger.warn('⚠️ No image was found in the recent history sync for this group.');
    logger.info('👉 Please send/forward the darshan image into your WhatsApp group now, or run the bot with: npm start');
    sock.end(undefined);
    process.exit(0);
  }

  // Sort by timestamp descending (newest first)
  capturedImages.sort((a, b) => {
    const tA = Number(a.messageTimestamp || 0);
    const tB = Number(b.messageTimestamp || 0);
    return tB - tA;
  });

  const latest = capturedImages[0];
  const waCaption = getImageCaption(latest.message);
  const msgDate = new Date(Number(latest.messageTimestamp) * 1000);
  logger.success(`📸 Found latest image from group! Timestamp: ${msgDate.toLocaleString()}`);

  // Enforce 6:00 AM - 12:00 PM IST time window
  const { timeInMinutes, timeStr } = getISTTime(msgDate);
  const startMinutes = config.darshanStartHour * 60; // 6:00 AM IST = 360
  const endMinutes = config.darshanEndHour * 60;     // 12:00 PM IST = 720

  if (timeInMinutes < startMinutes || timeInMinutes > endMinutes) {
    logger.warn(`⚠️ Image was sent at ${timeStr}, which is outside the morning darshan window (${config.darshanStartHour}:00 AM - ${config.darshanEndHour}:00 PM IST).`);
    logger.warn('Skipping automated upload to respect the daily darshan schedule.');
    sock.end(undefined);
    process.exit(0);
  }

  if (waCaption) {
    logger.info(`Attached Caption: "${waCaption}"`);
  }

  // Download image
  const imagePath = await downloadWhatsAppImage(latest);
  sock.end(undefined);

  await processAndUpload(imagePath, waCaption);
}

async function processAndUpload(imagePath: string, customText: string): Promise<void> {
  // Step 1: Automatically frame raw darshan photo into official Shree MomaiDham template
  const framedImagePath = await frameDarshanImage(imagePath);

  // Step 2: Prepare today's official Instagram devotional track (Mataji only)
  const musicQuery = getMusicQueryForDay();
  logger.info(`🎵 Day-wise music query for today: "${musicQuery}"`);
  const preparedTrack = await prepareOfficialTrack(musicQuery);

  // Step 3: Generate 9:16 vertical Reel with official audio baked in
  const videoPath = await generateReelFromImage(framedImagePath, {
    audioPath: preparedTrack?.audioPath,
    audioStartTime: preparedTrack?.startTimeSeconds
  });

  // Step 4: Generate Gujarati caption with Panchang Tithi & 5 viral hashtags
  const caption = generateReelCaption({ customText });
  logger.info(`Generated Caption:\n-------------------------\n${caption}\n-------------------------`);

  // Step 5: Upload to Instagram
  logger.info('🚀 Publishing Reel to Instagram...');
  const result = await uploadReel(videoPath, caption, {
    thumbnailPath: framedImagePath,
    musicQuery: musicQuery,
    trackId: preparedTrack?.trackId
  });

  logger.success(`🎉 Done! Result:\n${JSON.stringify(result, null, 2)}`);
  process.exit(0);
}

run().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error(`Failed to process last image: ${msg}`, err);
  process.exit(1);
});
