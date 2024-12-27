import OpenAI from "openai";
import Logger from "../utils/logger";
import { db } from "@db";
import { apiQuota, fileSummaries } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { performOCR } from "./ocr";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

interface AnalysisResult {
  summary: string;
  explanation: string;
}

async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    Logger.info("Starting OCR text extraction", { imagePath });

    const ocrResult = await performOCR(imagePath);

    if (!ocrResult.text) {
      throw new Error("No text extracted from image");
    }

    Logger.info("OCR extraction completed", {
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length
    });

    return ocrResult.text;
  } catch (error) {
    Logger.error("Error extracting text from image:", error as Error);
    throw new Error("Failed to extract text from image");
  }
}

function chunkText(text: string, maxChunkSize: number = 3000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

async function manageQuota(userId: number, tokenCount: number) {
  const today = new Date();
  const resetDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  try {
    const [userQuota] = await db
      .select()
      .from(apiQuota)
      .where(eq(apiQuota.userId, userId))
      .limit(1);

    if (!userQuota || new Date(userQuota.resetAt) < today) {
      // Insert new quota or reset existing one
      const values = {
        userId,
        tokenCount,
        callCount: 1,
        quotaLimit: 100000,
        resetAt: resetDate,
        updatedAt: new Date(),
      };

      await db
        .insert(apiQuota)
        .values(values)
        .onConflictDoUpdate({
          target: apiQuota.userId,
          set: values,
        });
    } else {
      // Check if quota would be exceeded
      if (userQuota.tokenCount + tokenCount > userQuota.quotaLimit) {
        throw new Error("API quota exceeded");
      }

      // Update existing quota
      await db
        .update(apiQuota)
        .set({
          tokenCount: userQuota.tokenCount + tokenCount,
          callCount: userQuota.callCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(apiQuota.userId, userId));
    }
  } catch (error) {
    Logger.error("Error managing quota:", error as Error);
    throw error;
  }
}

export async function getQuotaInfo(userId: number) {
  try {
    const [quota] = await db
      .select()
      .from(apiQuota)
      .where(eq(apiQuota.userId, userId))
      .limit(1);

    if (!quota) {
      return {
        tokenCount: 0,
        callCount: 0,
        quotaLimit: 100000,
        resetAt: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1
        ),
      };
    }

    return quota;
  } catch (error) {
    Logger.error("Error fetching quota info:", error as Error);
    throw new Error("Failed to fetch quota information");
  }
}

async function processChunks(chunks: string[], userId: number, level: string): Promise<AnalysisResult> {
  const summaries = await Promise.all(chunks.map(async (chunk) => {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable content summarizer for ${level} students. Create a clear, focused summary of the content's key points and main ideas, followed by a detailed explanation. 

When summarizing:
1. Focus on the actual content and its meaning
2. Identify and highlight key information (e.g., pricing details, features, benefits)
3. Structure the information logically (e.g., group related items together)
4. Use clear, ${level}-appropriate language
5. If the content includes lists or plans, maintain their structure in the summary

Do not:
- Include any technical formatting details
- Mention document types or file formats
- Include metadata or structural elements
- Add information not present in the original content`
        },
        {
          role: "user",
          content: chunk
        }
      ],
      temperature: 0.3, // Lower temperature for more focused summaries
      max_tokens: 800
    });

    await manageQuota(userId, response.usage?.total_tokens || 0);

    const result = response.choices[0].message?.content;
    if (!result) {
      throw new Error("Empty response from OpenAI");
    }

    // Split response into summary and explanation
    const parts = result.split("\n\n");
    return {
      summary: parts[0] || '',
      explanation: parts.slice(1).join("\n\n") || ''
    };
  }));

  // Combine summaries intelligently
  const combinedSummary = summaries
    .map(s => s.summary)
    .join("\n")
    .trim();

  const combinedExplanation = summaries
    .map(s => s.explanation)
    .filter(exp => exp.length > 0)
    .join("\n\n")
    .trim();

  return {
    summary: combinedSummary,
    explanation: combinedExplanation
  };
}

export async function summarizeContent(content: string | Buffer, level: string = 'high_school', userId: number, fileId: number, mimeType?: string): Promise<AnalysisResult> {
  Logger.info("Starting content summarization", { level, mimeType });

  let textContent: string;

  try {
    if (typeof content === 'string') {
      textContent = content.trim();
    } else {
      // If it's an image file
      const uploadDir = path.join(process.cwd(), 'uploads');
      const tempImagePath = path.join(uploadDir, `temp_${fileId}.jpg`);
      await fs.writeFile(tempImagePath, content);

      textContent = await extractTextFromImage(tempImagePath);

      // Clean up temp file
      await fs.unlink(tempImagePath).catch(() => {});
    }

    if (!textContent) {
      throw new Error("Empty content provided for summarization");
    }

    const chunks = chunkText(textContent);
    Logger.info(`Content split into ${chunks.length} chunks`);

    const result = await processChunks(chunks, userId, level);

    // Store the summary in the database
    await db.insert(fileSummaries).values({
      fileId,
      summary: result.summary,
      explanation: result.explanation,
      educationLevel: level,
    });

    Logger.info("Summarization completed", {
      chunksProcessed: chunks.length,
      totalLength: result.summary.length + result.explanation.length
    });

    return result;
  } catch (error) {
    Logger.error("Error in summarizeContent:", error as Error);
    throw error;
  }
}

export async function getStoredSummary(fileId: number): Promise<FileSummary | null> {
  const [summary] = await db
    .select()
    .from(fileSummaries)
    .where(eq(fileSummaries.fileId, fileId))
    .orderBy(desc(fileSummaries.createdAt))
    .limit(1);

  return summary || null;
}

interface FileSummary {
  id: number;
  fileId: number;
  summary: string;
  explanation: string;
  educationLevel: string;
  createdAt: Date;
  updatedAt: Date;
}