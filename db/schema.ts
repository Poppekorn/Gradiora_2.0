import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  professor: text("professor"),
  schedule: text("schedule"),
  syllabus: text("syllabus_url"),
  overallGrade: text("overall_grade"),
  isArchived: boolean("is_archived").default(false),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tiles = pgTable("tiles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: text("status").default("not_started"),
  priority: text("priority").default("medium"),
  tags: text("tags").array(),
  attachments: jsonb("attachments").default([]),
  grade: text("grade"),
  externalLinks: jsonb("external_links").default([]),
  notes: text("notes"),
  boardId: integer("board_id").references(() => boards.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  boards: many(boards),
}));

export const boardsRelations = relations(boards, ({ many, one }) => ({
  tiles: many(tiles),
  organization: one(organizations, {
    fields: [boards.organizationId],
    references: [organizations.id],
  }),
}));

export const tilesRelations = relations(tiles, ({ one }) => ({
  board: one(boards, {
    fields: [tiles.boardId],
    references: [boards.id],
  }),
}));

// Schema validation and type exports
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export const insertBoardSchema = createInsertSchema(boards);
export const selectBoardSchema = createSelectSchema(boards);
export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;

export const insertTileSchema = createInsertSchema(tiles);
export const selectTileSchema = createSelectSchema(tiles);
export type Tile = typeof tiles.$inferSelect;
export type NewTile = typeof tiles.$inferInsert;

// Aliases for backward compatibility
export type InsertUser = NewUser;
export type SelectUser = User;