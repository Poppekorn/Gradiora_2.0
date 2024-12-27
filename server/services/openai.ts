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

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizResult {
  topic: string;
  questions: QuizQuestion[];
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

export async function analyzeContent(content: string, level: string = 'high_school'): Promise<AnalysisResult> {
  try {
    Logger.info("Analyzing content with OpenAI", { level, contentLength: content.length });

    // Split content into smaller chunks
    const chunks = chunkText(content);
    Logger.info(`Content split into ${chunks.length} chunks`);

    let analyses: AnalysisResult[] = [];

    // Analyze each chunk
    for (const chunk of chunks) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are an expert study assistant. Analyze the following content and provide a JSON response with a summary and explanation tailored for ${level} level students. Focus on the key concepts and learning points.`
            },
            {
              role: "user",
              content: chunk
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        });

        const result = response.choices[0].message?.content;
        if (!result) {
          throw new Error("Empty response from OpenAI");
        }

        const parsed = JSON.parse(result) as AnalysisResult;
        analyses.push(parsed);

      } catch (error) {
        Logger.error("Error analyzing chunk", error as Error);
        throw error;
      }
    }

    // Combine all analyses into a final summary
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert study assistant. Create a comprehensive summary combining the following analyses into a cohesive explanation tailored for ${level} level students. Return a JSON response.`
        },
        {
          role: "user",
          content: JSON.stringify(analyses)
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const finalResult = finalResponse.choices[0].message?.content;
    if (!finalResult) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(finalResult) as AnalysisResult;

  } catch (error) {
    Logger.error("Error analyzing content with OpenAI", error as Error);
    throw new Error("Failed to analyze content: " + (error as Error).message);
  }
}

export async function generateQuiz(content: string, level: string = 'high_school'): Promise<QuizResult> {
  try {
    Logger.info("Generating quiz with OpenAI", { level, contentLength: content.length });

    // Split content into smaller chunks
    const chunks = chunkText(content);
    Logger.info(`Content split into ${chunks.length} chunks`);

    let keyPoints = [];

    // Extract key points from each chunk
    for (const chunk of chunks) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "Extract and summarize the key points from this content that would be suitable for quiz questions."
            },
            {
              role: "user",
              content: chunk
            }
          ],
          temperature: 0.7
        });

        const result = response.choices[0].message?.content;
        if (result) {
          keyPoints.push(result);
        }

      } catch (error) {
        Logger.error("Error extracting key points", error as Error);
        throw error;
      }
    }

    // Generate quiz based on key points
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Create a quiz based on these key points, suitable for ${level} level students. Include a mix of conceptual and factual questions. Return a JSON object with format:
          {
            "topic": "Main topic",
            "questions": [
              {
                "question": "Question text",
                "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                "correctAnswer": "Correct option",
                "explanation": "Why this is correct"
              }
            ]
          }`
        },
        {
          role: "user",
          content: keyPoints.join("\n\n")
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = response.choices[0].message?.content;
    if (!result) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(result) as QuizResult;

  } catch (error) {
    Logger.error("Error generating quiz with OpenAI", error as Error);
    throw new Error("Failed to generate quiz: " + (error as Error).message);
  }
}

export async function analyzeMultipleContents(contents: string[], level: string = 'high_school'): Promise<AnalysisResult> {
  try {
    Logger.info("Analyzing multiple contents with OpenAI", { level, contentCount: contents.length });

    // Analyze each content separately first
    const individualAnalyses = await Promise.all(contents.map(async (content) => {
      return await analyzeContent(content, level);
    }));

    // Combine analyses into a unified summary
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Create a unified analysis combining these separate analyses into a cohesive summary suitable for ${level} level students. Return a JSON response with a summary and detailed explanation that connects the key concepts across all documents.`
        },
        {
          role: "user",
          content: JSON.stringify(individualAnalyses)
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const result = response.choices[0].message?.content;
    if (!result) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(result) as AnalysisResult;

  } catch (error) {
    Logger.error("Error analyzing multiple contents with OpenAI", error as Error);
    throw new Error("Failed to analyze multiple contents: " + (error as Error).message);
  }
}

export async function summarizeContent(content: string, level: string = 'high_school'): Promise<AnalysisResult> {
  try {
    Logger.info("Summarizing content with OpenAI", { level, contentLength: content.length });

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
              content: `You are a skilled educator. Create a clear summary of the following content tailored for ${level} level students. Include both a brief overview and a more detailed explanation.`
            },
            {
              role: "user",
              content: chunk
            }
          ],
          temperature: 0.7
        });

        const result = response.choices[0].message?.content;
        if (result) {
          summaries.push({
            summary: result.split('\n\n')[0] || '',
            explanation: result.split('\n\n').slice(1).join('\n\n') || ''
          });
        }
      } catch (error) {
        Logger.error("Error summarizing chunk", error as Error);
        throw error;
      }
    }

    // Combine all summaries
    const combinedSummary = {
      summary: summaries.map(s => s.summary).join('\n'),
      explanation: summaries.map(s => s.explanation).join('\n\n')
    };

    return combinedSummary;
  } catch (error) {
    Logger.error("Error summarizing content with OpenAI", error as Error);
    throw new Error("Failed to summarize content: " + (error as Error).message);
  }
}