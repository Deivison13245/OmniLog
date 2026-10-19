'use client';

import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  AiResult,
  Group,
  LibraryItem,
  LibraryStatus,
  MediaDetails,
  MediaItem,
  MediaSource,
} from './types';

interface Setting {
  key: string;
  value: unknown;
}

class OmniLogDatabase extends Dexie {
  items!: Table<LibraryItem, number, Omit<LibraryItem, 'id'>>;
  groups!: Table<Group, number, Omit<Group, 'id'>>;
  details!: Table<MediaDetails, string>;
  aiResults!: Table<AiResult, number, Omit<AiResult, 'id'>>;
  settings!: Table<Setting, string>;

  constructor() {
    super('omnilog');
    this.version(1).stores({
      items: '++id, status, addedAt, updatedAt',
      groups: '++id, name, createdAt',
      settings: '&key',
    });

    this.version(2).stores({
      items: '++id, status, addedAt, updatedAt, completedAt',
      groups: '++id, name, createdAt',
      details: '[source+externalId], fetchedAt',
      aiResults: '++id, createdAt',
      settings: '&key',
    }).upgrade((tx) => {
      // Migração suave para preencher completedAt estimado se já estava concluído
      return tx.table('items').toCollection().modify((item: LibraryItem) => {
        if (item.status === 'completed' && !item.completedAt) {
          item.completedAt = item.updatedAt || item.addedAt;
          item.completedAtEstimated = true;
        }
      });
    });
  }
}

export const libraryDb = new OmniLogDatabase();

export interface LibraryFilters {
  status?: LibraryStatus | 'all';
  type?: MediaItem['type'] | 'all';
  groupId?: number | 'all';
  sortBy?: 'added_at' | 'title';
  sortDir?: 'asc' | 'desc';
}

export async function getLibraryItems(): Promise<LibraryItem[]> {
  const [items, groups] = await Promise.all([
    libraryDb.items.toArray(),
    libraryDb.groups.toArray(),
  ]);
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  return items.map((item) => ({
    ...item,
    groups: (item.groups ?? [])
      .map((group) => groupsById.get(group.id))
      .filter((group): group is Group => group !== undefined),
  }));
}

export async function getLibraryGroups(): Promise<Group[]> {
  const [groups, items] = await Promise.all([
    libraryDb.groups.toArray(),
    libraryDb.items.toArray(),
  ]);
  const counts = new Map<number, number>();

  for (const item of items) {
    for (const group of item.groups ?? []) {
      counts.set(group.id, (counts.get(group.id) ?? 0) + 1);
    }
  }

  return groups.map((group) => ({ ...group, itemCount: counts.get(group.id) ?? 0 }));
}

export function useLibraryItems(filters: LibraryFilters = {}) {
  const {
    status = 'all',
    type = 'all',
    groupId = 'all',
    sortBy = 'added_at',
    sortDir = 'desc',
  } = filters;

  return useLiveQuery(async () => {
    let items = await getLibraryItems();
    if (status !== 'all') items = items.filter((item) => item.status === status);
    if (type !== 'all') items = items.filter((item) => item.media.type === type);
    if (groupId !== 'all') {
      items = items.filter((item) => item.groups?.some((group) => group.id === groupId));
    }

    const direction = sortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const comparison =
        sortBy === 'title'
          ? a.media.title.localeCompare(b.media.title)
          : a.addedAt.localeCompare(b.addedAt);
      return comparison * direction;
    });
    return items;
  }, [status, type, groupId, sortBy, sortDir]);
}

export function useLibraryGroups() {
  return useLiveQuery(() => getLibraryGroups(), []);
}

export function useAllLibraryItems() {
  return useLiveQuery(() => getLibraryItems(), []);
}

export function useLibraryItem(id: number) {
  return useLiveQuery(
    async () => (await getLibraryItems()).find((item) => item.id === id),
    [id]
  );
}

export function useLibraryItemByMedia(source: MediaSource, externalId: string) {
  return useLiveQuery(
    async () => {
      const items = await getLibraryItems();
      return items.find((item) => item.media.source === source && item.media.externalId === externalId);
    },
    [source, externalId]
  );
}

