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
    Logger.error("Error managing quota:", { error, userId, tokenCount });
    throw error;
  }
}

async function processChunks(chunks: string[], userId: number, level: string): Promise<AnalysisResult> {
  const summaries = await Promise.all(chunks.map(async (chunk) => {
    const response = await retryOperation(() => openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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
    }));

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
  Logger.info("Summarizing content", { level, contentLength: content.length });

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