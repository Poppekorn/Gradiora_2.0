import { spawn } from 'child_process';
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";
import Logger from "../utils/logger";
import { sanitizeContent, validateContentSafety } from "./sanitization";

function runPythonExtractor(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'python', 'document_processor.py'),
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        Logger.error("[TextExtraction] Python process error", {
          code,
          error: errorOutput
        });
        reject(new Error(`Python process failed: ${errorOutput}`));
        return;
      }

      try {
        const result = JSON.parse(output);
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result.text);
      } catch (error) {
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
    const extractedText = await runPythonExtractor(filePath);

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