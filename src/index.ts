import http from 'http';
import config from '../config/env';
import Logger from './utils/logger';
import { ensureDirectories } from './utils/cleanup';
import { ensureSessionsRestored } from './utils/sessionSync';
import WhatsAppClient from './whatsapp/client';

const logger = Logger.forModule('Main');

let waClient: WhatsAppClient | null = null;

function startHealthServer(): http.Server {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    if (url === '/ping' || url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const mem = process.memoryUsage();
      res.end(
        JSON.stringify({
          status: 'healthy',
          service: 'momaidham-automation',
          whatsappConnected: waClient?.isReady ?? false,
          uptimeSeconds: Math.floor(process.uptime()),
          memory: {
            rssMB: Math.round(mem.rss / 1024 / 1024),
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024)
          },
          currentTime: new Date().toISOString(),
          targetGroup: config.targetGroupJid,
          darshanWindow: `${config.darshanStartHour}:00 AM - ${config.darshanEndHour}:00 PM`,
          instagramAccount: config.instagramUsername
        })
      );
      return;
    }

    // Default: Root Dashboard
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const isReady = waClient?.isReady ?? false;
    const uptimeMinutes = Math.floor(process.uptime() / 60);

    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🌺 Shree MomaiDham Automation Service</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 2.5rem; max-width: 580px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 1.5rem; margin-bottom: 1.5rem; }
    .header h1 { font-size: 1.6rem; color: #fbbf24; margin: 0 0 0.5rem 0; }
    .badge { display: inline-block; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 600; font-size: 0.85rem; }
    .badge.online { background: #065f46; color: #34d399; border: 1px solid #059669; }
    .badge.connecting { background: #854d0e; color: #fde047; border: 1px solid #ca8a04; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .stat-box { background: #0f172a; padding: 1rem; border-radius: 10px; border: 1px solid #334155; }
    .stat-label { font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.05rem; font-weight: 600; color: #f8fafc; margin-top: 0.25rem; word-break: break-all; }
    .footer { text-align: center; color: #64748b; font-size: 0.85rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🌺 શ્રી મોમાઈ ધામ સુરત 🌺</h1>
      <p style="margin: 0; color: #94a3b8;">WhatsApp Darshan ➔ Instagram Reels Auto-Publisher</p>
      <div style="margin-top: 1rem;">
        <span class="badge ${isReady ? 'online' : 'connecting'}">
          ${isReady ? '● WHATSAPP CONNECTED & ACTIVE' : '○ INITIALIZING / CONNECTING...'}
        </span>
      </div>
    </div>
    <div class="stats">
      <div class="stat-box">
        <div class="stat-label">Instagram Target</div>
        <div class="stat-value">@${config.instagramUsername}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Darshan Window</div>
        <div class="stat-value">${config.darshanStartHour}:00 AM - ${config.darshanEndHour}:00 PM</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Target Group ID</div>
        <div class="stat-value">${config.targetGroupJid.split('@')[0]}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Server Uptime</div>
        <div class="stat-value">${uptimeMinutes} minutes</div>
      </div>
    </div>
    <div class="stat-box" style="margin-bottom: 1.5rem;">
      <div class="stat-label">24/7 Keep-Alive Monitor Endpoint</div>
      <div class="stat-value" style="color: #38bdf8;">/ping</div>
      <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.35rem;">
        Pinged every 5-10 mins by UptimeRobot to keep the free cloud server awake 24/7.
      </div>
    </div>
    <div class="footer">
      Shree MomaiDham Official Bot • Render Cloud Engine
    </div>
  </div>
</body>
</html>`);
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 HTTP Web / Ping server listening on 0.0.0.0:${port}`);
    logger.info(`🩺 Health check available at: /ping`);
  });

  return server;
}

async function main(): Promise<void> {
  console.log('\n======================================================');
  console.log('       🌺 MomaiDham Automation System 🌺              ');
  console.log('   WhatsApp Group Image ➔ Instagram Reels Publisher   ');
  console.log('======================================================\n');

  // 1. Auto-restore sessions if on a fresh cloud container
  ensureSessionsRestored();

  // 2. Ensure required directories exist
  ensureDirectories([
    config.tempDir,
    config.tempImagesDir,
    config.tempVideosDir,
    config.musicDir,
    config.waSessionDir
  ]);

  logger.info(`Operating Mode: ${config.enableAutoUpload ? '🚀 LIVE (Uploads to Instagram)' : '🧪 TEST (Local Reel Generation Only)'}`);
  
  if (!config.targetGroupJid) {
    logger.error('❌ FATAL: TARGET_WHATSAPP_GROUP_JID is missing in .env! Bot will not start to prevent processing non-target groups.');
    process.exit(1);
  }
  logger.info(`🎯 Target WhatsApp Group: ${config.targetGroupJid}`);
  logger.info(`⏰ Daily Darshan Window: ${config.darshanStartHour}:00 AM - ${config.darshanEndHour}:00 PM (Only morning images will be posted)`);
  logger.info(`Reel Duration: ${config.reelDuration} seconds`);
  logger.info(`Video Canvas: ${config.videoWidth}x${config.videoHeight} (9:16 vertical)`);
  logger.info(`Music Directory: ${config.musicDir}`);

  // 3. Start HTTP Ping server immediately so Render detects port binding
  startHealthServer();

  // 4. Start WhatsApp Listener
  waClient = new WhatsAppClient();
  await waClient.start();

  // Handle graceful shutdown (releases WhatsApp socket before container termination)
  const handleExit = async () => {
    logger.info('Shutting down gracefully...');
    if (waClient) {
      await waClient.stop();
    }
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

main().catch((err: unknown) => {
  logger.error('Fatal initialization error:', err);
  process.exit(1);
});
