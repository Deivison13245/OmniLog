import { MediaItem } from '../types';
import { booksLimiter } from '../rate-limit';

interface OpenLibraryDoc {
  key: string; // ex: "/works/OL12345W"
  title: string;
  first_publish_year?: number;
  cover_i?: number;
  author_name?: string[];
}

export async function searchOpenLibrary(query: string): Promise<MediaItem[]> {
  return booksLimiter(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12&fields=key,title,first_publish_year,cover_i,author_name`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`OpenLibrary returned status ${response.status}`);
      }

      const data = await response.json();
      const docs: OpenLibraryDoc[] = data?.docs || [];

      return docs.map((doc): MediaItem => {
        const externalId = doc.key.replace('/works/', '');
        const coverUrl = doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
          : null;

        return {
          source: 'openlibrary',
          externalId,
          type: 'book',
          title: doc.title,
          year: doc.first_publish_year || null,
          coverUrl,
          metadata: {
            author: doc.author_name ? doc.author_name.join(', ') : undefined,
          },
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}
