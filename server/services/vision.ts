import OpenAI from "openai";
import fs from "fs/promises";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export async function extractTextFromImage(imagePath: string): Promise<{ 
  text: string; 
  confidence: number;
}> {
  try {
    // Read and convert image to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Provide a confidence score between 0-100 based on image quality and text clarity. Return in JSON format with 'text' and 'confidence' fields."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      text: result.text || "",
      confidence: Math.min(100, Math.max(0, result.confidence))
    };
  } catch (error) {
    console.error("OpenAI Vision API error:", error);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

export async function analyzeImageContent(imagePath: string): Promise<{
  summary: string;
  explanation: string;
}> {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and provide: 1) A concise summary of the main content 2) A detailed explanation of the concepts shown. Return in JSON format with 'summary' and 'explanation' fields."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      summary: result.summary || "No summary available",
      explanation: result.explanation || "No explanation available"
    };
  } catch (error) {
    console.error("OpenAI Vision API error:", error);
    throw new Error(`Failed to analyze image content: ${error.message}`);
  }
}
