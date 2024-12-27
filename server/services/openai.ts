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

export async function analyzeContent(content: string): Promise<AnalysisResult> {
  try {
    Logger.info("Analyzing content with OpenAI");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert study assistant. Analyze the provided content and return a JSON object containing a concise summary and detailed explanation. Format: { 'summary': string, 'explanation': string }"
        },
        {
          role: "user",
          content
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result as AnalysisResult;
  } catch (error) {
    Logger.error("Error analyzing content with OpenAI", error as Error);
    throw new Error("Failed to analyze content");
  }
}

export async function generateQuiz(content: string): Promise<QuizResult> {
  try {
    Logger.info("Generating quiz with OpenAI");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert quiz generator. Create a quiz based on the provided content.
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
          content
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

export async function analyzeMultipleContents(contents: string[]): Promise<AnalysisResult> {
  try {
    Logger.info("Analyzing multiple contents with OpenAI");
    
    const combinedContent = contents.join("\n\n=== Next Document ===\n\n");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert study assistant. Analyze the provided multiple documents and return a JSON object containing a unified summary and detailed explanation that connects the key concepts across all documents. Format: { 'summary': string, 'explanation': string }"
        },
        {
          role: "user",
          content: combinedContent
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
