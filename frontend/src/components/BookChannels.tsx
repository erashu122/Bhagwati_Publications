import { useEffect, useState } from 'react';
import type { BookChannel } from '../../../shared/author-gallery';
import { storeRequest } from '../account';

const publishers: Record<string, { publisher: string; publisherUrl: string }> = {
  'inventory-management': { publisher: 'Excel India Publishers', publisherUrl: 'https://excelindiapublishers.com/shop/strategies-to-increase-profit-through-inventory-management-2/' },
  'market-leadership': { publisher: 'Excel India Publishers', publisherUrl: 'https://excelindiapublishers.com/' },
  'practical-e-auctions': { publisher: 'Taxmann', publisherUrl: 'https://www.taxmann.com/' },
  'construction-arbitration': { publisher: 'Taxmann', publisherUrl: 'https://www.taxmann.com/' }
};
export function BookChannels({ id, title }: { id: string; title: string }) {
  const [channel, setChannel] = useState<BookChannel>();
  useEffect(() => {
    let active = true;
    storeRequest<{ channels: BookChannel[] }>('/book-channels').then(data => { if (active) setChannel(data.channels.find(c => c.bookId === id)); }).catch(() => {});
    return () => { active = false; };
  }, [id]);
  const publisher = channel ?? publishers[id];
  const amazon = channel?.amazonUrl;
  return <section className="feature-stack buying-options" aria-label="Other buying options">
    {publisher?.publisher && <p><strong>Original publisher</strong> {publisher.publisherUrl ?
      <a className="text-link" href={publisher.publisherUrl} target="_blank" rel="noopener noreferrer">{publisher.publisher} ↗</a> : publisher.publisher}</p>}
    <a className="button secondary" target="_blank" rel="noopener noreferrer"
      href={amazon || 'https://www.amazon.in/s?k=' + encodeURIComponent(title + ' Saraswat')}>{amazon ? 'Buy on Amazon ↗' : 'Find this book on Amazon ↗'}</a>
    <p className="small-note">Amazon opens in a new tab. Check the edition, format, price and availability there.</p>
  </section>;
}
