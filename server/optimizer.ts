import OpenAI from "openai";
import type { Tile, Board, User } from "@db/schema";

const openai = new OpenAI();

interface OptimizationInput {
  tiles: Tile[];
  board: Board;
  user: User;
}

interface OptimizedSchedule {
  tileId: number;
  recommendedTimeOfDay: string;
  optimalStudyOrder: number;
  estimatedDuration: number;
}

export async function optimizeSchedule({ tiles, board, user }: OptimizationInput): Promise<OptimizedSchedule[]> {
  // Prepare the context for the AI
  const context = {
    tiles: tiles.map(tile => ({
      id: tile.id,
      title: tile.title,
      dueDate: tile.dueDate,
      priority: tile.priority,
      status: tile.status,
      complexity: tile.complexity,
    })),
    userPreferences: user.studyPreferences,
    courseInfo: {
      name: board.name,
      difficulty: board.difficulty,
      estimatedStudyHours: board.estimatedStudyHours,
    },
  };

  const prompt = `
    As an AI study schedule optimizer, analyze the following course and student data:

    Course: ${JSON.stringify(context.courseInfo)}
    Student Preferences: ${JSON.stringify(context.userPreferences)}
    Study Units: ${JSON.stringify(context.tiles)}

    Create an optimized study schedule that:
    1. Prioritizes tasks based on due dates and complexity
    2. Considers the student's preferred study times
    3. Accounts for the course difficulty
    4. Balances workload across available time
    5. Suggests optimal duration for each study session

    Provide recommendations in this format:
    {
      "schedule": [
        {
          "tileId": number,
          "recommendedTimeOfDay": string,
          "optimalStudyOrder": number,
          "estimatedDuration": number
        }
      ]
    }
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4",
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const response = JSON.parse(content);
    if (!response.schedule || !Array.isArray(response.schedule)) {
      throw new Error("Invalid response format from OpenAI");
    }

    return response.schedule;
  } catch (error) {
    console.error("Error optimizing schedule:", error);
    throw new Error("Failed to optimize schedule");
  }
}