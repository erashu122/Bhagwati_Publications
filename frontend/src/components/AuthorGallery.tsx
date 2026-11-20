import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GalleryEntry } from '../../../shared/author-gallery';
import { errorMessage, storeRequest } from '../account';

const labels = { gallery: 'Photo gallery', launch: 'Book launch', achievement: 'Achievement' };
export function AuthorGallery({ compact = false }: { compact?: boolean }) {
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    storeRequest<{ entries: GalleryEntry[] }>('/author-gallery').then(data => { if (active) setEntries(data.entries); })
      .catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <section className="container section author-gallery" aria-labelledby={compact ? 'home-gallery-title' : 'author-gallery-title'}>
    <div className="section-heading"><div><p className="eyebrow">BEYOND THE BOOKS</p>
      <h2 id={compact ? 'home-gallery-title' : 'author-gallery-title'}>Achievements, launches &amp; memories</h2></div>
      {compact && <Link className="text-link" to="/author#author-gallery">Explore the gallery →</Link>}
    </div>
    <div id={compact ? undefined : 'author-gallery'}>
      {loading ? <p role="status">Loading gallery…</p> : error ? <p role="alert">{error}</p> : entries.length ?
        <div className="gallery-grid">{(compact ? entries.slice(0, 3) : entries).map(entry => <article className="gallery-card" key={entry.id}>
          {entry.hasImage ? <a href={'/api/author-gallery/' + entry.id + '/image?v=' + entry.revision} target="_blank" rel="noopener">
            <img loading="lazy" decoding="async" src={'/api/author-gallery/' + entry.id + '/image?v=' + entry.revision} alt={entry.title} width={600} height={400} /></a>
            : <div className="gallery-placeholder">{labels[entry.kind]}</div>}
          <div><p className="eyebrow">{labels[entry.kind]} {entry.eventDate && <time dateTime={entry.eventDate}>· {new Date(entry.eventDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}</p>
            <h3>{entry.title}</h3><p className="gallery-caption">{entry.caption}</p>
            {entry.revealedBy && <p><strong>Released / presented by</strong> {entry.revealedBy}</p>}
          </div>
        </article>)}</div>
        : <div className="gallery-empty"><img src="/api/catalog/author-photo" alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true; }} />
          <div><h3>Author gallery</h3><p>Book launches, achievements and photographs will be shared here as the publisher adds them.</p></div></div>}
    </div>
  </section>;
}
