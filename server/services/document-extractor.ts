import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";
import Logger from "../utils/logger";
import { sanitizeContent, validateContentSafety } from "./sanitization";

export async function extractTextFromDocument(filePath: string): Promise<string> {
  try {
    Logger.info("[TextExtraction] Starting document processing", { filePath });

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    const extension = path.extname(filePath).toLowerCase();
    let text = '';

    switch (extension) {
      case '.docx':
      case '.doc':
        try {
          Logger.info("[TextExtraction] Processing Word document", { extension });
          // Read the file as a buffer for binary files
          const buffer = await fs.promises.readFile(filePath);

          // Use mammoth for text extraction
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;

          // Validate extracted text
          if (!text || text.trim().length === 0) {
            throw new Error("No text content extracted");
          }

          // Initial safety check
          if (!validateContentSafety(text)) {
            throw new Error("Content failed safety validation");
          }

          Logger.info("[TextExtraction] Word document processed", { 
            textLength: text.length,
            messages: result.messages 
          });
        } catch (docError) {
          Logger.error("[TextExtraction] Error with primary extraction method", { docError });

          // Try alternative mammoth options for older doc files
          try {
            const buffer = await fs.promises.readFile(filePath);
            const result = await mammoth.extractRawText({
              buffer,
              options: {
                preserveEmptyParagraphs: true,
                includeDefaultStyleMap: true
              }
            });
            text = result.value;

            if (!text || text.trim().length === 0) {
              throw new Error("No text content extracted with fallback method");
            }

            if (!validateContentSafety(text)) {
              throw new Error("Fallback content failed safety validation");
            }

            Logger.info("[TextExtraction] Fallback extraction successful", {
              textLength: text.length
            });
          } catch (fallbackError) {
            Logger.error("[TextExtraction] Fallback extraction failed", { fallbackError });
            throw new Error("Failed to extract text from document file");
          }
        }
        break;

      case '.pdf':
        try {
          Logger.info("[TextExtraction] Processing PDF document");
          const pdfBytes = await fs.promises.readFile(filePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pages = pdfDoc.getPages();
          let pdfText = '';

          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const content = await page.getTextContent();
            const pageText = content.items
              .filter(item => typeof item.str === 'string' && item.str.trim().length > 0)
              .map(item => item.str.trim())
              .join(' ');

            if (pageText.length > 0 && validateContentSafety(pageText)) {
              pdfText += pageText + '\n\n';
            }

            Logger.info("[TextExtraction] PDF page processed", { 
              pageNumber: i + 1,
              pageTextLength: pageText.length 
            });
          }

          text = pdfText.trim();
          if (!text) {
            throw new Error("No text content extracted from PDF");
          }
        } catch (error) {
          Logger.error("[TextExtraction] Error processing PDF", { error });
          throw new Error("Failed to extract text from PDF");
        }
        break;

      case '.txt':
      case '.md':
        try {
          Logger.info("[TextExtraction] Processing text file");
          text = await fs.promises.readFile(filePath, 'utf8');

          // Validate text content
          if (!text || text.trim().length === 0) {
            throw new Error("Empty text file");
          }

          if (!validateContentSafety(text)) {
            throw new Error("Text content failed safety validation");
          }

          Logger.info("[TextExtraction] Text file processed", { 
            textLength: text.length 
          });
        } catch (error) {
          Logger.error("[TextExtraction] Error reading text file", { error });
          throw new Error("Failed to read text file");
        }
        break;

      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }

    // Final validation and sanitization
    if (!text || text.trim().length < 10) {
      Logger.warn("[TextExtraction] Extracted text is too short or empty", { 
        textLength: text ? text.length : 0 
      });
      throw new Error("No valid text content extracted from document");
    }

    // Sanitize the extracted text
    text = sanitizeContent(text, {
      normalizeWhitespace: true,
      removeControlChars: true,
      maxLength: 1000000 // 1MB text limit
    });

    Logger.info("[TextExtraction] Document processing completed", {
      fileType: extension,
      textLength: text.length
    });

    return text;
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