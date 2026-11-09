/**
 * src/video/imageFramer.ts
 *
 * Typescript wrapper for image_framer.py.
 * Automatically frames raw WhatsApp darshan photos into the official Shree MomaiDham branded template.
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import Logger from '../utils/logger';

const logger = Logger.forModule('ImageFramer');

export async function frameDarshanImage(
  inputImagePath: string,
  outputImagePath?: string
): Promise<string> {
  const templatePath = path.resolve(process.cwd(), 'assets/template.png');

  // If no template file exists, return the input image unmodified
  if (!fs.existsSync(templatePath)) {
    logger.warn('⚠️ assets/template.png not found. Using raw image.');
    return inputImagePath;
  }

  const outPath =
    outputImagePath ||
    path.resolve(process.cwd(), `temp/images/framed_${Date.now()}_${path.basename(inputImagePath, path.extname(inputImagePath))}.jpg`);

  return new Promise((resolve) => {
    logger.info(`🖼️ Framing darshan photo into Shree MomaiDham template...`);

    const localScript = path.resolve(__dirname, 'image_framer.py');
    const pythonScript = fs.existsSync(localScript) ? localScript : path.resolve(process.cwd(), 'src', 'video', 'image_framer.py');
    const args = [
      pythonScript,
      '--input', inputImagePath,
      '--template', templatePath,
      '--output', outPath
    ];

    const pyProcess = spawn('python', args, {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let stderr = '';

    pyProcess.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    pyProcess.on('close', (code: number | null) => {
      if (code === 0 && fs.existsSync(outPath)) {
        logger.success(`🎉 Framed image created successfully: ${path.basename(outPath)}`);
        resolve(outPath);
      } else {
        logger.warn(`Could not frame image with template (${stderr}). Falling back to original image.`);
        resolve(inputImagePath);
      }
    });
  });
}
