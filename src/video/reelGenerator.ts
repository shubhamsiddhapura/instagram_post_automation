import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import config from '../../config/env';
import Logger from '../utils/logger';

// @ts-ignore
import ffmpegStatic from 'ffmpeg-static';

const logger = Logger.forModule('ReelGenerator');

// Set ffmpeg path using ffmpeg-static if available
if (ffmpegStatic && typeof ffmpegStatic === 'string') {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface ReelOptions {
  outputPath?: string;
  duration?: number;
  audioPath?: string;
  audioStartTime?: number;
}

/**
 * Returns a random MP3 file path from the music directory.
 */
export function getRandomAudioTrack(): string | null {
  const musicDir = config.musicDir;
  if (!fs.existsSync(musicDir)) {
    return null;
  }

  const files = fs.readdirSync(musicDir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.mp3' || ext === '.m4a' || ext === '.wav' || ext === '.mp4';
  });

  if (files.length === 0) {
    return null;
  }

  const selected = files[Math.floor(Math.random() * files.length)];
  return path.join(musicDir, selected);
}

/**
 * Converts a static image and background music into a professional 9:16 Instagram Reel.
 */
export function generateReelFromImage(imagePath: string, options: ReelOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(imagePath)) {
      return reject(new Error(`Input image file not found: ${imagePath}`));
    }

    const duration = options.duration || config.reelDuration || 15;
    const width = config.videoWidth || 1080;
    const height = config.videoHeight || 1920;

    // Destination file
    const outputFilename = `reel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp4`;
    const outputPath = options.outputPath || path.join(config.tempVideosDir, outputFilename);

    // Audio file
    const audioTrack = options.audioPath || getRandomAudioTrack();

    logger.info(`🎬 Generating ${duration}s Reel for image: ${path.basename(imagePath)}`);
    if (audioTrack) {
      logger.info(`🎵 Audio track selected: ${path.basename(audioTrack)}`);
    } else {
      logger.warn(`⚠️ No audio files found in ${config.musicDir}. Video will be created without audio.`);
    }

    const command = ffmpeg();

    // 1. Loop image input as video stream
    command
      .input(imagePath)
      .inputOptions([
        '-loop 1',
        `-t ${duration}`
      ]);

    // 2. Audio input (if available) - read exact duration to avoid infinite stream loop memory bloat
    if (audioTrack) {
      const audioInputOpts: string[] = [`-t ${duration}`];
      if (options.audioStartTime && options.audioStartTime > 0) {
        audioInputOpts.unshift(`-ss ${options.audioStartTime}`);
      }
      command
        .input(audioTrack)
        .inputOptions(audioInputOpts);
    }

    // 3. Ultra-low-memory filter graph:
    // If framed with official template (1080x1920), render directly.
    // If raw fallback, letterbox cleanly with dark background (ZERO cpu/memory overhead vs heavy boxblur)
    const isFramedTemplate = path.basename(imagePath).toLowerCase().includes('framed');
    const filterParts = isFramedTemplate
      ? [`[0:v]scale=${width}:${height}[outv]`]
      : [`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0a[outv]`];

    command.complexFilter(filterParts);

    // Output video & audio mapping (Optimized strictly for 512MB RAM cloud tiers)
    const outputOptions = [
      '-map [outv]',
      '-c:v libx264',
      '-preset ultrafast',
      '-tune stillimage',
      '-threads 1',
      '-crf 23',
      '-pix_fmt yuv420p',
      '-r 30',
      `-t ${duration}`,
      '-maxrate 2M',
      '-bufsize 1M',
      '-movflags +faststart'
    ];

    // Audio filter & encoding
    if (audioTrack) {
      const fadeStart = Math.max(0, duration - 1.5);
      outputOptions.push(
        '-map 1:a',
        '-c:a aac',
        '-b:a 192k',
        `-af afade=t=out:st=${fadeStart}:d=1.5`,
        '-shortest'
      );
    }

    let lastLoggedSec = -1;
    (command as any)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('start', () => {
        logger.info(`FFmpeg process started`);
      })
      .on('progress', (progress: { percent?: number; timemark?: string }) => {
        if (progress.timemark) {
          const parts = progress.timemark.split(':');
          const totalSec = parseInt(parts[0] || '0', 10) * 3600 + parseInt(parts[1] || '0', 10) * 60 + parseFloat(parts[2] || '0');
          if (totalSec - lastLoggedSec >= 3 || totalSec >= duration) {
            lastLoggedSec = totalSec;
            const pct = Math.min(100, Math.round((totalSec / duration) * 100));
            logger.info(`Rendering progress: ${pct}% (${progress.timemark} / ${duration}s)`);
          }
        }
      })
      .on('end', () => {
        logger.success(`🎉 Reel generated successfully: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: Error, stdout?: string, stderr?: string) => {
        logger.error(`FFmpeg error: ${err.message}`);
        if (stderr) {
          logger.error(`FFmpeg stderr:\n${stderr}`);
        }
        reject(err);
      });

    command.run();
  });
}
