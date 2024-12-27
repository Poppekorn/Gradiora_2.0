import OpenAI from "openai";
import Logger from "../utils/logger";
import { db } from "@db";
import { apiQuota } from "@db/schema";
import { eq } from "drizzle-orm";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AnalysisResult {
  summary: string;
  explanation: string;
}

// Helper function to chunk text into smaller parts
function chunkText(text: string, maxChunkSize: number = 4000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Split by sentences to maintain context
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
  } catch (error) {
    if (retries === 0 || !(error instanceof Error)) {
      // Enhance error messages for common OpenAI API issues
      if (error.message?.includes('429')) {
        throw new Error('OpenAI API quota exceeded. Please try again later.');
      }
      if (error.message?.includes('401')) {
        throw new Error('Invalid API key. Please check your OpenAI API configuration.');
      }
      throw error;
    }

    if (error.message.includes('Rate limit reached')) {
      await new Promise(resolve => setTimeout(resolve, delay * 2));
    } else {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return retryOperation(operation, retries - 1, delay * 2);
  }
}

// Add function to update quota usage
async function updateQuotaUsage(userId: number, tokenCount: number) {
  const today = new Date();
  const [userQuota] = await db
    .select()
    .from(apiQuota)
    .where(eq(apiQuota.userId, userId))
    .limit(1);

  if (!userQuota || new Date(userQuota.resetAt) < today) {
    // Create new quota or reset existing one
    await db
      .insert(apiQuota)
      .values({
        userId,
        tokenCount,
        callCount: 1,
        resetAt: new Date(today.getFullYear(), today.getMonth() + 1, 1), // Reset on first of next month
      })
      .onConflictDoUpdate({
        target: [apiQuota.userId],
        set: {
          tokenCount,
          callCount: 1,
          resetAt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
        },
      });
  } else {
    // Update existing quota
    await db
      .update(apiQuota)
      .set({
        tokenCount: userQuota.tokenCount + tokenCount,
        callCount: userQuota.callCount + 1,
      })
      .where(eq(apiQuota.userId, userId));
  }
}

// Update summarizeContent function to track usage
export async function summarizeContent(content: string, level: string = 'high_school', userId: number): Promise<AnalysisResult> {
  try {
    Logger.info("Summarizing content with OpenAI", { level, contentLength: content.length });

    if (!content.trim()) {
      throw new Error("Empty content provided for summarization");
    }

    const chunks = chunkText(content);
    Logger.info(`Content split into ${chunks.length} chunks`);

    let totalTokens = 0;
    let summaries: AnalysisResult[] = [];

    for (const chunk of chunks) {
      try {
        const response = await retryOperation(async () => {
          return await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are a skilled educator. Create a clear summary of the following content tailored for ${level} level students. First provide a brief overview, then follow with a more detailed explanation. Format your response with a clear separation between the summary and explanation using two newlines.`
              },
              {
                role: "user",
                content: chunk
              }
            ],
            temperature: 0.7
          });
        });

        // Track token usage
        totalTokens += response.usage?.total_tokens || 0;

        Logger.info("Chunk summarization completed", {
          status: 'success',
          chunkLength: chunk.length
        });

        const result = response.choices[0].message?.content;
        if (!result) {
          throw new Error("Empty response from OpenAI");
        }

        const parts = result.split('\n\n');
        summaries.push({
          summary: parts[0] || '',
          explanation: parts.slice(1).join('\n\n') || ''
        });

      } catch (error) {
        Logger.error("Error summarizing chunk", error as Error, {
          chunkLength: chunk.length,
          errorMessage: (error as Error).message
        });
        throw error;
      }
    }

    // Update quota usage
    await updateQuotaUsage(userId, totalTokens);

    const combinedSummary = {
      summary: summaries.map(s => s.summary).join('\n').trim(),
      explanation: summaries.map(s => s.explanation).join('\n\n').trim()
    };

    Logger.info("Summarization completed", {
      chunksProcessed: chunks.length,
      totalSummariesGenerated: summaries.length
    });

    return combinedSummary;
  } catch (error) {
    Logger.error("Error summarizing content with OpenAI", error as Error, {
      contentLength: content.length,
      level,
      errorMessage: (error as Error).message
    });

    // Enhance error messages for users
    if (error.message?.includes('quota exceeded')) {
      throw new Error('OpenAI API quota exceeded. Please try again later.');
    }
    if (error.message?.includes('401')) {
      throw new Error('Invalid API key. Please check your OpenAI API configuration.');
    }

    throw new Error("Failed to summarize content: " + (error as Error).message);
  }
}

// Add endpoint to get quota information
export async function getQuotaInfo(userId: number) {
  const [quota] = await db
    .select()
    .from(apiQuota)
    .where(eq(apiQuota.userId, userId))
    .limit(1);

  return quota;
}