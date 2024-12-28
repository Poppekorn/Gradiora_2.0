import { spawn } from 'child_process';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger from "../utils/logger";
import { sanitizeContent, validateContentSafety } from "./sanitization";
import { extractTextFromImage, analyzeImageContent } from "./vision";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const rootDir = dirname(dirname(currentDir));

interface DocumentSection {
  type: 'heading1' | 'heading2' | 'paragraph' | 'image' | 'list';
  content: string;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ProcessedDocument {
  type: 'doc' | 'docx' | 'pdf' | 'text' | 'image';
  content: {
    text?: string;
    pages?: string[];
    method?: string;
    extracted_text?: string;
    ocr_confidence?: number;
    summary?: string;
    explanation?: string;
    layout?: DocumentSection[]; 
  };
}

async function processImageWithVision(filePath: string): Promise<ProcessedDocument> {
  try {
    Logger.info("[ImageProcessor] Starting OpenAI Vision processing", { filePath });

    const [textResult, analysisResult] = await Promise.all([
      extractTextFromImage(filePath),
      analyzeImageContent(filePath)
    ]);

    Logger.info("[ImageProcessor] Vision API processing completed", {
      hasText: Boolean(textResult.text),
      confidence: textResult.confidence,
      hasSummary: Boolean(analysisResult.summary)
    });

    return {
      type: 'image',
      content: {
        extracted_text: textResult.text,
        ocr_confidence: textResult.confidence,
        summary: analysisResult.summary,
        explanation: analysisResult.explanation
      }
    };
  } catch (error) {
    Logger.error("[ImageProcessor] Vision API processing failed", { 
      error: error instanceof Error ? error.message : String(error),
      filePath
    });
    throw error;
  }
}

async function runPythonProcessor(filePath: string): Promise<ProcessedDocument> {
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
      Logger.debug("[DocumentProcessor] Python stdout:", { output: chunk });
      output += chunk;
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      Logger.debug("[DocumentProcessor] Python stderr:", { error: chunk });
      errorOutput += chunk;
    });

    pythonProcess.on('close', (code) => {
      Logger.info("[DocumentProcessor] Python process completed", { 
        code,
        hasOutput: Boolean(output.trim()),
        hasError: Boolean(errorOutput.trim())
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
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);

        if (result.error) {
          Logger.error("[DocumentProcessor] Processing error", {
            error: result.error,
            debug: errorOutput
          });
          reject(new Error(result.error));
          return;
        }

        Logger.info("[DocumentProcessor] Processing completed successfully", {
          documentType: result.type,
          contentLength: result.content?.text?.length ?? result.content?.pages?.join('\n').length ?? 0
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

async function analyzeDocumentLayout(text: string, isImage: boolean = false): Promise<DocumentSection[]> {
  try {
    Logger.info("[LayoutAnalysis] Starting document layout analysis");

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "user",
          content: `Analyze this document content and identify its structure. Break it down into sections (heading1, heading2, paragraph, list) with their content. Return in JSON format as an array of sections. Each section should have 'type' and 'content' fields.\n\n${text}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);

    Logger.info("[LayoutAnalysis] Layout analysis completed", {
      sectionCount: result.sections?.length || 0
    });

    return result.sections || [];
  } catch (error) {
    Logger.error("[LayoutAnalysis] Layout analysis failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

export async function extractTextFromDocument(filePath: string): Promise<string> {
  try {
    Logger.info("[TextExtraction] Starting document processing", { filePath });

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    const extension = path.extname(filePath).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);

    let processedDoc: ProcessedDocument;
    if (isImage) {
      processedDoc = await processImageWithVision(filePath);
    } else {
      processedDoc = await runPythonProcessor(filePath);
    }

    let extractedText = '';

    if (processedDoc.type === 'doc' || processedDoc.type === 'docx' || processedDoc.type === 'text') {
      extractedText = processedDoc.content.text || '';
    } else if (processedDoc.type === 'pdf') {
      extractedText = (processedDoc.content.pages || []).join('\n\n');
    } else if (processedDoc.type === 'image') {
      extractedText = processedDoc.content.extracted_text || '';
      if (processedDoc.content.summary) {
        extractedText += `\n\nSummary:\n${processedDoc.content.summary}`;
      }
      if (processedDoc.content.explanation) {
        extractedText += `\n\nDetailed Explanation:\n${processedDoc.content.explanation}`;
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      Logger.warn("[TextExtraction] Extracted text is empty", {
        documentType: processedDoc.type
      });
      throw new Error("No valid text content extracted from document");
    }

    if (!validateContentSafety(extractedText, isImage)) {
      throw new Error("Content failed safety validation");
    }

    const sanitizedText = sanitizeContent(extractedText, {
      normalizeWhitespace: true,
      removeControlChars: true,
      maxLength: 1000000, 
      isImageContent: isImage
    });

    const layout = await analyzeDocumentLayout(sanitizedText, isImage);

    if (processedDoc && layout.length > 0) {
      processedDoc.content.layout = layout;
    }

    Logger.info("[TextExtraction] Document processing completed", {
      textLength: sanitizedText.length,
      documentType: processedDoc.type,
      isImage
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
    const supportedTypes = [
      '.doc', '.docx', '.pdf', '.txt', '.md',
      '.jpg', '.jpeg', '.png', '.webp'
    ];

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