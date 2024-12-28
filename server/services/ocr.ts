import Tesseract from "node-tesseract-ocr";
import fs from "fs/promises";
import path from "path";

const config = {
  lang: "eng",
  oem: 3,
  psm: 6,
};

async function performOCR(imagePath) {
  try {
    console.log("Starting OCR processing:", imagePath);

    // Verify file existence
    const exists = await fs.access(imagePath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Perform OCR with Tesseract
    const tesseractText = await Tesseract.recognize(imagePath, config);
    if (tesseractText.trim().length > 0) {
      console.log("Tesseract OCR Success:", tesseractText.length, "characters extracted.");
      return { text: tesseractText, confidence: 85 };
    }

    console.log("Tesseract OCR failed. No text extracted.");
    throw new Error("Fallback to OpenAI Vision required.");
  } catch (error) {
    console.error("Error in OCR processing:", error.message);
    throw error;
  }
}

// Example usage
(async () => {
  const imagePath = path.resolve("path/to/your/image.png");
  try {
    const result = await performOCR(imagePath);
    console.log("Extracted Text:", result.text);
  } catch (err) {
    console.error("OCR Process failed:", err.message);
  }
})();
