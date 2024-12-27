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
    const tesseractResult = await Tesseract.recognize(imagePath, config) as { text: string, confidence: number };

    // If Tesseract confidence is high enough, return its result
    if (tesseractResult && tesseractResult.confidence > 80) {
      Logger.info("Tesseract OCR completed successfully", {
        confidence: tesseractResult.confidence
      });

      return {
        text: tesseractResult.text,
        confidence: tesseractResult.confidence
      };
    }

    // If Tesseract confidence is low, use OpenAI's vision model as backup
    Logger.info("Tesseract confidence low, falling back to OpenAI Vision", {
      confidence: tesseractResult?.confidence
    });

    const imageBase64 = await fs.readFile(imagePath, { encoding: 'base64' });

    const visionResult = await openai.chat.completions.create({
      model: "gpt-4-vision-preview", // Using the correct model name
      messages: [
        {
          role: "system",
          content: "You are a handwriting recognition expert. Extract and return the text from this handwritten note, preserving the structure and formatting. Focus only on the text content."
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ],
        }
      ],
      max_tokens: 1000,
    });

    const extractedText = visionResult.choices[0].message.content || '';

    Logger.info("OpenAI Vision OCR completed successfully");

    return {
      text: extractedText,
      confidence: 95 // OpenAI typically has high confidence for handwriting
    };

  } catch (error) {
    Logger.error("Error in OCR processing:", error as Error);
    throw new Error("Failed to process image with OCR");
  }
}