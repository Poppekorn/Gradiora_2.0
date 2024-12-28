import { spawn } from 'child_process';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger from "../utils/logger";
import { sanitizeContent, validateContentSafety } from "./sanitization";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const rootDir = dirname(dirname(currentDir));

interface DocumentMetadata {
  author?: string;
  created?: string;
  modified?: string;
  title?: string;
  subject?: string;
  keywords?: string;
  category?: string;
  comments?: string;
}

interface StyleInfo {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface ParagraphContent {
  type: 'paragraph';
  text: string;
  style: StyleInfo;
}

interface DocumentSection {
  heading: string;
  content: ParagraphContent[];
  level: number;
}

interface TableData {
  data: string[][];
  row_count: number;
  col_count: number;
}

interface DocumentContent {
  metadata: DocumentMetadata;
  sections: DocumentSection[];
  tables: TableData[];
  headers: string[][];
  footers: string[][];
}

interface ProcessedDocument {
  type: 'docx' | 'doc' | 'pdf' | 'text';
  content: DocumentContent | { text: string; messages?: string[] };
}

function runPythonProcessor(filePath: string): Promise<ProcessedDocument> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(rootDir, 'server', 'services', 'python', 'processor.py');

    Logger.info("[DocumentProcessor] Starting Python process", {
      script: pythonScript,
      filePath
    });

    const pythonProcess = spawn('python3', [pythonScript, filePath]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      Logger.info("[DocumentProcessor] Python stdout:", { output: chunk });
      output += chunk;
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      Logger.error("[DocumentProcessor] Python stderr:", { error: chunk });
      errorOutput += chunk;
    });

    pythonProcess.on('close', (code) => {
      Logger.info("[DocumentProcessor] Python process completed", { 
        code,
        output: output.trim(),
        error: errorOutput.trim()
      });

      if (code !== 0) {
        Logger.error("[DocumentProcessor] Process failed", {
          code,
          error: errorOutput
        });
        reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        // Try to parse only the last line as JSON (in case there's debug output before)
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);

        if (result.error) {
          Logger.error("[DocumentProcessor] Processing error", {
            error: result.error
          });
          reject(new Error(result.error));
          return;
        }

        Logger.info("[DocumentProcessor] Processing completed successfully", {
          documentType: result.type
        });
        resolve(result as ProcessedDocument);
      } catch (error) {
        Logger.error("[DocumentProcessor] Failed to parse Python output", {
          error: error instanceof Error ? error.message : String(error),
          rawOutput: output,
          lastLine: output.trim().split('\n').pop()
        });
        reject(new Error('Failed to parse Python output'));
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      Logger.error("[DocumentProcessor] Process error", {
        error: error.message,
        command: 'python3',
        args: [pythonScript, filePath]
      });
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

export async function extractTextFromDocument(filePath: string): Promise<string> {
  try {
    Logger.info("[TextExtraction] Starting document processing", { filePath });

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    // Process document using Python implementation
    const processedDoc = await runPythonProcessor(filePath);
    let extractedText = '';

    // Extract text based on document type
    if (processedDoc.type === 'docx' || processedDoc.type === 'doc') {
      extractedText = (processedDoc.content as { text: string }).text;
    } else if (processedDoc.type === 'pdf') {
      const content = processedDoc.content as { pages: string[] };
      extractedText = content.pages.join('\n\n');
    } else if (processedDoc.type === 'text') {
      extractedText = (processedDoc.content as { text: string }).text;
    }

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
      textLength: sanitizedText.length,
      documentType: processedDoc.type
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