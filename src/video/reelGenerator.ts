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

    // 2. Audio input (if available)
    if (audioTrack) {
      const audioInputOpts: string[] = ['-stream_loop -1'];
      if (options.audioStartTime && options.audioStartTime > 0) {
        audioInputOpts.unshift(`-ss ${options.audioStartTime}`);
      }
      command
        .input(audioTrack)
        .inputOptions(audioInputOpts);
    }

    // 3. Complex filter:
    // If the image is already framed with the official template (1080x1920), render it directly without blur!
    // Otherwise, use split + boxblur background.
    const isFramedTemplate = path.basename(imagePath).toLowerCase().includes('framed');
    const filterParts = isFramedTemplate
      ? [`[0:v]scale=${width}:${height}[outv]`]
      : [
          `[0:v]split=2[bg_raw][fg_raw]`,
          `[bg_raw]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=25:5,colorchannelmixer=aa=1:rr=0.75:gg=0.75:bb=0.75[bg]`,
          `[fg_raw]scale=w=1040:h=1480:force_original_aspect_ratio=decrease[fg]`,
          `[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]`
        ];

    command.complexFilter(filterParts);

    // Output video & audio mapping (Optimized for low-RAM cloud instances like Render 512MB)
    const outputOptions = [
      '-map [outv]',
      '-c:v libx264',
      '-preset veryfast',
      '-threads 2',
      '-crf 22',
      '-pix_fmt yuv420p',
      '-r 30',
      `-t ${duration}`,
      '-maxrate 4M',
      '-bufsize 2M',
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

    (command as any)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('start', () => {
        logger.info(`FFmpeg process started`);
      })
      .on('progress', (progress: { percent?: number }) => {
        if (progress.percent) {
          logger.info(`Rendering progress: ${Math.round(progress.percent)}%`);
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
