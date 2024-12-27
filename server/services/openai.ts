import OpenAI from "openai";
import Logger from "../utils/logger";
import { db } from "@db";
import { apiQuota, fileSummaries } from "@db/schema";
import { eq, desc } from "drizzle-orm";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AnalysisResult {
  summary: string;
  explanation: string;
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

async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retries === 0) {
      if (error.message?.includes("429")) {
        throw new Error("OpenAI API quota exceeded. Please try again later.");
      }
      if (error.message?.includes("401")) {
        throw new Error("Invalid API key. Please check your OpenAI API configuration.");
      }
      throw error;
    }

    const backoff = error.message?.includes("Rate limit reached") ? delay * 2 : delay;
    await new Promise(resolve => setTimeout(resolve, backoff));
    return retryOperation(operation, retries - 1, backoff);
  }
}

async function manageQuota(userId: number, tokenCount: number) {
  const today = new Date();
  const resetDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [userQuota] = await db
    .select()
    .from(apiQuota)
    .where(eq(apiQuota.userId, userId))
    .limit(1);

  if (!userQuota || new Date(userQuota.resetAt) < today) {
    // Insert new quota or reset existing one
    await db.insert(apiQuota).values({
      userId,
      tokenCount,
      callCount: 1,
      quotaLimit: 100000,
      resetAt: resetDate,
    });
  } else {
    // Update existing quota
    await db.update(apiQuota)
      .set({
        tokenCount: userQuota.tokenCount + tokenCount,
        callCount: userQuota.callCount + 1,
        updatedAt: new Date()
      })
      .where(eq(apiQuota.userId, userId));
  }
}

async function processChunks(chunks: string[], userId: number, level: string): Promise<AnalysisResult> {
  const summaries = await Promise.all(chunks.map(async (chunk) => {
    const response = await retryOperation(() => openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an educational content summarizer for ${level} students. Create a clear, focused summary of the content followed by a detailed explanation. Focus exclusively on the main ideas, key points, and important concepts in the text. Do not mention anything about file formats, document structure, or technical details.

When summarizing:
- Extract and present the core message and main points
- Use clear, level-appropriate language
- Organize information logically
- Remove any technical metadata or format-related content`
        },
        {
          role: "user",
          content: chunk
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    }));

    await manageQuota(userId, response.usage?.total_tokens || 0);

    const result = response.choices[0].message?.content;
    if (!result) {
      throw new Error("Empty response from OpenAI");
    }

    const parts = result.split("\n\n");
    return {
      summary: parts[0] || '',
      explanation: parts.slice(1).join("\n\n") || ''
    };
  }));

  // Combine summaries more intelligently
  const combinedSummary = summaries.map(s => s.summary).join("\n").trim();
  const combinedExplanation = summaries.map(s => s.explanation)
    .filter(exp => exp.length > 0) // Remove empty explanations
    .join("\n\n")
    .trim();

  return {
    summary: combinedSummary,
    explanation: combinedExplanation
  };
}

export async function getQuotaInfo(userId: number) {
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
}

export async function summarizeContent(content: string, level: string = 'high_school', userId: number, fileId: number): Promise<AnalysisResult> {
  Logger.info("Summarizing content with OpenAI", { level, contentLength: content.length });

  if (!content.trim()) {
    throw new Error("Empty content provided for summarization");
  }

  const chunks = chunkText(content);
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
    totalTokensUsed: result.summary.length + result.explanation.length
  });

  return result;
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