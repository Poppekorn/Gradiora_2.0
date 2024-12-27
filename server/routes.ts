import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { boards, tiles } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Boards API
  app.get("/api/boards", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const userBoards = await db.query.boards.findMany({
      where: eq(boards.organizationId, req.user.organizationId),
      with: {
        tiles: true,
      },
    });

    res.json(userBoards);
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
      where: eq(tiles.boardId, parseInt(req.params.boardId)),
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

  const httpServer = createServer(app);
  return httpServer;
}
