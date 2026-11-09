import '../../scripts/patch-baileys.js';
import fs from 'fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  proto,
  WAMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

import config from '../../config/env';
import Logger from '../utils/logger';
import reelQueue from '../utils/queue';
import { generateReelFromImage } from '../video/reelGenerator';
import { frameDarshanImage } from '../video/imageFramer';
import { generateReelCaption } from '../../config/captions';
import { getMusicQueryForDay } from '../../config/music';
import { uploadReel, prepareOfficialTrack } from '../instagram/uploader';
import { downloadWhatsAppImage, isImageMessage, getImageCaption } from './mediaHelper';
import { deleteFile } from '../utils/cleanup';

const logger = Logger.forModule('WhatsAppClient');
const baileyLogger = pino({ level: 'silent' });

function extractNumericGroupId(jid?: string | null): string {
  if (!jid) return '';
  return jid.replace(/@.*$/, '').replace(/:.*$/, '').trim();
}

export class WhatsAppClient {
  private _sock: WASocket | null = null;
  private _isReady = false;
  private _isReconnecting = false;
  private _groups = new Map<string, string>();

  /**
   * Initializes Baileys connection and starts event listening.
   */
  public async start(): Promise<void> {
    if (this._isReconnecting) return;
    this._isReconnecting = true;

    logger.info('Initializing WhatsApp connection via Baileys...');

    if (!fs.existsSync(config.waSessionDir)) {
      fs.mkdirSync(config.waSessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(config.waSessionDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`Using Baileys v${version.join('.')} (Latest: ${isLatest})`);

      this._sock = makeWASocket({
        version,
        logger: baileyLogger,
        auth: state,
        printQRInTerminal: false,
        getMessage: async () => ({ conversation: '' }),
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
      });

      // Save auth credentials whenever updated
      this._sock.ev.on('creds.update', saveCreds);

      // Connection state updates
      this._sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr && !config.waPairingNumber) {
          logger.info('Scan the QR code below using WhatsApp (Linked Devices):');
          qrcode.generate(qr, { small: true });
        }

        // Phone pairing code support
        if (qr && config.waPairingNumber && this._sock && !this._sock.authState.creds.registered) {
          try {
            logger.info(`Requesting pairing code for phone number: ${config.waPairingNumber}`);
            const code = await this._sock.requestPairingCode(config.waPairingNumber);
            logger.success(`================================================`);
            logger.success(`🔑 Your WhatsApp 8-Digit Pairing Code: ${code}`);
            logger.success(`================================================`);
          } catch (pairErr: unknown) {
            const msg = pairErr instanceof Error ? pairErr.message : String(pairErr);
            logger.error(`Failed to request pairing code: ${msg}`);
          }
        }

        if (connection === 'close') {
          this._isReady = false;
          const statusCode = (lastDisconnect?.error instanceof Boom)
            ? lastDisconnect.error.output.statusCode
            : null;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          logger.warn(`WhatsApp connection closed (Status code: ${statusCode || 'unknown'}).`);

          if (shouldReconnect) {
            logger.info('Reconnecting in 5 seconds...');
            setTimeout(() => {
              this._isReconnecting = false;
              this.start();
            }, 5000);
          } else {
            logger.error('WhatsApp session logged out. Please delete ./wa-session and scan QR again.');
            this._isReconnecting = false;
          }
        }

        if (connection === 'open') {
          this._isReady = true;
          this._isReconnecting = false;
          logger.success('✅ Connected to WhatsApp successfully!');
          await this._loadAndDisplayGroups();
        }
      });

