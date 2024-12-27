import OpenAI from "openai";
import Logger from "../utils/logger";

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

export async function summarizeContent(content: string, level: string = 'high_school'): Promise<AnalysisResult> {
  try {
    Logger.info("Summarizing content with OpenAI", { level, contentLength: content.length });

    if (!content.trim()) {
      throw new Error("Empty content provided for summarization");
    }

    const chunks = chunkText(content);
    Logger.info(`Content split into ${chunks.length} chunks`);

    let summaries: AnalysisResult[] = [];

    for (const chunk of chunks) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a skilled educator. Create a clear summary of the following content tailored for ${level} level students. Return a concise summary and a more detailed explanation.`
            },
            {
              role: "user",
              content: chunk
            }
          ],
          temperature: 0.7
        });

        Logger.info("Chunk summarization completed", {
          status: 'success',
          chunkLength: chunk.length
        });

        const result = response.choices[0].message?.content;
        if (!result) {
          throw new Error("Empty response from OpenAI");
        }

        // Split the response into summary and explanation
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

    // Combine all summaries into a final summary
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
    throw new Error("Failed to summarize content: " + (error as Error).message);
  }
}