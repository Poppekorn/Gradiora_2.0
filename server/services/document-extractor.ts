import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";
import Logger from "../utils/logger";

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
          const result = await mammoth.extractRawText({ path: filePath });
          text = result.value;
          Logger.info("[TextExtraction] Word document processed", { 
            textLength: text.length,
            messages: result.messages 
          });
        } catch (error) {
          Logger.error("[TextExtraction] Error processing Word document", { error });
          // Fallback for older .doc files
          text = await fs.promises.readFile(filePath, 'utf8');
          Logger.info("[TextExtraction] Fallback text extraction completed", { 
            textLength: text.length 
          });
        }
        break;

      case '.pdf':
        try {
          Logger.info("[TextExtraction] Processing PDF document");
          const pdfBytes = await fs.promises.readFile(filePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pages = pdfDoc.getPages();

          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const content = await page.getTextContent(); //Corrected PDF text extraction
            const pageText = content.items.map(item => item.str).join(' ');
            text += pageText + '\n';
            Logger.info("[TextExtraction] PDF page processed", { 
              pageNumber: i + 1,
              pageTextLength: pageText.length 
            });
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

    if (!text || text.length < 10) {
      Logger.warn("[TextExtraction] Extracted text is too short", { 
        textLength: text.length 
      });
      throw new Error("No valid text content extracted from document");
    }

    Logger.info("[TextExtraction] Document processing completed", {
      fileType: extension,
      textLength: text.length
    });

    return text;
  } catch (error) {
    Logger.error("[TextExtraction] Fatal error in text extraction", { 
      error,
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
      error,
      filePath 
    });
    throw error;
  }
}