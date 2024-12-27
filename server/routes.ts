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

  // New endpoint for updating a board
  app.put("/api/boards/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized board update attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.id,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const [updatedBoard] = await db
        .update(boards)
        .set({
          name: req.body.name,
          description: req.body.description,
          professor: req.body.professor,
          schedule: req.body.schedule,
          syllabus: req.body.syllabus,
          isArchived: req.body.isArchived,
        })
        .where(eq(boards.id, parseInt(req.params.id)))
        .returning();

      if (!updatedBoard) {
        Logger.warn("Board not found for update", {
          boardId: req.params.id,
          userId: req.user?.id,
        });
        return res.status(404).send("Board not found");
      }

      Logger.info("Board updated successfully", {
        boardId: updatedBoard.id,
        userId: req.user?.id,
      });
      res.json(updatedBoard);
    } catch (error) {
      Logger.error("Error updating board", error as Error, {
        userId: req.user?.id,
        boardId: req.params.id,
        payload: req.body,
      });
      res.status(500).send("Failed to update board");
    }
  });

  // New endpoint for deleting a board
  app.delete("/api/boards/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized board deletion attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.id,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const [deletedBoard] = await db
        .delete(boards)
        .where(eq(boards.id, parseInt(req.params.id)))
        .returning();

      if (!deletedBoard) {
        Logger.warn("Board not found for deletion", {
          boardId: req.params.id,
          userId: req.user?.id,
        });
        return res.status(404).send("Board not found");
      }

      Logger.info("Board deleted successfully", {
        boardId: req.params.id,
        userId: req.user?.id,
      });
      res.json({ message: "Board deleted successfully" });
    } catch (error) {
      Logger.error("Error deleting board", error as Error, {
        userId: req.user?.id,
        boardId: req.params.id,
      });
      res.status(500).send("Failed to delete board");
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

  // New endpoint for updating a tile
  app.put("/api/boards/:boardId/tiles/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tile update attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        tileId: req.params.id,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      let dueDate = null;
      if (req.body.dueDate) {
        dueDate = new Date(req.body.dueDate);
        if (isNaN(dueDate.getTime())) {
          Logger.warn("Invalid due date format for update", {
            dueDate: req.body.dueDate,
            userId: req.user?.id,
            boardId: req.params.boardId,
            tileId: req.params.id,
          });
          return res.status(400).send("Invalid due date format");
        }
      }

      const [updatedTile] = await db
        .update(tiles)
        .set({
          title: req.body.title,
          description: req.body.description,
          dueDate: dueDate,
          status: req.body.status,
          priority: req.body.priority,
          tags: req.body.tags,
          notes: req.body.notes,
          grade: req.body.grade,
        })
        .where(eq(tiles.id, parseInt(req.params.id)))
        .returning();

      if (!updatedTile) {
        Logger.warn("Tile not found for update", {
          tileId: req.params.id,
          boardId: req.params.boardId,
          userId: req.user?.id,
        });
        return res.status(404).send("Tile not found");
      }

      Logger.info("Tile updated successfully", {
        tileId: updatedTile.id,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json(updatedTile);
    } catch (error) {
      Logger.error("Error updating tile", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        tileId: req.params.id,
        payload: req.body,
      });
      res.status(500).send("Failed to update tile");
    }
  });

  // New endpoint for deleting a tile
  app.delete("/api/boards/:boardId/tiles/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tile deletion attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        tileId: req.params.id,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const [deletedTile] = await db
        .delete(tiles)
        .where(eq(tiles.id, parseInt(req.params.id)))
        .returning();

      if (!deletedTile) {
        Logger.warn("Tile not found for deletion", {
          tileId: req.params.id,
          boardId: req.params.boardId,
          userId: req.user?.id,
        });
        return res.status(404).send("Tile not found");
      }

      Logger.info("Tile deleted successfully", {
        tileId: req.params.id,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json({ message: "Tile deleted successfully" });
    } catch (error) {
      Logger.error("Error deleting tile", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        tileId: req.params.id,
      });
      res.status(500).send("Failed to delete tile");
    }
  });

  // Schedule Optimization API (unchanged)
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