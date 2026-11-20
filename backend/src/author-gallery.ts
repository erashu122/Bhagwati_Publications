import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Request } from 'express';
import type { GalleryEntry, BookChannel } from '../../shared/author-gallery.ts';
import type { StoreDatabase } from './database-driver.ts';
import { field, record, RequestError, uuidField } from './validation.ts';

const columns = `id, title, caption, kind, to_char(event_date, 'YYYY-MM-DD') AS "eventDate",
  revealed_by AS "revealedBy", published, revision, image_bytes IS NOT NULL AS "hasImage"`;
const optional = (v: unknown, label: string, max: number) => v === '' ? '' : field(v, label, max);
function link(value: unknown, amazon = false) {
  const raw = optional(value, 'website link', 600);
  if (!raw) return '';
  let url: URL;
  try { url = new URL(raw); } catch { throw new RequestError(400, 'Enter a full HTTPS link.'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      (amazon && !['amazon.in', 'www.amazon.in', 'amazon.com', 'www.amazon.com', 'amzn.in', 'amzn.to'].includes(url.hostname))) {
    throw new RequestError(400, 'Use HTTPS links. Amazon links must use Amazon or its short-link domains.');
  }
  return url.href;
}
export function authorGalleryRouter(db: StoreDatabase, requireAdmin: (request: Request) => Promise<unknown>) {
  const router = express.Router();
  router.get('/author-gallery', async (_req, res) => {
    const { rows } = await db.query<GalleryEntry>(`SELECT ${columns} FROM author_gallery WHERE published ORDER BY event_date DESC NULLS LAST, created_at DESC LIMIT 100`);
    res.json({ entries: rows });
  });
  router.get('/author-gallery/:id/image', async (req, res) => {
    const id = uuidField(req.params.id);
    const { rows: [entry] } = await db.query<{ published: boolean; image_type: string; image_bytes: Uint8Array; revision: number }>(
      'SELECT published, image_type, image_bytes, revision FROM author_gallery WHERE id=$1', [id]);
    if (!entry) throw new RequestError(404, 'Photo not found.');
    if (!entry.published) await requireAdmin(req);
    if (!entry.image_bytes) throw new RequestError(404, 'Photo not found.');
    res.set('Cache-Control', entry.published ? 'public, max-age=300' : 'no-store')
      .type(entry.image_type).send(Buffer.from(entry.image_bytes));
  });
  router.get('/book-channels', async (_req, res) => {
    const { rows } = await db.query<BookChannel>(`SELECT bc.book_id AS "bookId", bc.publisher, bc.publisher_url AS "publisherUrl", bc.amazon_url AS "amazonUrl"
      FROM book_channels bc JOIN books b ON b.id=bc.book_id WHERE b.published`);
    res.json({ channels: rows });
  });
  router.get('/publisher/book-channels', async (req, res) => {
    await requireAdmin(req);
    const { rows } = await db.query<BookChannel>('SELECT book_id AS "bookId", publisher, publisher_url AS "publisherUrl", amazon_url AS "amazonUrl" FROM book_channels');
    res.json({ channels: rows });
  });
  router.use('/publisher/author-gallery', async (req, _res, next) => { await requireAdmin(req); next(); });
  router.get('/publisher/author-gallery', async (_req, res) => {
    const { rows } = await db.query<GalleryEntry>(`SELECT ${columns} FROM author_gallery ORDER BY event_date DESC NULLS LAST, created_at DESC LIMIT 100`);
    res.json({ entries: rows });
  });
  router.patch('/publisher/author-gallery/:id/image', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '1mb' }), async (req, res) => {
    const id = uuidField(req.params.id);
    const bytes = req.body;
    const type = req.get('Content-Type')?.split(';')[0];
    const valid = Buffer.isBuffer(bytes) && bytes.length >= 12 && (
      type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
      type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
      type === 'image/webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
    );
    if (!valid) throw new RequestError(400, 'Upload a JPG, PNG or WebP photo up to 1 MB.');
    const { rows } = await db.query('UPDATE author_gallery SET image_bytes=$2, image_type=$3, revision=revision+1 WHERE id=$1 RETURNING id', [id, bytes, type]);
    if (!rows.length) throw new RequestError(404, 'Gallery item not found.');
    res.json({ ok: true });
  });
  router.use(['/publisher/author-gallery', '/publisher/book-channels', '/publisher/enquiries/:id/read'], express.json({ limit: '8kb' }));
  router.post('/publisher/author-gallery', async (req, res) => {
    const b = record(req.body);
    const title = field(b.title, 'title', 180);
    const caption = optional(b.caption, 'caption', 1500);
    const revealedBy = optional(b.revealedBy, 'released by', 180);
    if (!['gallery','launch','achievement'].includes(b.kind as string) || typeof b.published !== 'boolean') throw new RequestError(400, 'Choose an item type and visibility.');
    const eventDate = b.eventDate === '' ? null : field(b.eventDate, 'date', 10);
    if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !Number.isFinite(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0,10) !== eventDate)) throw new RequestError(400, 'Choose a valid date.');
    const id = b.id ? uuidField(b.id) : randomUUID();
    if (b.id) {
      const { rows } = await db.query(`UPDATE author_gallery SET title=$2, caption=$3, kind=$4, event_date=$5, revealed_by=$6,
        published=$7, revision=revision+1 WHERE id=$1 AND revision=$8 RETURNING id`,
        [id,title,caption,b.kind,eventDate,revealedBy,b.published,b.revision]);
      if (!rows.length) throw new RequestError(409, 'This item changed. Refresh before saving.');
    } else {
      const { rows: [count] } = await db.query<{ count: number }>('SELECT COUNT(*)::integer AS count FROM author_gallery');
      if (count.count >= 100) throw new RequestError(409, 'The gallery supports 100 items. Edit or remove an existing item.');
      await db.query(`INSERT INTO author_gallery(id,title,caption,kind,event_date,revealed_by,published) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id,title,caption,b.kind,eventDate,revealedBy,b.published]);
    }
    res.json({ id });
  });
  router.delete('/publisher/author-gallery/:id', async (req, res) => {
    await db.query('DELETE FROM author_gallery WHERE id=$1', [uuidField(req.params.id)]);
    res.json({ ok: true });
  });
  router.patch('/publisher/book-channels/:id', async (req, res) => {
    await requireAdmin(req);
    const b = record(req.body);
    const id = field(req.params.id, 'book ID', 80);
    if (!(await db.query('SELECT id FROM books WHERE id=$1', [id])).rows.length) throw new RequestError(404, 'Book not found.');
    await db.query(`INSERT INTO book_channels(book_id,publisher,publisher_url,amazon_url) VALUES($1,$2,$3,$4)
      ON CONFLICT(book_id) DO UPDATE SET publisher=EXCLUDED.publisher,publisher_url=EXCLUDED.publisher_url,amazon_url=EXCLUDED.amazon_url`,
      [id,optional(b.publisher,'publisher name',180),link(b.publisherUrl),link(b.amazonUrl,true)]);
    res.json({ ok: true });
  });
  router.patch('/publisher/enquiries/:id/read', async (req, res) => {
    await requireAdmin(req);
    await db.query('UPDATE enquiries SET read_at=NOW() WHERE id=$1', [uuidField(req.params.id)]);
    res.json({ ok: true });
  });
  return router;
}
