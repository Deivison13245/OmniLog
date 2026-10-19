'use client';

import { z } from 'zod';
import { getLibraryItems, importLibraryData, libraryDb, readSetting } from './library-db';
import type { Group, LibraryItem, MediaItem } from './types';

export const SAVE_FILE_NAME = 'omnilog-save.json';
export const SAVE_FILE_VERSION = 3;
const sources = ['igdb', 'tmdb', 'anilist', 'openlibrary', 'googlebooks'] as const;
const mediaTypes = ['game', 'movie', 'tv', 'anime', 'manga', 'book'] as const;
const statuses = ['backlog', 'in_progress', 'completed', 'dropped'] as const;

const metadataSchema = z.union([z.record(z.string(), z.unknown()), z.null()]).optional();
const mediaSchema = z.object({
  id: z.number().optional(),
  source: z.enum(sources),
  externalId: z.string().min(1),
  type: z.enum(mediaTypes),
  title: z.string().min(1),
  year: z.number().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  metadata: metadataSchema,
});
const groupSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
const itemSchema = z.object({
  id: z.number().optional(),
  mediaId: z.number().optional(),
  status: z.enum(statuses),
  rating: z.number().int().min(1).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  addedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  completedAtEstimated: z.boolean().optional(),
  genres: z.array(z.string()).optional(),
  progress: z.number().optional(),
  totalProgress: z.number().optional(),
  playtimeHours: z.number().optional(),
  hltbOverrideId: z.number().optional(),
  media: mediaSchema,
  groups: z.array(groupSchema).optional(),
});
const currentSaveSchema = z.object({
  app: z.literal('OmniLog'),
  version: z.number().int().min(1).max(SAVE_FILE_VERSION),
  exportedAt: z.string().optional(),
  items: z.array(itemSchema),
  groups: z.array(groupSchema),
});

const legacyMediaSchema = z.object({
  id: z.number().optional(),
  source: z.enum(sources),
  externalId: z.string().min(1),
  type: z.enum(mediaTypes),
  title: z.string().min(1),
  year: z.number().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  metadata: z.union([z.string(), z.record(z.string(), z.unknown()), z.null()]).optional(),
  fetchedAt: z.string().optional(),
});
const legacyLibraryItemSchema = z.object({
  id: z.number().optional(),
  mediaId: z.number(),
  status: z.enum(statuses),
  rating: z.number().int().min(1).max(10).nullable().optional(),
  review: z.string().nullable().optional(),
  addedAt: z.string(),
  updatedAt: z.string(),
});
const legacySaveSchema = z.object({
  version: z.number().int().min(1).max(1),
  appName: z.literal('OmniLog').optional(),
  exportedAt: z.string().optional(),
  data: z.object({
    media: z.array(legacyMediaSchema),
    libraryItems: z.array(legacyLibraryItemSchema),
    groups: z.array(groupSchema).optional(),
    libraryItemGroups: z
      .array(z.object({ libraryItemId: z.number(), groupId: z.number() }))
      .optional(),
  }),
});

export interface SaveFile {
  app: 'OmniLog';
  version: number;
  exportedAt: string;
  items: LibraryItem[];
  groups: Group[];
}

export interface SaveFileHandle {
  createWritable(): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
}

function normalizeMetadata(value: unknown): MediaItem['metadata'] {
  if (typeof value !== 'string') return (value as MediaItem['metadata']) ?? null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || (typeof parsed === 'object' && !Array.isArray(parsed))) {
      return parsed as Record<string, unknown> | null;
    }
  } catch {
    throw new Error('O arquivo contém metadados de mídia inválidos.');
  }
  throw new Error('O arquivo contém metadados de mídia em formato inválido.');
}

function normalizeGroup(group: z.infer<typeof groupSchema>, fallbackId: number): Group {
  return {
    id: group.id ?? fallbackId,
    name: group.name,
    description: group.description ?? null,
    color: group.color ?? null,
    createdAt: group.createdAt ?? new Date(0).toISOString(),
  };
}

