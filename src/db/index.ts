import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'omnilog.db');

// Garantir que a pasta do banco existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

// Inicializar tabelas e índices se ainda não existirem
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS media (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source        TEXT NOT NULL CHECK (source IN ('igdb','tmdb','anilist','openlibrary','googlebooks')),
    external_id   TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('game','movie','tv','anime','manga','book')),
    title         TEXT NOT NULL,
    year          INTEGER,
    cover_url     TEXT,
    metadata      TEXT,
    fetched_at    TEXT NOT NULL,
    UNIQUE (source, external_id)
  );

  CREATE TABLE IF NOT EXISTS library_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id    INTEGER NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'backlog'
                CHECK (status IN ('backlog','in_progress','completed','dropped')),
    rating      INTEGER CHECK (rating BETWEEN 1 AND 10),
    review      TEXT,
    added_at    TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS library_item_groups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    library_item_id INTEGER NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
    group_id        INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE (library_item_id, group_id)
  );

  CREATE INDEX IF NOT EXISTS idx_library_status ON library_items (status);
  CREATE INDEX IF NOT EXISTS idx_library_added  ON library_items (added_at);
  CREATE INDEX IF NOT EXISTS idx_media_type     ON media (type);
  CREATE INDEX IF NOT EXISTS idx_item_groups    ON library_item_groups (group_id);
`);

export const db = drizzle(sqlite, { schema });
