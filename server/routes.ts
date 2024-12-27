import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { boards, tiles } from "@db/schema";
import { eq } from "drizzle-orm";
import { optimizeSchedule } from "./optimizer";
import Logger from "./utils/logger";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Boards API
  app.get("/api/boards", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized boards access attempt", {
        ip: req.ip,
        headers: req.headers,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const userBoards = await db.select().from(boards);
      Logger.info("Boards retrieved successfully", {
        count: userBoards.length,
        userId: req.user?.id,
      });
      res.json(userBoards);
    } catch (error) {
      Logger.error("Error fetching boards", error as Error, {
        userId: req.user?.id,
      });
      res.status(500).send("Failed to fetch boards");
    }
  });

  app.post("/api/boards", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized board creation attempt", {
        ip: req.ip,
        headers: req.headers,
      });
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

      Logger.info("Board created successfully", {
        boardId: board.id,
        userId: req.user?.id,
      });
      res.json(board);
    } catch (error) {
      Logger.error("Error creating board", error as Error, {
        userId: req.user?.id,
        payload: req.body,
      });
      res.status(500).send("Failed to create board");
    }
  });

  // Tiles API
  app.get("/api/boards/:boardId/tiles", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tiles access attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const boardTiles = await db.query.tiles.findMany({
        where: (tiles) => eq(tiles.boardId, parseInt(req.params.boardId)),
      });

      Logger.info("Tiles retrieved successfully", {
        boardId: req.params.boardId,
        count: boardTiles.length,
        userId: req.user?.id,
      });
      res.json(boardTiles);
    } catch (error) {
      Logger.error("Error fetching tiles", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
      });
      res.status(500).send("Failed to fetch tiles");
    }
  });

  app.post("/api/boards/:boardId/tiles", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tile creation attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      let dueDate = null;
      if (req.body.dueDate) {
        dueDate = new Date(req.body.dueDate);
        if (isNaN(dueDate.getTime())) {
          Logger.warn("Invalid due date format", {
            dueDate: req.body.dueDate,
            userId: req.user?.id,
            boardId: req.params.boardId,
          });
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

      Logger.info("Tile created successfully", {
        tileId: tile.id,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json(tile);
    } catch (error) {
      Logger.error("Error creating tile", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        payload: req.body,
      });
      res.status(500).send("Failed to create tile");
    }
  });

  // Schedule Optimization API
  app.post("/api/boards/:boardId/optimize", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized schedule optimization attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const boardId = parseInt(req.params.boardId);
      const [board] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, boardId))
        .limit(1);

      if (!board) {
        Logger.warn("Board not found for optimization", {
          boardId,
          userId: req.user?.id,
        });
        return res.status(404).send("Board not found");
      }

      const boardTiles = await db.query.tiles.findMany({
        where: (tiles) => eq(tiles.boardId, boardId),
      });

      Logger.info("Starting schedule optimization", {
        boardId,
        tilesCount: boardTiles.length,
        userId: req.user?.id,
      });

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

      Logger.info("Schedule optimization completed", {
        boardId,
        optimizedTilesCount: optimizedSchedule.length,
        userId: req.user?.id,
      });

      res.json(optimizedSchedule);
    } catch (error) {
      Logger.error("Error in schedule optimization", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
      });
      res.status(500).send("Failed to optimize schedule");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}