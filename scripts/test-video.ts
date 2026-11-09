/**
 * scripts/test-video.ts
 * Run: npm run test:video [optional_image_path]
 *
 * Tests the FFmpeg 9:16 vertical Reel generator without needing WhatsApp or Instagram.
 */

import fs from 'fs';
import path from 'path';
import config from '../config/env';
import { ensureDirectories } from '../src/utils/cleanup';
import { generateReelFromImage } from '../src/video/reelGenerator';
import Logger from '../src/utils/logger';
import { execSync } from 'child_process';

// @ts-ignore
import ffmpegStatic from 'ffmpeg-static';

const logger = Logger.forModule('TestVideo');

let ffmpegPath = 'ffmpeg';
if (ffmpegStatic && typeof ffmpegStatic === 'string') {
  ffmpegPath = `"${ffmpegStatic}"`;
}

async function run(): Promise<void> {
  ensureDirectories([
    config.tempDir,
    config.tempImagesDir,
    config.tempVideosDir,
    config.musicDir
  ]);

  let imagePath = process.argv[2];

  // If no image is provided, create a test image using ffmpeg lavfi
  if (!imagePath || !fs.existsSync(imagePath)) {
    imagePath = path.join(config.tempImagesDir, 'sample_test.jpg');
    if (!fs.existsSync(imagePath)) {
      logger.info('Generating sample test photo using FFmpeg...');
      try {
        execSync(`${ffmpegPath} -y -f lavfi -i "color=c=0x1E3A8A:s=1080x1080,drawtext=text='Momai Dham Test':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -vframes 1 "${imagePath}"`, { stdio: 'ignore' });
      } catch {
        // Fallback simple solid color without text
        execSync(`${ffmpegPath} -y -f lavfi -i "color=c=0x8B5CF6:s=1080x1080" -vframes 1 "${imagePath}"`, { stdio: 'ignore' });
      }
    }
  }

  logger.info(`Testing Reel generation with image: ${imagePath}`);

  const outputVideo = path.join(config.tempVideosDir, `test_reel_${Date.now()}.mp4`);
  const result = await generateReelFromImage(imagePath, {
    outputPath: outputVideo,
    duration: config.reelDuration || 15
  });

  logger.success(`======================================================`);
  logger.success(`🎉 Test Reel Generated Successfully!`);
  logger.success(`📁 File location: ${result}`);
  logger.success(`You can open and play this MP4 video on your computer!`);
  logger.success(`======================================================`);
}

run().catch((err: unknown) => {
  logger.error('Test video generation failed:', err);
  process.exit(1);
});
