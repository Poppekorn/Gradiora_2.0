import { spawn } from 'child_process';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger from "../utils/logger";
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const rootDir = dirname(dirname(currentDir));

// Create thumbnails directory if it doesn't exist
const thumbnailsDir = path.join(rootDir, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

interface ThumbnailOptions {
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  quality?: number;
}

const defaultOptions: ThumbnailOptions = {
  width: 200,
  height: 280,
  format: 'jpeg',
  quality: 80
};

async function generatePdfThumbnail(
  pdfPath: string,
  outputPath: string,
  options: ThumbnailOptions = defaultOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(rootDir, 'server', 'services', 'python', 'pdf_thumbnail.py');
    
    Logger.info("[Thumbnails] Starting PDF thumbnail generation", {
      inputPath: pdfPath,
      outputPath
    });

    const pythonProcess = spawn('python3', [
      pythonScript,
      pdfPath,
      outputPath,
      String(options.width),
      String(options.height)
    ]);

    let errorOutput = '';

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        Logger.error("[Thumbnails] PDF thumbnail generation failed", {
          code,
          error: errorOutput
        });
        reject(new Error(`Failed to generate PDF thumbnail: ${errorOutput}`));
        return;
      }

      Logger.info("[Thumbnails] PDF thumbnail generated successfully");
      resolve(outputPath);
    });
  });
}

async function generateDocThumbnail(
  docPath: string,
  outputPath: string,
  options: ThumbnailOptions = defaultOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(rootDir, 'server', 'services', 'python', 'doc_thumbnail.py');
    
    Logger.info("[Thumbnails] Starting DOC thumbnail generation", {
      inputPath: docPath,
      outputPath
    });

    const pythonProcess = spawn('python3', [
      pythonScript,
      docPath,
      outputPath,
      String(options.width),
      String(options.height)
    ]);

    let errorOutput = '';

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        Logger.error("[Thumbnails] DOC thumbnail generation failed", {
          code,
          error: errorOutput
        });
        reject(new Error(`Failed to generate DOC thumbnail: ${errorOutput}`));
        return;
      }

      Logger.info("[Thumbnails] DOC thumbnail generated successfully");
      resolve(outputPath);
    });
  });
}

export async function generateThumbnail(
  filePath: string,
  options: ThumbnailOptions = defaultOptions
): Promise<string> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);
    const thumbnailName = `${fileName}_thumb.${options.format || defaultOptions.format}`;
    const outputPath = path.join(thumbnailsDir, thumbnailName);

    Logger.info("[Thumbnails] Starting thumbnail generation", {
      filePath,
      outputPath,
      options
    });

    if (ext === '.pdf') {
      return await generatePdfThumbnail(filePath, outputPath, options);
    } else if (ext === '.doc' || ext === '.docx') {
      return await generateDocThumbnail(filePath, outputPath, options);
    } else if (ext === '.txt' || ext === '.md') {
      // For text files, create a simple text-based thumbnail
      const text = await fs.promises.readFile(filePath, 'utf-8');
      const preview = text.slice(0, 200); // First 200 characters

      // Create a simple image with text preview
      await sharp({
        create: {
          width: options.width || defaultOptions.width,
          height: options.height || defaultOptions.height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
      .composite([{
        input: Buffer.from(`<svg width="${options.width}" height="${options.height}">
          <text x="10" y="20" font-family="Arial" font-size="12" fill="black">
            ${preview.replace(/[<>]/g, '')}
          </text>
        </svg>`),
        top: 0,
        left: 0
      }])
      .toFormat(options.format || defaultOptions.format, {
        quality: options.quality || defaultOptions.quality
      })
      .toFile(outputPath);

      return outputPath;
    }

    throw new Error(`Unsupported file type for thumbnail generation: ${ext}`);
  } catch (error) {
    Logger.error("[Thumbnails] Thumbnail generation failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
