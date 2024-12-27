import { pgTable, text, serial, integer, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Base tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
  studyPreferences: jsonb("study_preferences").default({
    preferredStudyTime: "morning",
    studySessionDuration: 25,
    breakDuration: 5,
    dailyStudyGoal: 120,
    focusLevel: "medium"
  }),
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
  organizationId: integer("organization_id"),
  createdAt: timestamp("created_at").defaultNow(),
  difficulty: text("difficulty").default("medium"),
  estimatedStudyHours: integer("estimated_study_hours"),
  recommendedSessionDuration: integer("recommended_session_duration"),
  color: text("color").default("#E2E8F0"),
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
  estimatedDuration: integer("estimated_duration"),
  actualDuration: integer("actual_duration"),
  complexity: text("complexity").default("medium"),
  recommendedTimeOfDay: text("recommended_time_of_day"),
  optimalStudyOrder: integer("optimal_study_order"),
  color: text("color").default("#E2E8F0"),
});

export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  boardId: integer("board_id").references(() => boards.id).notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  boardId: integer("board_id").references(() => boards.id).notNull(),
  isStudyUnitTag: boolean("is_study_unit_tag").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fileTags = pgTable("file_tags", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id).notNull(),
  tagId: integer("tag_id").references(() => tags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiQuota = pgTable("api_quota", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  callCount: integer("call_count").notNull().default(0),
  quotaLimit: integer("quota_limit").notNull().default(100000),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdUnique: unique().on(table.userId),
}));

export const fileSummaries = pgTable("file_summaries", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id).notNull(),
  summary: text("summary").notNull(),
  explanation: text("explanation").notNull(),
  educationLevel: text("education_level").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fileEducationUnique: unique().on(table.fileId, table.educationLevel),
}));

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  boards: many(boards),
}));

export const boardsRelations = relations(boards, ({ many, one }) => ({
  tiles: many(tiles),
  files: many(files),
  tags: many(tags),
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

export const filesRelations = relations(files, ({ many, one }) => ({
  tags: many(fileTags),
  summaries: many(fileSummaries),
  board: one(boards, {
    fields: [files.boardId],
    references: [boards.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many, one }) => ({
  files: many(fileTags),
  board: one(boards, {
    fields: [tags.boardId],
    references: [boards.id],
  }),
}));

export const fileTagsRelations = relations(fileTags, ({ one }) => ({
  file: one(files, {
    fields: [fileTags.fileId],
    references: [files.id],
  }),
  tag: one(tags, {
    fields: [fileTags.tagId],
    references: [tags.id],
  }),
}));

// Types and Schemas
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;

export type Tile = typeof tiles.$inferSelect;
export type NewTile = typeof tiles.$inferInsert;

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

export type FileTag = typeof fileTags.$inferSelect;
export type NewFileTag = typeof fileTags.$inferInsert;

export type ApiQuota = typeof apiQuota.$inferSelect;
export type NewApiQuota = typeof apiQuota.$inferInsert;

export type FileSummary = typeof fileSummaries.$inferSelect;
export type NewFileSummary = typeof fileSummaries.$inferInsert;

// Validation Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);

export const insertBoardSchema = createInsertSchema(boards);
export const selectBoardSchema = createSelectSchema(boards);

export const insertTileSchema = createInsertSchema(tiles);
export const selectTileSchema = createSelectSchema(tiles);

export const insertFileSchema = createInsertSchema(files);
export const selectFileSchema = createSelectSchema(files);

export const insertTagSchema = createInsertSchema(tags);
export const selectTagSchema = createSelectSchema(tags);

export const insertFileTagSchema = createInsertSchema(fileTags);
export const selectFileTagSchema = createSelectSchema(fileTags);

export const insertApiQuotaSchema = createInsertSchema(apiQuota);
export const selectApiQuotaSchema = createSelectSchema(apiQuota);

export const insertFileSummarySchema = createInsertSchema(fileSummaries);
export const selectFileSummarySchema = createSelectSchema(fileSummaries);

// Backward compatibility aliases
export type InsertUser = NewUser;
export type SelectUser = User;