import OpenAI from "openai";
import Logger from "../utils/logger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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

// Helper function to chunk text
function chunkText(text: string, maxChunkSize: number = 8000): string[] {
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

export async function analyzeContent(content: string, level: string = 'high_school'): Promise<AnalysisResult> {
  try {
    Logger.info("Analyzing content with OpenAI", { level });

    // Split content into manageable chunks
    const chunks = chunkText(content);
    let combinedAnalysis = '';

    // Analyze each chunk
    for (const chunk of chunks) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert study assistant. Analyze the provided content and return a JSON object containing a concise summary and detailed explanation, tailored for a ${level} level audience. Format: { 'summary': string, 'explanation': string }`
          },
          {
            role: "user",
            content: chunk
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content);
      combinedAnalysis += result.explanation + '\n\n';
    }

    // Generate final summary
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert study assistant. Create a concise final summary of the following analysis, tailored for a ${level} level audience. Format: { 'summary': string, 'explanation': string }`
        },
        {
          role: "user",
          content: combinedAnalysis
        }
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(finalResponse.choices[0].message.content) as AnalysisResult;
  } catch (error) {
    Logger.error("Error analyzing content with OpenAI", error as Error);
    throw new Error("Failed to analyze content");
  }
}

export async function generateQuiz(content: string, level: string = 'high_school'): Promise<QuizResult> {
  try {
    Logger.info("Generating quiz with OpenAI", { level });

    // Split content into manageable chunks for analysis
    const chunks = chunkText(content);
    let combinedContent = '';

    // Analyze each chunk for key points
    for (const chunk of chunks) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Extract and summarize the key points from this content that would be suitable for quiz questions."
          },
          {
            role: "user",
            content: chunk
          }
        ]
      });

      combinedContent += response.choices[0].message.content + '\n\n';
    }

    // Generate final quiz based on key points
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert quiz generator. Create a quiz based on the provided content summary, tailored for a ${level} level audience.
          Return a JSON object with the following format:
          {
            'topic': string, // Main topic of the content
            'questions': [
              {
                'question': string,
                'options': string[], // Array of 4 possible answers
                'correctAnswer': string, // The correct answer
                'explanation': string // Explanation of why this is correct
              }
            ]
          }
          Generate 5 multiple-choice questions that test understanding of key concepts.`
        },
        {
          role: "user",
          content: combinedContent
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result as QuizResult;
  } catch (error) {
    Logger.error("Error generating quiz with OpenAI", error as Error);
    throw new Error("Failed to generate quiz");
  }
}

export async function analyzeMultipleContents(contents: string[], level: string = 'high_school'): Promise<AnalysisResult> {
  try {
    Logger.info("Analyzing multiple contents with OpenAI", { level });

    // Process each content separately first
    const analyses = await Promise.all(contents.map(async (content) => {
      const chunks = chunkText(content);
      let analysis = '';

      for (const chunk of chunks) {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Analyze this content and extract the key points and concepts."
            },
            {
              role: "user",
              content: chunk
            }
          ]
        });

        analysis += response.choices[0].message.content + '\n\n';
      }

      return analysis;
    }));

    // Combine analyses and generate final summary
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert study assistant. Create a unified analysis of multiple related documents, tailored for a ${level} level audience. Return a JSON object with format: { 'summary': string, 'explanation': string }`
        },
        {
          "role": "user",
          "content": analyses.join("\n=== Next Document ===\n")
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result as AnalysisResult;
  } catch (error) {
    Logger.error("Error analyzing multiple contents with OpenAI", error as Error);
    throw new Error("Failed to analyze multiple contents");
  }
}