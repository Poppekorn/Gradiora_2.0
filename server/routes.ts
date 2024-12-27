import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { boards, tiles, users } from "@db/schema";
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
      const userBoards = await db.query.boards.findMany({
        where: (boards) => eq(boards.organizationId, req.user.organizationId),
        with: {
          tiles: true,
        },
      });

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

    const board = await db.insert(boards).values({
      ...req.body,
      organizationId: req.user.organizationId,
    }).returning();

    res.json(board[0]);
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

    const tile = await db.insert(tiles).values({
      ...req.body,
      boardId: parseInt(req.params.boardId),
    }).returning();

    res.json(tile[0]);
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