      // Listen for incoming messages
      this._sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          await this._handleIncomingMessage(msg);
        }
      });

    } catch (err: unknown) {
      this._isReconnecting = false;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Error initializing WhatsApp client: ${msg}`, err);
    }
  }

  /**
   * Loads all participating groups and prints them for reference.
   */
  private async _loadAndDisplayGroups(): Promise<void> {
    if (!this._sock) return;

    try {
      const groups = await this._sock.groupFetchAllParticipating();
      this._groups.clear();

      logger.info('--- Connected WhatsApp Groups ---');
      for (const [id, group] of Object.entries(groups)) {
        this._groups.set(id, group.subject);
        const isTarget = config.targetGroupJid && config.targetGroupJid === id;
        const tag = isTarget ? '🎯 [TARGET GROUP]' : '  ';
        logger.info(`${tag} "${group.subject}" -> ID: ${id}`);
      }
      logger.info('---------------------------------');

      if (!config.targetGroupJid) {
        logger.warn('⚠️ TARGET_WHATSAPP_GROUP_JID is empty in .env.');
        logger.warn('Images from ANY group will be processed, or you can paste one of the group IDs above into .env!');
      } else {
        const groupName = this._groups.get(config.targetGroupJid) || 'Unknown Group';
        logger.success(`🎯 Actively monitoring group: "${groupName}" (${config.targetGroupJid})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Could not fetch group list: ${msg}`);
    }
  }

  /**
   * Processes an incoming message to check if it's an image strictly from the target group.
   */
  private async _handleIncomingMessage(msg: WAMessage): Promise<void> {
    if (!msg.message || !msg.key) return;
    if (msg.key.fromMe) return; // Don't process our own messages

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    // 1. Must be a WhatsApp group (@g.us). Never process private chats, status broadcasts, or channels!
    if (!remoteJid.endsWith('@g.us')) return;

    // 2. Strict Target Group Enforcement:
    // If TARGET_WHATSAPP_GROUP_JID is not configured, BLOCK all incoming messages.
    const targetGroupId = extractNumericGroupId(config.targetGroupJid);
    if (!targetGroupId) {
      logger.error('❌ SAFETY BLOCK: TARGET_WHATSAPP_GROUP_JID is not configured in .env! Refusing to process messages.');
      return;
    }

    // 3. Strictly match the incoming group with the configured target group.
    const incomingGroupId = extractNumericGroupId(remoteJid);
    if (incomingGroupId !== targetGroupId) {
      // Silently ignore messages from all other groups
      return;
    }

    // 4. Must be an image message
    if (!isImageMessage(msg.message)) {
      return;
    }

    // 5. Daily Darshan Time Window Check (Strictly 6:00 AM to 12:00 PM):
    const msgTimestampSeconds = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000));
    const msgDate = new Date(msgTimestampSeconds * 1000);
    const msgHours = msgDate.getHours();
    const msgMinutes = msgDate.getMinutes();
    const timeInMinutes = msgHours * 60 + msgMinutes;

    const startMinutes = config.darshanStartHour * 60; // 6:00 AM = 360
    const endMinutes = config.darshanEndHour * 60;     // 12:00 PM = 720

    if (timeInMinutes < startMinutes || timeInMinutes > endMinutes) {
      const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      logger.warn(`⏰ Image received at ${timeStr}, which is OUTSIDE the allowed Darshan window (${config.darshanStartHour}:00 AM - ${config.darshanEndHour}:00 PM). Skipping upload.`);
      return;
    }

    const groupName = this._groups.get(remoteJid) || `Group ${targetGroupId}`;
    const sender = msg.key.participant || msg.pushName || 'Participant';
    const waCaption = getImageCaption(msg.message);

    logger.success(`🎯 Verified Darshan image received from Target Group "${groupName}" by ${sender}`);
    if (waCaption) {
      logger.info(`📝 Caption attached in WhatsApp: "${waCaption}"`);
    }

    // Enqueue the complete Reel creation & publication pipeline
    reelQueue.add(`Reel for image from ${groupName}`, async () => {
      let downloadedImagePath: string | null = null;
      let generatedVideoPath: string | null = null;

      try {
        // Step 1: Download image from WhatsApp
        downloadedImagePath = await downloadWhatsAppImage(msg);

        // Step 2: Automatically frame raw darshan photo into official Shree MomaiDham template
        const framedImagePath = await frameDarshanImage(downloadedImagePath);

        // Step 3: Fetch and prepare today's official Instagram devotional music (Mataji only)
        const musicQuery = getMusicQueryForDay();
        logger.info(`🎵 Day-wise music query for today: "${musicQuery}"`);
        const preparedTrack = await prepareOfficialTrack(musicQuery);

        // Step 4: Generate Reel with official audio baked in & framed template
        generatedVideoPath = await generateReelFromImage(framedImagePath, {
          audioPath: preparedTrack?.audioPath,
          audioStartTime: preparedTrack?.startTimeSeconds
        });

        // Step 5: Format Gujarati Instagram caption
        const instagramCaption = generateReelCaption({ customText: waCaption });

        // Step 6: Publish Reel to Instagram
        const uploadResult = await uploadReel(generatedVideoPath, instagramCaption, {
          thumbnailPath: framedImagePath,
          musicQuery: musicQuery,
          trackId: preparedTrack?.trackId
        });

        // Step 5: Optional cleanup
        if (config.deleteTempAfterUpload && uploadResult.success) {
          deleteFile(downloadedImagePath);
          deleteFile(generatedVideoPath);
        }

      } catch (err: unknown) {
        const msgStr = err instanceof Error ? err.message : String(err);
        logger.error(`Pipeline failed for image: ${msgStr}`, err);
        throw err;
      }
    });
  }

  public get isReady(): boolean {
    return this._isReady;
  }
}

export default WhatsAppClient;
