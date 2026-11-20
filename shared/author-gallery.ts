export type GalleryEntry = {
  id: string;
  title: string;
  caption: string;
  kind: 'achievement' | 'launch' | 'gallery';
  eventDate: string | null;
  revealedBy: string;
  published: boolean;
  revision: number;
  hasImage: boolean;
};

export type BookChannel = { bookId: string; publisher: string; publisherUrl: string; amazonUrl: string };
