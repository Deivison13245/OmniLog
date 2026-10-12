import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const media = sqliteTable(
  'media',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source', {
      enum: ['igdb', 'tmdb', 'anilist', 'openlibrary', 'googlebooks'],
    }).notNull(),
    externalId: text('external_id').notNull(),
    type: text('type', {
      enum: ['game', 'movie', 'tv', 'anime', 'manga', 'book'],
    }).notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    coverUrl: text('cover_url'),
    metadata: text('metadata'), // JSON stringified
    fetchedAt: text('fetched_at').notNull(),
  },
  (table) => [
    uniqueIndex('source_external_id_idx').on(table.source, table.externalId),
  ]
);

export const libraryItems = sqliteTable('library_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mediaId: integer('media_id')
    .notNull()
    .unique()
    .references(() => media.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['backlog', 'in_progress', 'completed', 'dropped'],
  })
    .notNull()
    .default('backlog'),
  rating: integer('rating'),
  review: text('review'),
  addedAt: text('added_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  createdAt: text('created_at').notNull(),
});

export const libraryItemGroups = sqliteTable(
  'library_item_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    libraryItemId: integer('library_item_id')
      .notNull()
      .references(() => libraryItems.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('item_group_idx').on(table.libraryItemId, table.groupId),
  ]
);

export type MediaRecord = typeof media.$inferSelect;
export type InsertMediaRecord = typeof media.$inferInsert;
export type LibraryItemRecord = typeof libraryItems.$inferSelect;
export type InsertLibraryItemRecord = typeof libraryItems.$inferInsert;
export type GroupRecord = typeof groups.$inferSelect;
export type InsertGroupRecord = typeof groups.$inferInsert;
export type LibraryItemGroupRecord = typeof libraryItemGroups.$inferSelect;
export type InsertLibraryItemGroupRecord = typeof libraryItemGroups.$inferInsert;