export function parseSaveFile(raw: unknown): SaveFile {
  const current = currentSaveSchema.safeParse(raw);
  if (current.success) {
    const groups = current.data.groups.map((group, index) => normalizeGroup(group, index + 1));
    const groupsById = new Map(groups.map((group) => [group.id, group]));
    const items = current.data.items.map((item, index): LibraryItem => {
      const media: MediaItem = {
        id: item.media.id,
        source: item.media.source,
        externalId: item.media.externalId,
        type: item.media.type,
        title: item.media.title,
        year: item.media.year ?? null,
        coverUrl: item.media.coverUrl ?? null,
        metadata: item.media.metadata ?? null,
      };
      const itemGroups = (item.groups ?? []).map((group, groupIndex) =>
        normalizeGroup(group, groupIndex + 1)
      );
      for (const group of itemGroups) {
        if (!groupsById.has(group.id)) groupsById.set(group.id, group);
      }
      return {
        id: item.id ?? index + 1,
        mediaId: item.mediaId ?? item.media.id ?? item.id ?? index + 1,
        status: item.status,
        rating: item.rating ?? null,
        review: item.review ?? null,
        addedAt: item.addedAt ?? new Date(0).toISOString(),
        updatedAt: item.updatedAt ?? item.addedAt ?? new Date(0).toISOString(),
        media,
        groups: itemGroups,
      };
    });

    return {
      app: 'OmniLog',
      version: SAVE_FILE_VERSION,
      exportedAt: current.data.exportedAt ?? new Date().toISOString(),
      items,
      groups: [...groupsById.values()],
    };
  }

  const legacy = legacySaveSchema.safeParse(raw);
  if (!legacy.success) {
    throw new Error('Arquivo de save inválido ou incompatível com o OmniLog.');
  }

  const sourceMedia = new Map<number, MediaItem>();
  legacy.data.data.media.forEach((record, index) => {
    const media: MediaItem = {
      id: record.id ?? index + 1,
      source: record.source,
      externalId: record.externalId,
      type: record.type,
      title: record.title,
      year: record.year ?? null,
      coverUrl: record.coverUrl ?? null,
      metadata: normalizeMetadata(record.metadata),
    };
    sourceMedia.set(record.id ?? index + 1, media);
  });

  const groups = (legacy.data.data.groups ?? []).map((group, index) =>
    normalizeGroup(group, index + 1)
  );
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupIdsByItem = new Map<number, number[]>();
  for (const link of legacy.data.data.libraryItemGroups ?? []) {
    if (!groupsById.has(link.groupId)) {
      throw new Error('O arquivo de save contém uma associação para um grupo inexistente.');
    }
    const groupIds = groupIdsByItem.get(link.libraryItemId) ?? [];
    groupIds.push(link.groupId);
    groupIdsByItem.set(link.libraryItemId, groupIds);
  }

  const items: LibraryItem[] = legacy.data.data.libraryItems.map((record, index) => {
    const media = sourceMedia.get(record.mediaId);
    if (!media) {
      throw new Error('O arquivo de save referencia uma mídia inexistente.');
    }
    const id = record.id ?? index + 1;
    const groupIds = groupIdsByItem.get(id) ?? [];
    const itemGroups = groupIds.map((groupId) => {
      const group = groupsById.get(groupId);
      if (!group) {
        throw new Error('O arquivo de save referencia um grupo inexistente.');
      }
      return group;
    });
    return {
      id,
      mediaId: record.mediaId,
      status: record.status,
      rating: record.rating ?? null,
      review: record.review ?? null,
      addedAt: record.addedAt,
      updatedAt: record.updatedAt,
      media,
      groups: itemGroups,
    };
  });
  const libraryItemIds = new Set(legacy.data.data.libraryItems.map((item, index) => item.id ?? index + 1));
  if ([...groupIdsByItem.keys()].some((itemId) => !libraryItemIds.has(itemId))) {
    throw new Error('O arquivo de save contém um grupo associado a um item inexistente.');
  }

  return {
    app: 'OmniLog',
    version: SAVE_FILE_VERSION,
    exportedAt: legacy.data.exportedAt ?? new Date().toISOString(),
    items,
    groups,
  };
}

export function createSaveFile(items: LibraryItem[], groups: Group[]): SaveFile {
  return {
    app: 'OmniLog',
    version: SAVE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      color: group.color,
      createdAt: group.createdAt,
    })),
  };
}

export function serializeSaveFile(save: SaveFile): string {
  return JSON.stringify(save, null, 2);
}

export async function importSaveFile(
  raw: unknown,
  mode: 'replace' | 'merge'
): Promise<SaveFile> {
  const save = parseSaveFile(raw);
  await importLibraryData(save, mode);
  return save;
}

export async function rememberSavedNow(items?: LibraryItem[], groups?: Group[]): Promise<void> {
  await libraryDb.settings.bulkPut([
    { key: 'lastSavedAt', value: new Date().toISOString() },
    ...(items && groups
      ? [{ key: 'lastSavedSnapshot', value: JSON.stringify({ items, groups }) }]
      : []),
  ]);
}

export async function getLastSavedAt(): Promise<string | undefined> {
  return readSetting<string>('lastSavedAt');
}

export async function getSaveFileHandle(): Promise<FileSystemFileHandle | undefined> {
  const handle = await readSetting<unknown>('saveFileHandle');
  if (handle && typeof handle === 'object' && 'createWritable' in handle) {
    return handle as FileSystemFileHandle;
  }
  return undefined;
}

export async function writeSaveFile(
  handle: SaveFileHandle,
  items: LibraryItem[],
  groups: Group[]
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(serializeSaveFile(createSaveFile(items, groups)));
  await writable.close();
  await rememberSavedNow(items, groups);
}

export async function chooseSaveFile(): Promise<void> {
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker) throw new Error('Este navegador não permite vincular um arquivo de save.');

  const handle = await picker({
    suggestedName: SAVE_FILE_NAME,
    types: [{ description: 'Save do OmniLog', accept: { 'application/json': ['.json'] } }],
  });
  await libraryDb.settings.put({ key: 'saveFileHandle', value: handle });
  const [items, groups] = await Promise.all([
    getLibraryItems(),
    libraryDb.groups.toArray(),
  ]);
  await writeSaveFile(handle, items, groups);
}

export async function downloadSaveFile(items: LibraryItem[], groups: Group[]): Promise<void> {
  const blob = new Blob([serializeSaveFile(createSaveFile(items, groups))], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = SAVE_FILE_NAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  await rememberSavedNow(items, groups);
}

export async function readSaveFile(file: File): Promise<SaveFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo selecionado não contém JSON válido.');
  }
  return parseSaveFile(raw);
}

export async function chooseOpenSaveFile(): Promise<File | undefined> {
  const picker = (window as FilePickerWindow).showOpenFilePicker;
  if (!picker) return undefined;

  const [handle] = await picker({
    multiple: false,
    types: [{ description: 'Save do OmniLog', accept: { 'application/json': ['.json'] } }],
  });
  return handle?.getFile();
}
