import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { boards, tiles, files, tags, fileTags } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { optimizeSchedule } from "./optimizer";
import Logger from "./utils/logger";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

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
      Logger.info("Attempting to create board", {
        userId: req.user?.id,
        payload: { ...req.body, password: undefined }, // Log request data except sensitive info
      });

      const [board] = await db
        .insert(boards)
        .values({
          name: req.body.name,
          description: req.body.description,
          professor: req.body.professor,
          schedule: req.body.schedule,
          syllabus: req.body.syllabus,
          color: req.body.color || "#E2E8F0", // Ensure color is included
        })
        .returning();

      Logger.info("Board created successfully", {
        boardId: board.id,
        userId: req.user?.id,
        color: board.color, // Log the color that was set
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
      Logger.info("Attempting to update board", {
        boardId: req.params.id,
        userId: req.user?.id,
        payload: { ...req.body, password: undefined },
      });

      const [updatedBoard] = await db
        .update(boards)
        .set({
          name: req.body.name,
          description: req.body.description,
          professor: req.body.professor,
          schedule: req.body.schedule,
          syllabus: req.body.syllabus,
          isArchived: req.body.isArchived,
          color: req.body.color || "#E2E8F0", // Add color handling
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
        color: updatedBoard.color, // Log the updated color
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
      // First delete all associated tiles
      const boardId = parseInt(req.params.id);
      await db
        .delete(tiles)
        .where(eq(tiles.boardId, boardId));

      Logger.info("Associated tiles deleted", {
        boardId: req.params.id,
        userId: req.user?.id,
      });

      // Then delete the board
      const [deletedBoard] = await db
        .delete(boards)
        .where(eq(boards.id, boardId))
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


  // Delete file endpoint
  app.delete("/api/boards/:boardId/files/:fileId", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized file deletion attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      // First delete file tags
      await db
        .delete(fileTags)
        .where(eq(fileTags.fileId, parseInt(req.params.fileId)));

      // Then delete the file record
      const [deletedFile] = await db
        .delete(files)
        .where(eq(files.id, parseInt(req.params.fileId)))
        .returning();

      if (!deletedFile) {
        Logger.warn("File not found for deletion", {
          fileId: req.params.fileId,
          boardId: req.params.boardId,
          userId: req.user?.id,
        });
        return res.status(404).send("File not found");
      }

      // Delete the actual file from the filesystem
      const filePath = path.join(process.cwd(), 'uploads', deletedFile.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      Logger.info("File deleted successfully", {
        fileId: req.params.fileId,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      Logger.error("Error deleting file", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
      });
      res.status(500).send("Failed to delete file");
    }
  });

  // File management routes
  app.post("/api/boards/:boardId/files", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized file upload attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }

      const selectedTags = JSON.parse(req.body.tags || '[]');

      // Create file record
      const [fileRecord] = await db
        .insert(files)
        .values({
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          boardId: parseInt(req.params.boardId),
          uploadedBy: req.user!.id,
        })
        .returning();

      // Add tags to file directly using database query
      for (const tagId of selectedTags) {
        try {
          // Check if tag association already exists
          const existingAssociation = await db.query.fileTags.findFirst({
            where: (fileTags, { and, eq }) => and(
              eq(fileTags.fileId, fileRecord.id),
              eq(fileTags.tagId, tagId)
            ),
          });

          if (!existingAssociation) {
            await db
              .insert(fileTags)
              .values({
                fileId: fileRecord.id,
                tagId: tagId,
              });
          }
        } catch (error) {
          Logger.error("Error adding tag to file", error as Error, {
            fileId: fileRecord.id,
            tagId: tagId,
            boardId: req.params.boardId,
          });
          // Continue with other tags even if one fails
        }
      }

      Logger.info("File uploaded successfully", {
        fileId: fileRecord.id,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json(fileRecord);
    } catch (error) {
      Logger.error("Error uploading file", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
      });
      res.status(500).send("Failed to upload file");
    }
  });

  app.get("/api/boards/:boardId/files", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized files access attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const boardFiles = await db.query.files.findMany({
        where: eq(files.boardId, parseInt(req.params.boardId)),
        with: {
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });

      Logger.info("Files retrieved successfully", {
        boardId: req.params.boardId,
        count: boardFiles.length,
        userId: req.user?.id,
      });
      res.json(boardFiles);
    } catch (error) {
      Logger.error("Error fetching files", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
      });
      res.status(500).send("Failed to fetch files");
    }
  });

  // Tag management routes (updated)
  app.post("/api/boards/:boardId/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tag creation attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const normalizedName = req.body.name.trim();

      // Check for existing tag with normalized name comparison
      const [existingTag] = await db
        .select()
        .from(tags)
        .where(
          sql`lower(trim(${tags.name})) = lower(${normalizedName}) AND ${tags.boardId} = ${parseInt(req.params.boardId)}`
        )
        .limit(1);

      if (existingTag) {
        Logger.info("Returning existing tag", {
          tagId: existingTag.id,
          boardId: req.params.boardId,
          userId: req.user?.id,
        });
        return res.json(existingTag);
      }

      const [tag] = await db
        .insert(tags)
        .values({
          name: normalizedName,
          boardId: parseInt(req.params.boardId),
          isStudyUnitTag: req.body.isStudyUnitTag || false,
        })
        .returning();

      Logger.info("Tag created successfully", {
        tagId: tag.id,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json(tag);
    } catch (error) {
      Logger.error("Error creating tag", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        payload: req.body,
      });

      // Check if the error is a unique constraint violation
      if ((error as any)?.code === '23505') {
        return res.status(409).send("A tag with this name already exists");
      }

      res.status(500).send("Failed to create tag");
    }
  });

  // Add tag to file endpoint
  app.post("/api/boards/:boardId/files/:fileId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Check if the association already exists
      const existingAssociation = await db.query.fileTags.findFirst({
        where: (fileTags, { and, eq }) => and(
          eq(fileTags.fileId, parseInt(req.params.fileId)),
          eq(fileTags.tagId, parseInt(req.params.tagId))
        ),
      });

      if (existingAssociation) {
        return res.json(existingAssociation);
      }

      const [fileTag] = await db
        .insert(fileTags)
        .values({
          fileId: parseInt(req.params.fileId),
          tagId: parseInt(req.params.tagId),
        })
        .returning();

      Logger.info("Tag added to file successfully", {
        fileId: req.params.fileId,
        tagId: req.params.tagId,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json(fileTag);
    } catch (error) {
      Logger.error("Error adding tag to file", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        tagId: req.params.tagId,
      });
      res.status(500).send("Failed to add tag to file");
    }
  });

  app.get("/api/boards/:boardId/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tags access attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const boardTags = await db.query.tags.findMany({
        where: eq(tags.boardId, parseInt(req.params.boardId)),
      });

      Logger.info("Tags retrieved successfully", {
        boardId: req.params.boardId,
        count: boardTags.length,
        userId: req.user?.id,
      });
      res.json(boardTags);
    } catch (error) {
      Logger.error("Error fetching tags", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
      });
      res.status(500).send("Failed to fetch tags");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}