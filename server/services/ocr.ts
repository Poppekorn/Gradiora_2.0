import Tesseract from 'node-tesseract-ocr';
import Logger from "../utils/logger";
import path from "path";
import { openai } from "./openai";
import fs from "fs/promises";

// Configure Tesseract options
const config = {
  lang: "eng", // Default to English
  oem: 3,      // Default OCR Engine Mode
  psm: 6,      // Assume uniform text block
};

interface OCRResult {
  text: string;
  confidence: number;
}

export async function performOCR(imagePath: string): Promise<OCRResult> {
  try {
    Logger.info("Starting OCR processing", { imagePath });

    // First try Tesseract OCR
    const tesseractText = await Tesseract.recognize(imagePath, config);
    const tesseractResult = {
      text: tesseractText as string,
      confidence: 85 // Default confidence for successful Tesseract recognition
    };

    // If Tesseract extracts meaningful text, return its result
    if (tesseractResult.text.trim().length > 0) {
      Logger.info("Tesseract OCR completed successfully", {
        confidence: tesseractResult.confidence,
        textLength: tesseractResult.text.length
      });

      return tesseractResult;
    }

    // If Tesseract fails, use OpenAI's vision capabilities
    Logger.info("Tesseract extraction failed, falling back to OpenAI Vision");

    const imageBase64 = await fs.readFile(imagePath, { encoding: 'base64' });
    const contentType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

    const visionResult = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Please extract and transcribe any text from this image, preserving the structure and formatting. Focus only on the text content."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${contentType};base64,${imageBase64}`
              }
            }
          ],
        }
      ],
      max_tokens: 1000,
    });

    const extractedText = visionResult.choices[0].message.content || '';

    Logger.info("OpenAI Vision OCR completed successfully", {
      textLength: extractedText.length
    });

    return {
      text: extractedText,
      confidence: 90 // OpenAI typically has high confidence
    };

  } catch (error) {
    Logger.error("Error in OCR processing:", error as Error);
    throw new Error(`Failed to process image with OCR: ${(error as Error).message}`);
  }
}