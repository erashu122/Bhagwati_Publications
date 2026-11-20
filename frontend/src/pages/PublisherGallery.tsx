import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { GalleryEntry, BookChannel } from '../../../shared/author-gallery';
import { errorMessage, storeRequest } from '../account';
import type { Book } from '../../../shared/books';

export function PublisherGallery() {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [editing, setEditing] = useState<GalleryEntry | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    storeRequest<{ entries: GalleryEntry[] }>('/publisher/author-gallery').then(data => { if (active) setEntries(data.entries); })
      .catch(e => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [version]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get('photo');
    if (file instanceof File && file.size > 1048576) { setError('Choose a photo up to 1 MB.'); return; }
    setBusy(true); setError(''); setMessage('');
    let savedId: string | undefined;
    try {
      const { id } = await storeRequest<{ id: string }>('/publisher/author-gallery', 'POST', {
        id: editing?.id, revision: editing?.revision, title: values.get('title'), caption: values.get('caption'),
        kind: values.get('kind'), eventDate: values.get('eventDate'), revealedBy: values.get('revealedBy'), published: values.has('published')
      });
      savedId = id;
      if (file instanceof File && file.size) await storeRequest('/publisher/author-gallery/' + id + '/image', 'PATCH', file);
      setEditing(null); form.reset(); setMessage('Gallery item saved. Published items appear on Home and Meet the author.');
    } catch (e) {
      setError(errorMessage(e) + (savedId ? ' Item details were saved. Open Edit to retry the photo.' : ''));
    } finally { setBusy(false); setVersion(v => v + 1); }
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this gallery item and photo?')) return;
    setBusy(true); setError('');
    try { await storeRequest('/publisher/author-gallery/' + id, 'DELETE', {}); setVersion(v => v + 1); if (editing?.id === id) setEditing(null); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="feature-stack"><h2>Author gallery &amp; achievements</h2>
    <p>Add real event photos, awards and book releases. Leave unverified dates or guest names blank. Photos can be JPG, PNG or WebP up to 1 MB.</p>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <form key={editing?.id ?? 'new'} className="form-panel form-stack" onSubmit={e => void save(e)}>
      <h3>{editing ? 'Edit item' : 'Add item'}</h3>
      <label className="field">Title<input name="title" required maxLength={180} defaultValue={editing?.title} /></label>
      <label className="field">Type<select name="kind" defaultValue={editing?.kind ?? 'gallery'}><option value="gallery">Photo gallery</option><option value="launch">Book launch</option><option value="achievement">Achievement</option></select></label>
      <label className="field">Description<textarea name="caption" maxLength={1500} defaultValue={editing?.caption} /></label>
      <label className="field">Event date<input name="eventDate" type="date" defaultValue={editing?.eventDate ?? ''} /></label>
      <label className="field">Released / presented by<input name="revealedBy" maxLength={180} defaultValue={editing?.revealedBy} /></label>
      <label className="field">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <label className="checkbox-field"><input name="published" type="checkbox" defaultChecked={editing?.published ?? false} /> Publish on the website</label>
      <div className="inline-actions"><button className="button primary" disabled={busy}>Save item</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setEditing(null); setVersion(v => v + 1); }}>New item</button></div>
    </form>
    {entries.map(entry => <article className="order-card" key={entry.id}>
      {entry.hasImage && <img className="gallery-admin-image" loading="lazy" src={'/api/author-gallery/' + entry.id + '/image?v=' + entry.revision} alt={entry.title} />}
      <h3>{entry.title}</h3><p>{entry.published ? 'Published' : 'Draft'} · {entry.kind}</p>
      <div className="inline-actions"><button className="button secondary" disabled={busy} onClick={() => setEditing(entry)}>Edit</button><button className="button secondary" disabled={busy} onClick={() => void remove(entry.id)}>Delete</button></div>
    </article>)}
  </div>;
}

export function PublisherPaymentsSetup() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    storeRequest<{ enabled: boolean }>('/payments/config').then(data => setEnabled(data.enabled)).catch(e => setError(errorMessage(e)));
  }, []);
  return <div className="form-panel feature-stack"><h2>Online payment setup</h2>
    {error && <p role="alert" className="form-error">{error}</p>}
    <p>{enabled === null ? 'Checking configuration…' : enabled ? 'Online payment credentials are configured. Verify merchant activation and a real payment separately.' : 'Online payments await merchant activation and server configuration. COD remains available for print-only orders.'}</p>
    <ol><li>Create a Razorpay account and open Test Mode to demonstrate payments locally.</li>
      <li>Generate API keys in Account &amp; Settings → API Keys. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.</li>
      <li>Add the webhook /api/payments/razorpay/webhook with payment_link.paid, payment_link.expired, payment_link.cancelled and refund.processed events. Use the same RAZORPAY_WEBHOOK_SECRET on the server.</li>
      <li>For customer payments, complete merchant activation and use Live Mode keys in Vercel Production, then redeploy and verify a payment.</li></ol>
    <p>Keep secret keys in your hosting environment settings. Test Mode simulates payments. Check the provider’s current charges before activating Live Mode.</p>
    <div className="inline-actions"><a className="button secondary" href="https://dashboard.razorpay.com/" target="_blank" rel="noopener noreferrer">Razorpay dashboard ↗</a>
      <a className="text-link" href="https://razorpay.com/pricing/" target="_blank" rel="noopener noreferrer">Current pricing ↗</a></div>
  </div>;
}

export function PublisherBookChannels() {
  const [books, setBooks] = useState<Book[]>([]);
  const [channels, setChannels] = useState<BookChannel[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    storeRequest<{ channels: BookChannel[] }>('/publisher/book-channels').then(data => setChannels(data.channels)).catch(e => setError(errorMessage(e)));
    storeRequest<{ books: Book[] }>('/publisher/catalog').then(data => setBooks(data.books)).catch(e => setError(errorMessage(e)));
  }, []);
  const id = selected || books[0]?.id || '';
  const current = channels.find(c => c.bookId === id);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await storeRequest('/publisher/book-channels/' + id, 'PATCH', values);
      setChannels(old => [...old.filter(c => c.bookId !== id), { bookId: id, publisher: String(values.publisher), publisherUrl: String(values.publisherUrl), amazonUrl: String(values.amazonUrl) }]);
      setMessage('Publisher and buying links saved.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <div className="feature-stack"><h2>Publishers &amp; buying links</h2><p>Paste the exact Amazon product link for the matching edition. This adds a choice alongside buying directly from this store.</p>
    <label className="field">Book<select value={id} onChange={e => setSelected(e.target.value)}>{books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
    <form className="form-panel form-stack" key={id + JSON.stringify(current)} onSubmit={e => void save(e)}>
      <label className="field">Original publisher<input name="publisher" maxLength={180} defaultValue={current?.publisher ?? ''} /></label>
      <label className="field">Publisher website<input type="url" name="publisherUrl" defaultValue={current?.publisherUrl ?? ''} /></label>
      <label className="field">Amazon product link<input type="url" name="amazonUrl" defaultValue={current?.amazonUrl ?? ''} /></label>
      <button className="button primary" disabled={busy || !id}>Save buying links</button>
    </form>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status">{message}</p>}
  </div>;
}
