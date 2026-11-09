/**
 * scripts/test-pipeline.js
 * Run: npm run test:pipeline [optional_image_path]
 *
 * Runs an end-to-end dry-run test of the image -> reel -> caption -> IG upload pipeline.
 */

import path from 'path';
import fs from 'fs';
import config from '../config/env';
import { ensureDirectories } from '../src/utils/cleanup';
import { generateReelFromImage } from '../src/video/reelGenerator';
import { generateReelCaption } from '../config/captions';
import { uploadReel } from '../src/instagram/uploader';
import Logger from '../src/utils/logger';

const logger = Logger.forModule('TestPipeline');

async function run(): Promise<void> {
  ensureDirectories([
    config.tempDir,
    config.tempImagesDir,
    config.tempVideosDir,
    config.musicDir
  ]);

  let imagePath = process.argv[2];

  if (!imagePath || !fs.existsSync(imagePath)) {
    imagePath = path.join(config.tempImagesDir, 'sample_test.jpg');
    if (!fs.existsSync(imagePath)) {
      logger.info('Please run "npm run test:video" first or supply an image path.');
      process.exit(1);
    }
  }

  logger.info(`Starting dry run test for image: ${imagePath}`);

  // 1. Generate Reel
  const videoPath = await generateReelFromImage(imagePath);

  // 2. Generate Caption in Gujarati
  const caption = generateReelCaption({ customText: 'આજના મંગળા દર્શન' });
  logger.info(`Generated Caption:\n-------------------------\n${caption}\n-------------------------`);

  // 3. Instagram Upload
  logger.info(`Instagram Auto-Upload enabled: ${config.enableAutoUpload}`);
  const uploadResult = await uploadReel(videoPath, caption);

  logger.success(`Pipeline Test Completed! Result: ${JSON.stringify(uploadResult)}`);
}

run().catch((err: unknown) => {
  logger.error('Pipeline test failed:', err);
  process.exit(1);
});