export async function addLibraryItem(
  media: MediaItem,
  initialStatus: LibraryStatus = 'backlog'
): Promise<number> {
  return libraryDb.transaction('rw', libraryDb.items, async () => {
    const existing = await libraryDb.items
      .filter(
        (item) =>
          item.media.source === media.source && item.media.externalId === media.externalId
      )
      .first();
    if (existing) return existing.id;

    const now = new Date().toISOString();
    // Extrai gêneros se já disponíveis
    const genres = Array.isArray(media.metadata?.genres)
      ? (media.metadata.genres as string[])
      : undefined;

    // Extrai totalProgress inicial baseado no tipo de mídia
    let totalProgress: number | undefined;
    if (media.metadata) {
      if (typeof media.metadata.episodes === 'number') totalProgress = media.metadata.episodes;
      else if (typeof media.metadata.chapters === 'number') totalProgress = media.metadata.chapters;
      else if (typeof media.metadata.pageCount === 'number') totalProgress = media.metadata.pageCount;
    }

    const item: Omit<LibraryItem, 'id'> = {
      mediaId: 0,
      status: initialStatus,
      rating: null,
      review: null,
      addedAt: now,
      updatedAt: now,
      startedAt: initialStatus === 'in_progress' ? now : undefined,
      completedAt: initialStatus === 'completed' ? now : undefined,
      genres,
      progress: 0,
      totalProgress,
      media: { ...media },
      groups: [],
    };
    const id = await libraryDb.items.add(item);
    await libraryDb.items.update(id, { mediaId: id });
    return id;
  });
}

export async function updateLibraryItem(
  id: number,
  update: Partial<Omit<LibraryItem, 'id' | 'media'>>
): Promise<void> {
  const item = await libraryDb.items.get(id);
  if (!item) throw new Error('Item não encontrado na biblioteca.');

  const now = new Date().toISOString();
  const nextUpdate: Partial<LibraryItem> = {
    ...update,
    updatedAt: now,
  };

  if (update.status === 'completed' && !item.completedAt) {
    nextUpdate.completedAt = now;
  }
  if (update.status === 'in_progress' && !item.startedAt) {
    nextUpdate.startedAt = now;
  }

  await libraryDb.items.update(id, nextUpdate);
}

export async function incrementItemProgress(id: number): Promise<void> {
  const item = await libraryDb.items.get(id);
  if (!item) throw new Error('Item não encontrado.');

  const current = item.progress ?? 0;
  const next = current + 1;
  const now = new Date().toISOString();

  const patch: Partial<LibraryItem> = {
    progress: next,
    updatedAt: now,
  };

  if (item.status === 'backlog') {
    patch.status = 'in_progress';
    if (!item.startedAt) patch.startedAt = now;
  }

  // Se completou a contagem total conhecida
  if (item.totalProgress && next >= item.totalProgress && item.status !== 'completed') {
    patch.status = 'completed';
    patch.completedAt = now;
  }

  await libraryDb.items.update(id, patch);
}

export async function deleteLibraryItem(id: number): Promise<void> {
  await libraryDb.items.delete(id);
}

export async function createGroup(name: string, color: string, itemId?: number): Promise<Group> {
  return libraryDb.transaction('rw', libraryDb.groups, libraryDb.items, async () => {
    const group: Omit<Group, 'id'> = {
      name,
      description: null,
      color,
      createdAt: new Date().toISOString(),
    };
    const id = await libraryDb.groups.add(group);
    const savedGroup = { ...group, id };

    if (itemId !== undefined) {
      const item = await libraryDb.items.get(itemId);
      if (!item) throw new Error('Item não encontrado na biblioteca.');
      await libraryDb.items.update(itemId, {
        groups: [...(item.groups ?? []), savedGroup],
        updatedAt: new Date().toISOString(),
      });
    }
    return savedGroup;
  });
}

