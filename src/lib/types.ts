export type MediaType = 'game' | 'movie' | 'tv' | 'anime' | 'manga' | 'book';
export type MediaSource = 'igdb' | 'tmdb' | 'anilist' | 'openlibrary' | 'googlebooks';
export type LibraryStatus = 'backlog' | 'in_progress' | 'completed' | 'dropped';

export interface MediaItem {
  id?: number;
  source: MediaSource;
  externalId: string;
  type: MediaType;
  title: string;
  year: number | null;
  coverUrl: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  itemCount?: number;
}

export interface LibraryItem {
  id: number;
  mediaId: number;
  status: LibraryStatus;
  rating: number | null;
  review: string | null;
  addedAt: string;
  updatedAt: string;
  media: MediaItem;
  groups?: Group[];
}

export interface SearchResponse {
  items: MediaItem[];
  failedSources: MediaSource[];
}

export type SearchFilter = 'all' | 'game' | 'video' | 'anime' | 'manga' | 'book';

