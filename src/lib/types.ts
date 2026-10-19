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
  startedAt?: string;
  completedAt?: string;
  completedAtEstimated?: boolean;
  genres?: string[];
  progress?: number; // Episódio, capítulo, página ou horas jogadas
  totalProgress?: number; // Total de episódios, capítulos, páginas ou horas
  playtimeHours?: number; // Horas jogadas registradas pelo usuário
  hltbOverrideId?: number; // ID manual caso correspondência HLTB seja corrigida
  media: MediaItem;
  groups?: Group[];
}

export interface RelatedWork {
  source: MediaSource;
  externalId: string;
  type: MediaType;
  title: string;
  year?: number | null;
  coverUrl?: string | null;
}

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath?: string;
}

export interface TimeToBeat {
  source: 'hltb' | 'igdb';
  sourceId?: string;
  sourceUrl?: string;
  fetchedAt: string;
  mainStory?: number;
  mainPlusExtras?: number;
  completionist?: number;
  allStyles?: number;
  rushed?: number;
  normal?: number;
  complete?: number;
}

export interface MediaDetails {
  source: MediaSource;
  externalId: string;
  type: MediaType;
  title: string;
  year?: number | null;
  coverUrl?: string | null;
  fetchedAt: string;
  synopsis?: string;
  genres?: string[];
  platforms?: { id: number; name: string; releaseDate?: string; family?: string }[];
  franchise?: { id: number; name: string };
  collection?: { id: number; name: string; works: RelatedWork[] };
  relations?: { type: string; work: RelatedWork }[];
  externalLinks?: { site: string; url: string }[];
  timeToBeat?: TimeToBeat;
  hltbOverrideId?: number;
  streaming?: {
    region: string;
    fetchedAt: string;
    tmdbLink?: string;
    flatrate: StreamingProvider[];
    rent: StreamingProvider[];
    buy: StreamingProvider[];
  };
}

export interface AiRecommendedItem {
  media: MediaItem;
  reason: string;
  basedOn?: string[];
}

export interface AiResult {
  id?: number;
  createdAt: string;
  profileHash: string;
  request: {
    type: string;
    count: number;
    note?: string;
  };
  items: AiRecommendedItem[];
}

export interface SearchResponse {
  items: MediaItem[];
  failedSources: MediaSource[];
}

export type SearchFilter = 'all' | 'game' | 'video' | 'anime' | 'manga' | 'book';