export async function setItemGroup(
  itemId: number,
  groupId: number,
  selected: boolean
): Promise<void> {
  await libraryDb.transaction('rw', libraryDb.groups, libraryDb.items, async () => {
    const [item, group] = await Promise.all([
      libraryDb.items.get(itemId),
      libraryDb.groups.get(groupId),
    ]);
    if (!item || !group) throw new Error('Item ou grupo não encontrado.');

    const currentGroups = item.groups ?? [];
    const nextGroups = selected
      ? currentGroups.some((entry) => entry.id === groupId)
        ? currentGroups
        : [...currentGroups, group]
      : currentGroups.filter((entry) => entry.id !== groupId);
    await libraryDb.items.update(itemId, {
      groups: nextGroups,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function deleteGroup(groupId: number): Promise<void> {
  await libraryDb.transaction('rw', libraryDb.groups, libraryDb.items, async () => {
    const items = await libraryDb.items.toArray();
    await Promise.all(
      items
        .filter((item) => item.groups?.some((group) => group.id === groupId))
        .map((item) =>
          libraryDb.items.update(item.id, {
            groups: (item.groups ?? []).filter((group) => group.id !== groupId),
            updatedAt: new Date().toISOString(),
          })
        )
    );
    await libraryDb.groups.delete(groupId);
  });
}

export async function readSetting<T>(key: string): Promise<T | undefined> {
  const setting = await libraryDb.settings.get(key);
  return setting?.value as T | undefined;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await libraryDb.settings.put({ key, value });
}

// ---- Cache de Detalhes da Obra (MediaDetails) ----
export async function getCachedMediaDetails(
  source: MediaSource,
  externalId: string
): Promise<MediaDetails | undefined> {
  try {
    const entry = await libraryDb.details.where('[source+externalId]').equals([source, externalId]).first();
    if (!entry) return undefined;

    // Verificar TTL: 30 dias para dados gerais
    const ageMs = Date.now() - new Date(entry.fetchedAt).getTime();
    if (ageMs > 30 * 24 * 60 * 60 * 1000) {
      return undefined;
    }
    return entry;
  } catch {
    return undefined;
  }
}

export async function saveCachedMediaDetails(details: MediaDetails): Promise<void> {
  try {
    await libraryDb.details.put(details);
  } catch (err) {
    console.warn('Falha ao salvar detalhes no cache local:', err);
  }
}

// ---- Cache de Resultados da IA ----
export async function getLatestAiResult(): Promise<AiResult | undefined> {
  try {
    const list = await libraryDb.aiResults.orderBy('createdAt').reverse().limit(1).toArray();
    if (list.length === 0) return undefined;
    const latest = list[0];
    // Validade de 24 horas
    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      return undefined;
    }
    return latest;
  } catch {
    return undefined;
  }
}

export async function saveAiResult(result: Omit<AiResult, 'id'>): Promise<number> {
  return libraryDb.aiResults.add(result);
}

// ---- Importação e Exportação ----
export async function importLibraryData(
  save: { items: LibraryItem[]; groups: Group[] },
  mode: 'replace' | 'merge'
): Promise<void> {
  await libraryDb.transaction('rw', libraryDb.items, libraryDb.groups, async () => {
    if (mode === 'replace') {
      await libraryDb.items.clear();
      await libraryDb.groups.clear();
    }

    const existingGroups = await libraryDb.groups.toArray();
    const groupByName = new Map(existingGroups.map((group) => [group.name.toLocaleLowerCase(), group]));
    const groupIdMap = new Map<number, number>();

    for (const incoming of save.groups) {
      const existing = groupByName.get(incoming.name.toLocaleLowerCase());
      if (mode === 'merge' && existing) {
        groupIdMap.set(incoming.id, existing.id);
        continue;
      }

      const id = mode === 'replace' && incoming.id > 0 ? incoming.id : undefined;
      const savedId = await libraryDb.groups.add({
        ...incoming,
        ...(id === undefined ? {} : { id }),
      });
      groupIdMap.set(incoming.id, savedId);
      groupByName.set(incoming.name.toLocaleLowerCase(), { ...incoming, id: savedId });
    }

    const existingItems = mode === 'merge' ? await libraryDb.items.toArray() : [];
    const existingByMediaKey = new Map(
      existingItems.map((item) => [`${item.media.source}:${item.media.externalId}`, item])
    );

    for (const incoming of save.items) {
      const mediaKey = `${incoming.media.source}:${incoming.media.externalId}`;
      const mappedGroups = (incoming.groups ?? [])
        .map((group) => {
          const id = groupIdMap.get(group.id) ?? groupByName.get(group.name.toLocaleLowerCase())?.id;
          return id === undefined ? undefined : libraryDb.groups.get(id);
        });
      const resolvedGroups = (await Promise.all(mappedGroups)).filter(
        (group): group is Group => group !== undefined
      );
      const existingItem = mode === 'merge' ? existingByMediaKey.get(mediaKey) : undefined;
      if (existingItem) {
        const mergedGroups = [...(existingItem.groups ?? [])];
        for (const group of resolvedGroups) {
          if (!mergedGroups.some((existing) => existing.id === group.id)) mergedGroups.push(group);
        }
        if (mergedGroups.length !== (existingItem.groups ?? []).length) {
          await libraryDb.items.update(existingItem.id, {
            groups: mergedGroups,
            updatedAt: new Date().toISOString(),
          });
        }
        continue;
      }

      const itemId = mode === 'replace' && incoming.id > 0 ? incoming.id : undefined;
      const savedId = await libraryDb.items.add({
        ...incoming,
        ...(itemId === undefined ? {} : { id: itemId }),
        mediaId: itemId ?? incoming.mediaId,
        groups: resolvedGroups,
      });
      await libraryDb.items.update(savedId, { mediaId: savedId });
      existingByMediaKey.set(mediaKey, { ...incoming, id: savedId, mediaId: savedId });
    }
  });
}
