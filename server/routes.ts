import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { boards, tiles } from "@db/schema";
import { eq } from "drizzle-orm";
import { optimizeSchedule } from "./optimizer";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Boards API
  app.get("/api/boards", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userBoards = await db.select().from(boards);
      res.json(userBoards);
    } catch (error) {
      console.error("Error fetching boards:", error);
      res.status(500).send("Failed to fetch boards");
    }
  });

  app.post("/api/boards", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [board] = await db
        .insert(boards)
        .values({
          name: req.body.name,
          description: req.body.description,
          professor: req.body.professor,
          schedule: req.body.schedule,
          syllabus: req.body.syllabus,
        })
        .returning();

      res.json(board);
    } catch (error) {
      console.error("Error creating board:", error);
      res.status(500).send("Failed to create board");
    }
  });

  // Tiles API
  app.get("/api/boards/:boardId/tiles", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const boardTiles = await db.query.tiles.findMany({
      where: (tiles) => eq(tiles.boardId, parseInt(req.params.boardId)),
    });

    res.json(boardTiles);
  });

  app.post("/api/boards/:boardId/tiles", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Parse and validate the date
      let dueDate = null;
      if (req.body.dueDate) {
        dueDate = new Date(req.body.dueDate);
        if (isNaN(dueDate.getTime())) {
          return res.status(400).send("Invalid due date format");
        }
      }

      const [tile] = await db
        .insert(tiles)
        .values({
          boardId: parseInt(req.params.boardId),
          title: req.body.title,
          description: req.body.description,
          dueDate: dueDate,
          status: req.body.status,
          priority: req.body.priority,
          tags: req.body.tags,
          notes: req.body.notes,
        })
        .returning();

      res.json(tile);
    } catch (error) {
      console.error("Error creating tile:", error);
      res.status(500).send("Failed to create tile");
    }
  });

  // Schedule Optimization API
  app.post("/api/boards/:boardId/optimize", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const boardId = parseInt(req.params.boardId);

      // Get the board and its tiles
      const [board] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, boardId))
        .limit(1);

      if (!board) {
        return res.status(404).send("Board not found");
      }

      const boardTiles = await db.query.tiles.findMany({
        where: (tiles) => eq(tiles.boardId, boardId),
      });

      // Get the optimized schedule
      const optimizedSchedule = await optimizeSchedule({
        tiles: boardTiles,
        board,
        user: req.user,
      });

      // Update tiles with optimized data
      for (const schedule of optimizedSchedule) {
        await db
          .update(tiles)
          .set({
            recommendedTimeOfDay: schedule.recommendedTimeOfDay,
            optimalStudyOrder: schedule.optimalStudyOrder,
            estimatedDuration: schedule.estimatedDuration,
          })
          .where(eq(tiles.id, schedule.tileId));
      }

      res.json(optimizedSchedule);
    } catch (error) {
      console.error("Error in schedule optimization:", error);
      res.status(500).send("Failed to optimize schedule");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}