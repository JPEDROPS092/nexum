import { mysqlTable, varchar, text, int, timestamp, longtext, index } from "drizzle-orm/mysql-core";

export const sources = mysqlTable("sources", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 12 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url"),
  content: longtext("content").notNull(),
  charCount: int("char_count").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("sources_workspace_idx").on(table.workspaceId)]);

export const trails = mysqlTable("trails", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  topic: varchar("topic", { length: 255 }).notNull(),
  language: varchar("language", { length: 8 }).notNull(),
  level: varchar("level", { length: 24 }).notNull(),
  lessonJson: longtext("lesson_json").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [index("trails_workspace_idx").on(table.workspaceId)]);

export const progress = mysqlTable("learning_progress", {
  id: varchar("id", { length: 80 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 64 }).notNull(),
  trailId: varchar("trail_id", { length: 36 }).notNull(),
  stepIndex: int("step_index").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
}, (table) => [index("progress_workspace_idx").on(table.workspaceId)]);
