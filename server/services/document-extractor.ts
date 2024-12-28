import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";
import Logger from "../utils/logger";

export async function extractTextFromDocument(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    const extension = path.extname(filePath).toLowerCase();
    
    // Handle different file types
    switch (extension) {
      case '.docx':
      case '.doc':
        try {
          const result = await mammoth.extractRawText({ path: filePath });
          Logger.info("Word document extracted successfully", {
            textLength: result.value.length
          });
          return result.value;
        } catch (error) {
          Logger.error("Error extracting Word document:", error);
          // Fallback for older .doc files
          const content = await fs.promises.readFile(filePath, 'utf8');
          return content;
        }

      case '.pdf':
        try {
          const pdfBytes = await fs.promises.readFile(filePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pages = pdfDoc.getPages();
          let text = '';
          
          for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const content = await page.doc.getForm().getFields();
            text += content.map(field => field.getText()).join(' ') + '\n';
          }
          
          Logger.info("PDF extracted successfully", {
            pages: pages.length,
            textLength: text.length
          });
          
          return text;
        } catch (error) {
          Logger.error("Error extracting PDF:", error);
          throw new Error("Failed to extract text from PDF");
        }

      case '.txt':
      case '.md':
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          Logger.info("Text file read successfully", {
            textLength: content.length
          });
          return content;
        } catch (error) {
          Logger.error("Error reading text file:", error);
          throw new Error("Failed to read text file");
        }

      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  } catch (error) {
    Logger.error("Error in text extraction:", error);
    throw error;
  }
}

export async function validateDocument(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (fileSizeInMB > 50) { // 50MB limit
      throw new Error("File too large. Maximum size is 50MB.");
    }

    const extension = path.extname(filePath).toLowerCase();
    const supportedTypes = ['.doc', '.docx', '.pdf', '.txt', '.md'];
    
    if (!supportedTypes.includes(extension)) {
      throw new Error(`Unsupported file type. Supported types are: ${supportedTypes.join(', ')}`);
    }

    return true;
  } catch (error) {
    Logger.error("Document validation failed:", error);
    throw error;
  }
}
