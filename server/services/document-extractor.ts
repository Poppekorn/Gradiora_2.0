import { spawn } from 'child_process';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger from "../utils/logger";
import { sanitizeContent, validateContentSafety } from "./sanitization";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runPythonProcessor(filePath: string, options: { summarize?: boolean; educationLevel?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(__dirname, 'python', 'processor.py'),
      filePath
    ];

    if (options.summarize) {
      args.push('--summarize');
      if (options.educationLevel) {
        args.push(options.educationLevel);
      }
    }

    Logger.info("[PythonProcessor] Starting Python process", {
      script: args[0],
      filePath,
      options
    });

    const pythonProcess = spawn('python3', args);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      Logger.error("[PythonProcessor] Error from Python process", {
        error: data.toString()
      });
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        Logger.error("[PythonProcessor] Process failed", {
          code,
          error: errorOutput
        });
        reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        if (result.error) {
          Logger.error("[PythonProcessor] Processing error", {
            error: result.error
          });
          reject(new Error(result.error));
          return;
        }

        Logger.info("[PythonProcessor] Processing completed successfully");
        resolve(result.text);
      } catch (error) {
        Logger.error("[PythonProcessor] Failed to parse Python output", {
          error: error instanceof Error ? error.message : String(error),
          output
        });
        reject(new Error('Failed to parse Python output'));
      }
    });
  });
}

export async function extractTextFromDocument(filePath: string): Promise<string> {
  try {
    Logger.info("[TextExtraction] Starting document processing", { filePath });

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    // Extract text using Python implementation
    const extractedText = await runPythonProcessor(filePath);

    if (!extractedText || extractedText.trim().length < 10) {
      Logger.warn("[TextExtraction] Extracted text is too short or empty", { 
        textLength: extractedText ? extractedText.length : 0 
      });
      throw new Error("No valid text content extracted from document");
    }

    // Validate content safety
    if (!validateContentSafety(extractedText)) {
      throw new Error("Content failed safety validation");
    }

    // Sanitize the extracted text
    const sanitizedText = sanitizeContent(extractedText, {
      normalizeWhitespace: true,
      removeControlChars: true,
      maxLength: 1000000 // 1MB text limit
    });

    Logger.info("[TextExtraction] Document processing completed", {
      textLength: sanitizedText.length
    });

    return sanitizedText;
  } catch (error) {
    Logger.error("[TextExtraction] Fatal error in text extraction", { 
      error: error instanceof Error ? error.message : String(error),
      filePath 
    });
    throw error;
  }
}

export async function validateDocument(filePath: string): Promise<boolean> {
  try {
    Logger.info("[Validation] Starting document validation", { filePath });

    const stats = await fs.promises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    if (fileSizeInMB > 50) {
      Logger.warn("[Validation] File size exceeds limit", { 
        fileSizeInMB 
      });
      throw new Error("File too large. Maximum size is 50MB.");
    }

    const extension = path.extname(filePath).toLowerCase();
    const supportedTypes = ['.doc', '.docx', '.pdf', '.txt', '.md'];

    if (!supportedTypes.includes(extension)) {
      Logger.warn("[Validation] Unsupported file type", { 
        extension,
        supportedTypes 
      });
      throw new Error(`Unsupported file type. Supported types are: ${supportedTypes.join(', ')}`);
    }

    Logger.info("[Validation] Document validation successful", {
      filePath,
      extension,
      fileSizeInMB
    });

    return true;
  } catch (error) {
    Logger.error("[Validation] Document validation failed", { 
      error: error instanceof Error ? error.message : String(error),
      filePath 
    });
    throw error;
  }
}