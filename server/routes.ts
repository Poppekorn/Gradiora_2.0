import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { boards, tiles, files, tags, fileTags } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import Logger from "./utils/logger";
import multer from "multer";
import path from "path";
import fs from "fs";
import { summarizeContent } from "./services/openai";
import { readFile } from "fs/promises";

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

  // Tag management routes
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
      Logger.info("Attempting to create/find tag", {
        boardId: req.params.boardId,
        normalizedName,
        userId: req.user?.id,
      });

      // Check for existing tag with normalized name comparison
      const [existingTag] = await db
        .select()
        .from(tags)
        .where(
          and(
            sql`lower(trim(${tags.name})) = lower(${normalizedName})`,
            eq(tags.boardId, parseInt(req.params.boardId))
          )
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

      if ((error as any)?.code === '23505') {
        return res.status(409).send("A tag with this name already exists");
      }

      res.status(500).send("Failed to create tag");
    }
  });

  // File management routes
  app.post("/api/boards/:boardId/files", upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }

      const selectedTags = JSON.parse(req.body.tags || '[]');

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

      for (const tagId of selectedTags) {
        await db
          .insert(fileTags)
          .values({
            fileId: fileRecord.id,
            tagId: tagId,
          });
      }

      res.json(fileRecord);
    } catch (error) {
      Logger.error("Error uploading file", error as Error);
      res.status(500).send("Failed to upload file");
    }
  });

  app.get("/api/boards/:boardId/files", async (req, res) => {
    if (!req.isAuthenticated()) {
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

      res.json(boardFiles);
    } catch (error) {
      Logger.error("Error fetching files", error as Error);
      res.status(500).send("Failed to fetch files");
    }
  });

  // Summarize endpoint
  app.post("/api/boards/:boardId/files/:fileId/summarize", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      Logger.info("Starting file summarization", {
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        userId: req.user?.id,
      });

      const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, parseInt(req.params.fileId)))
        .limit(1);

      if (!file) {
        Logger.warn("File not found for summarization", {
          fileId: req.params.fileId,
          boardId: req.params.boardId,
        });
        return res.status(404).send("File not found");
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await readFile(filePath, 'utf-8');

      const educationLevel = req.body.educationLevel || 'high_school';

      Logger.info("Summarizing file content", {
        fileId: req.params.fileId,
        contentLength: content.length,
        educationLevel,
      });

      const summary = await summarizeContent(content, educationLevel);

      Logger.info("File summarized successfully", {
        fileId: req.params.fileId,
        boardId: req.params.boardId,
        userId: req.user?.id,
        educationLevel,
      });

      res.json(summary);
    } catch (error) {
      Logger.error("Error summarizing file", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        errorMessage: (error as Error).message,
      });

      if ((error as Error).message.includes('Request too large')) {
        return res.status(413).send("File is too large to summarize. Try breaking it into smaller sections.");
      }

      if ((error as Error).message.includes('Empty content')) {
        return res.status(400).send("Cannot summarize empty file content");
      }

      res.status(500).send("Failed to summarize file");
    }
  });

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
      const boardId = parseInt(req.params.id);

      // First delete all file tags
      await db
        .delete(fileTags)
        .where(
          eq(fileTags.fileId,
            db
              .select({ id: files.id })
              .from(files)
              .where(eq(files.boardId, boardId))
              .limit(1)
          )
        );

      // Then delete all files
      const deletedFiles = await db
        .delete(files)
        .where(eq(files.boardId, boardId))
        .returning();

      // Delete physical files
      for (const file of deletedFiles) {
        const filePath = path.join(process.cwd(), 'uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      Logger.info("Associated files deleted", {
        boardId: req.params.id,
        userId: req.user?.id,
      });

      // Delete all tiles
      await db
        .delete(tiles)
        .where(eq(tiles.boardId, boardId));

      Logger.info("Associated tiles deleted", {
        boardId: req.params.id,
        userId: req.user?.id,
      });

      // Delete all tags associated with this board
      await db
        .delete(tags)
        .where(eq(tags.boardId, boardId));

      Logger.info("Associated tags deleted", {
        boardId: req.params.id,
        userId: req.user?.id,
      });

      // Finally delete the board
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

      // Add tags to file
      for (const tagId of selectedTags) {
        await db
          .insert(fileTags)
          .values({
            fileId: fileRecord.id,
            tagId: tagId,
          });
      }

      res.json(fileRecord);
    } catch (error) {
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

      res.json(boardFiles);
    } catch (error) {
      res.status(500).send("Failed to fetch files");
    }
  });


  // Add tag to file endpoint
  app.post("/api/boards/:boardId/files/:fileId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tag addition attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        tagId: req.params.tagId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      Logger.info("Attempting to add tag to file", {
        fileId: req.params.fileId,
        tagId: req.params.tagId,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });

      // Check if the association already exists
      const existingAssociation = await db.query.fileTags.findFirst({
        where: (fileTags, { and, eq }) => and(
          eq(fileTags.fileId, parseInt(req.params.fileId)),
          eq(fileTags.tagId, parseInt(req.params.tagId))
        ),
      });

      if (existingAssociation) {
        Logger.info("Tag association already exists", {
          fileId: req.params.fileId,
          tagId: req.params.tagId,
          boardId: req.params.boardId,
        });
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

  // Remove tag from file endpoint
  app.delete("/api/boards/:boardId/files/:fileId/tags/:tagId", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized tag removal attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        tagId: req.params.tagId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      Logger.info("Attempting to remove tag from file", {
        fileId: req.params.fileId,
        tagId: req.params.tagId,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });

      const [deletedFileTag] = await db
        .delete(fileTags)
        .where(
          and(
            eq(fileTags.fileId, parseInt(req.params.fileId)),
            eq(fileTags.tagId, parseInt(req.params.tagId))
          )
        )
        .returning();

      if (!deletedFileTag) {
        Logger.warn("Tag association not found", {
          fileId: req.params.fileId,
          tagId: req.params.tagId,
          boardId: req.params.boardId,
        });
        return res.status(404).send("Tag association not found");
      }

      Logger.info("Tag removed from file successfully", {
        fileId: req.params.fileId,
        tagId: req.params.tagId,
        boardId: req.params.boardId,
        userId: req.user?.id,
      });
      res.json({ message: "Tag removed successfully" });
    } catch (error) {
      Logger.error("Error removing tag from file", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        tagId: req.params.tagId,
      });
      res.status(500).send("Failed to remove tag from file");    }
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

  // Summarize endpoint
  app.post("/api/boards/:boardId/files/:fileId/summarize", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      Logger.info("Starting file summarization", {
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        userId: req.user?.id,
      });

      const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, parseInt(req.params.fileId)))
        .limit(1);

      if (!file) {
        Logger.warn("File not found for summarization", {
          fileId: req.params.fileId,
          boardId: req.params.boardId,
        });
        return res.status(404).send("File not found");
      }

      const filePath = path.join(process.cwd(), 'uploads', file.filename);
      const content = await readFile(filePath, 'utf-8');

      const educationLevel = req.body.educationLevel || 'high_school';

      Logger.info("Summarizing file content", {
        fileId: req.params.fileId,
        contentLength: content.length,
        educationLevel,
      });

      const summary = await summarizeContent(content, educationLevel);

      Logger.info("File summarized successfully", {
        fileId: req.params.fileId,
        boardId: req.params.boardId,
        userId: req.user?.id,
        educationLevel,
      });

      res.json(summary);
    } catch (error) {
      Logger.error("Error summarizing file", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        fileId: req.params.fileId,
        errorMessage: (error as Error).message,
      });

      if ((error as Error).message.includes('Request too large')) {
        return res.status(413).send("File is too large to summarize. Try breaking it into smaller sections.");
      }

      if ((error as Error).message.includes('Empty content')) {
        return res.status(400).send("Cannot summarize empty file content");
      }

      res.status(500).send("Failed to summarize file");
    }
  });

  // Analyze files within a study unit
  app.post("/api/boards/:boardId/tiles/:tileId/analyze", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized study unit analysis attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        tileId: req.params.tileId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const level = req.query.level || 'high'; // Default to high school level if not specified

      // Get the study unit (tile)
      const [tile] = await db
        .select()
        .from(tiles)
        .where(eq(tiles.id, parseInt(req.params.tileId)))
        .limit(1);

      if (!tile) {
        return res.status(404).send("Study unit not found");
      }

      // Get files associated with this study unit via tags
      const studyUnitFiles = await db.query.files.findMany({
        where: (files, { exists, and, eq }) =>
          exists(
            db.select()
              .from(fileTags)
              .where(
                and(
                  eq(fileTags.fileId, files.id),
                  exists(
                    db.select()
                      .from(tags)
                      .where(
                        and(
                          eq(tags.id, fileTags.tagId),
                          eq(tags.name, tile.title),
                          eq(tags.isStudyUnitTag, true)
                        )
                      )
                  )
                )
              )
          ),
      });

      if (studyUnitFiles.length === 0) {
        return res.status(404).send("No files found in this study unit");
      }

      // Read all file contents
      const contents = await Promise.all(
        studyUnitFiles.map(async (file) => {
          const filePath = path.join(process.cwd(), 'uploads', file.filename);
          return readFile(filePath, 'utf-8');
        })
      );

      // Get combined analysis with specified education level
      const analysis = await analyzeContent(contents.join('\n\n--- Next Document ---\n\n'), level as string);

      // Update the tile with the analysis results
      await db
        .update(tiles)
        .set({
          notes: JSON.stringify({
            ...JSON.parse(tile.notes || '{}'),
            aiAnalysis: {
              summary: analysis.summary,
              explanation: analysis.explanation,
              analyzedAt: new Date().toISOString(),
              level,
            }
          })
        })
        .where(eq(tiles.id, parseInt(req.params.tileId)));

      Logger.info("Study unit content analyzed successfully", {
        tileId: req.params.tileId,
        boardId: req.params.boardId,
        fileCount: studyUnitFiles.length,
        level,
        userId: req.user?.id,
      });

      res.json(analysis);
    } catch (error) {
      Logger.error("Error analyzing study unit content", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        tileId: req.params.tileId,
      });
      res.status(500).send("Failed to analyze study unit content");
    }
  });

  // Generate quiz for a study unit
  app.post("/api/boards/:boardId/tiles/:tileId/quiz", async (req, res) => {
    if (!req.isAuthenticated()) {
      Logger.warn("Unauthorized study unit quiz generation attempt", {
        ip: req.ip,
        headers: req.headers,
        boardId: req.params.boardId,
        tileId: req.params.tileId,
      });
      return res.status(401).send("Not authenticated");
    }

    try {
      const level = req.query.level || 'high'; // Default to high school level if not specified

      // Get the study unit (tile)
      const [tile] = await db
        .select()
        .from(tiles)
        .where(eq(tiles.id, parseInt(req.params.tileId)))
        .limit(1);

      if (!tile) {
        return res.status(404).send("Study unit not found");
      }

      // Get files associated with this study unit via tags
      const studyUnitFiles = await db.query.files.findMany({
        where: (files, { exists, and, eq }) =>
          exists(
            db.select()
              .from(fileTags)
              .where(
                and(
                  eq(fileTags.fileId, files.id),
                  exists(
                    db.select()
                      .from(tags)
                      .where(
                        and(
                          eq(tags.id, fileTags.tagId),
                          eq(tags.name, tile.title),
                          eq(tags.isStudyUnitTag, true)
                        )
                      )
                  )
                )
              )
          ),
      });

      if (studyUnitFiles.length === 0) {
        return res.status(404).send("No files found in this study unit");
      }

      // Read all file contents
      const contents = await Promise.all(
        studyUnitFiles.map(async (file) => {
          const filePath = path.join(process.cwd(), 'uploads', file.filename);
          return readFile(filePath, 'utf-8');
        })
      );

      // Generate quiz based on combined content and education level
      const quiz = await generateQuiz(contents.join('\n\n--- Next Document ---\n\n'), level as string);

      // Store the quiz in the tile's notes
      await db
        .update(tiles)
        .set({
          notes: JSON.stringify({
            ...JSON.parse(tile.notes || '{}'),
            aiQuiz: {
              ...quiz,
              generatedAt: new Date().toISOString(),
              level,
            }
          })
        })
        .where(eq(tiles.id, parseInt(req.params.tileId)));

      Logger.info("Study unit quiz generated successfully", {
        tileId: req.params.tileId,
        boardId: req.params.boardId,
        fileCount: studyUnitFiles.length,
        level,
        userId: req.user?.id,
      });

      res.json(quiz);
    } catch (error) {
      Logger.error("Error generating study unit quiz", error as Error, {
        userId: req.user?.id,
        boardId: req.params.boardId,
        tileId: req.params.tileId,
      });
      res.status(500).send("Failed to generate study unit quiz");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}