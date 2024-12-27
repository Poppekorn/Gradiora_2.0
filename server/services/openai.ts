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

function preprocessText(text: string): string {
  try {
    Logger.info("Starting text preprocessing", { originalLength: text.length });

    // Remove common OCR artifacts and normalize text
    const cleaned = text
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .replace(/[^\S\r\n]+/g, ' ')  // Replace multiple spaces with single space
      .replace(/[\n\r]+/g, '\n')    // Normalize line breaks
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    Logger.info("Text preprocessing completed", {
      originalLength: text.length,
      cleanedLength: cleaned.length
    });

    if (cleaned.length < 10) {
      throw new Error("Preprocessed text is too short");
    }

    return cleaned;
  } catch (error) {
    Logger.error("Error preprocessing text:", error as Error);
    throw new Error("Failed to preprocess text");
  }
}

function chunkText(text: string, maxChunkSize: number = 3000): string[] {
  try {
    Logger.info("Starting text chunking", { textLength: text.length, maxChunkSize });

    const chunks: string[] = [];
    let currentChunk = '';

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
      if ((currentChunk + '\n' + paragraph).length <= maxChunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    Logger.info("Text chunking completed", {
      originalLength: text.length,
      chunks: chunks.length,
      averageChunkSize: chunks.reduce((acc, chunk) => acc + chunk.length, 0) / chunks.length
    });

    return chunks;
  } catch (error) {
    Logger.error("Error chunking text:", error as Error);
    throw new Error("Failed to chunk text");
  }
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

async function processChunks(chunks: string[], userId: number, level: string): Promise<AnalysisResult> {
  try {
    Logger.info("Starting chunks processing", {
      chunksCount: chunks.length,
      level,
      userId
    });

    const summaryPromises = chunks.map(async (chunk, index) => {
      const cleanedText = preprocessText(chunk);

      Logger.info(`Processing chunk ${index + 1}/${chunks.length}`, {
        chunkLength: cleanedText.length,
        level
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert academic content analyzer for ${level} students. Process the text and provide a concise analysis in JSON format with two sections: summary (key points as bullet points) and explanation (detailed analysis connecting the concepts). If the text is not meaningful, respond with appropriate error messages.`
          },
          {
            role: "user",
            content: cleanedText
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 1000
      });

      await manageQuota(userId, response.usage?.total_tokens || 0);

      const result = JSON.parse(response.choices[0].message?.content || '{"summary": "", "explanation": ""}');

      Logger.info(`Chunk ${index + 1} processed successfully`, {
        summaryLength: result.summary.length,
        explanationLength: result.explanation.length
      });

      return result;
    });

    const summaries = await Promise.all(summaryPromises);

    // Combine summaries intelligently
    const combinedSummary = summaries
      .map(s => s.summary)
      .filter(Boolean)
      .join("\n\n");

    const combinedExplanation = summaries
      .map(s => s.explanation)
      .filter(Boolean)
      .join("\n\n");

    Logger.info("Chunks processing completed", {
      combinedSummaryLength: combinedSummary.length,
      combinedExplanationLength: combinedExplanation.length
    });

    return {
      summary: combinedSummary || "Could not extract meaningful content from the file. Please ensure the content is clear and readable.",
      explanation: combinedExplanation || "Could not generate an explanation. Please check the file content and try again."
    };
  } catch (error) {
    Logger.error("Error processing chunks:", error as Error);
    throw error;
  }
}

export async function summarizeContent(
  content: string | Buffer,
  level: string = 'high_school',
  userId: number,
  fileId: number,
  mimeType?: string
): Promise<AnalysisResult> {
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

    Logger.info("Content extracted successfully", {
      contentLength: textContent.length,
      isImage: typeof content !== 'string'
    });

    const chunks = chunkText(textContent);
    Logger.info(`Content split into ${chunks.length} chunks`);

    const result = await processChunks(chunks, userId, level);

    // Store the summary in the database
    await db.insert(fileSummaries).values({
      fileId,
      summary: result.summary,
      explanation: result.explanation,
      educationLevel: level,
    }).onConflictDoUpdate({
      target: [fileSummaries.fileId, fileSummaries.educationLevel],
      set: {
        summary: result.summary,
        explanation: result.explanation,
        updatedAt: new Date()
      }
    });

    Logger.info("Summarization completed", {
      chunksProcessed: chunks.length,
      summaryLength: result.summary.length,
      explanationLength: result.explanation.length
    });

    return result;
  } catch (error) {
    Logger.error("Error in summarizeContent:", error as Error);
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