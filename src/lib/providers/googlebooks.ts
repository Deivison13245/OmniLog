import { MediaItem } from '../types';
import { booksLimiter } from '../rate-limit';

interface GoogleBookItem {
  id: string;
  volumeInfo: {
    title: string;
    publishedDate?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    authors?: string[];
    description?: string;
  };
}

export async function searchGoogleBooks(query: string): Promise<MediaItem[]> {
  return booksLimiter(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
      const keyParam = apiKey ? `&key=${apiKey}` : '';
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12${keyParam}`;

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Google Books returned status ${response.status}`);
      }

      const data = await response.json();
      const items: GoogleBookItem[] = data?.items || [];

      return items.map((item): MediaItem => {
        let year: number | null = null;
        if (item.volumeInfo.publishedDate) {
          const parsedYear = parseInt(item.volumeInfo.publishedDate.substring(0, 4), 10);
          if (!isNaN(parsedYear)) year = parsedYear;
        }

        let coverUrl = item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail || null;
        if (coverUrl && coverUrl.startsWith('http://')) {
          coverUrl = coverUrl.replace('http://', 'https://');
        }

        return {
          source: 'googlebooks',
          externalId: item.id,
          type: 'book',
          title: item.volumeInfo.title,
          year,
          coverUrl,
          metadata: {
            authors: item.volumeInfo.authors?.join(', '),
            description: item.volumeInfo.description,
          },
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}
