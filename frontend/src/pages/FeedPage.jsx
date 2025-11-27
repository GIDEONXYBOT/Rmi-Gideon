import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

function TimeAgo({ time }) {
  try {
    const diff = Date.now() - new Date(time).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return <span>{sec}s</span>;
    const min = Math.floor(sec / 60);
    if (min < 60) return <span>{min}m</span>;
    const hr = Math.floor(min / 60);
    if (hr < 24) return <span>{hr}h</span>;
    const d = Math.floor(hr / 24);
    return <span>{d}d</span>;
  } catch {
    return <span>-</span>;
  }
}

export default function FeedPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const API = getApiUrl();
      const res = await axios.get(`${API}/api/media/feed`, { timeout: 10000 });
      if (res.data?.success) setItems(res.data.items || []);
      else setError(res.data?.message || 'Failed to fetch feed');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Generate a friendly placeholder/random feed for empty state
  function makeRandomFeed(count = 4) {
    const sampleNames = [
      'Alex', 'Marisol', 'Chris', 'Aisha', 'Diego', 'Nora', 'Sam', 'Maya'
    ];
    const sampleCaptions = [
      'Loving this view!',
      'Trying something new today 🌟',
      'Quick snap on my walk',
      'Testing the new upload feature — hello!',
      'Catch of the day',
      'Coffee break ☕️',
      'Sunset magic',
    ];

    return new Array(count).fill(0).map((_, i) => {
      const seed = Math.floor(Math.random() * 10000) + i;
      const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const caption = sampleCaptions[Math.floor(Math.random() * sampleCaptions.length)];
      return {
        _id: `placeholder-${seed}`,
        uploader: {
          name,
          avatarUrl: `https://i.pravatar.cc/140?u=${seed}`
        },
        createdAt: new Date(Date.now() - ((i + 1) * 1000 * 60 * 60)).toISOString(),
        caption,
        imageUrl: `https://picsum.photos/seed/${seed}/1200/800`,
        thumbUrl: `https://picsum.photos/seed/${seed}/640/360`,
        width: 1200,
        height: 800,
        _placeholder: true
      };
    });
  }

  const [loaded, setLoaded] = useState({});

  // Use connection hints to prefer smaller images on slow networks
  const connection = typeof navigator !== 'undefined' && navigator.connection ? navigator.connection : null;
  const effectiveType = connection?.effectiveType || '';

  function markLoaded(id) {
    setLoaded(prev => ({ ...prev, [id]: true }));
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Activity Feed</h2>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

      <div className="space-y-4">
        {items.length === 0 && !loading && (
          <div className="text-sm text-gray-500 mb-2">No posts yet — here are some sample posts to get you started.</div>
        )}

        {((items.length > 0) ? items : makeRandomFeed(4)).map((it) => (
          <article key={it._id} className="bg-white dark:bg-gray-800 rounded shadow-sm overflow-hidden border dark:border-gray-700">
            <div className="p-3 flex items-center gap-3">
              <img src={it.uploader?.avatarUrl ? (it.uploader.avatarUrl.startsWith('http') ? it.uploader.avatarUrl : `${getApiUrl()}${it.uploader.avatarUrl}`) : '/favicon.ico'} alt="avatar" className="w-10 h-10 rounded-full object-cover" onError={(e) => e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTIwIDIwQzIyLjc2MTQgMjAgMjUgMTcuNzYxNCAyNSAxNUMyNSAxMi4yMzg2IDIyLjc2MTQgMTAgMjAgMTBDMTcuMjM4NiAxMCAxNSAxMi4yMzg2IDE1IDE1QzE1IDE3Ljc2MTQgMTcuNzYxNCAyMCAyMFoiIGZpbGw9IiM5Q0E0QUYiLz4KPHBhdGggZD0iTTMwIDI4QzMwIDI0LjY4NjMgMjYuNDI3MSAyMiAyMiAyMkgxOEMxMy41NzI5IDIyIDEwIDI0LjY4NjMgMTAgMjhWMzBIMzBWMjhaIiBmaWxsPSIjOUNBNEFGIi8+Cjwvc3ZnPgo='} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{it.uploader?.name || it.uploader?.username || 'User'}</div>
                  <div className="text-xs text-gray-400"><TimeAgo time={it.createdAt} /></div>
                </div>
                {it.caption && <div className="text-sm text-gray-600 mt-1">{it.caption}</div>}
              </div>
            </div>

            {it.imageUrl && (
              <div className="w-full bg-black/5 dark:bg-white/5 relative overflow-hidden" style={{ aspectRatio: (it.width && it.height) ? `${it.width} / ${it.height}` : '16 / 9' }}>
                {/* Use smaller thumb on mobile/slow networks when available */}
                <picture>
                  {(it.thumbUrl || it.imageUrl) && (
                    <source media="(max-width:640px)" srcSet={(it.thumbUrl || it.imageUrl).startsWith('http') ? (it.thumbUrl || it.imageUrl) : `${getApiUrl()}${it.thumbUrl || it.imageUrl}`} />
                  )}
                  {/* If connection is slow prefer thumb to save bandwidth */}
                  <source media="(max-width:1024px)" srcSet={effectiveType.includes('2g') || effectiveType.includes('slow-2g') ? ((it.thumbUrl || it.imageUrl).startsWith('http') ? (it.thumbUrl || it.imageUrl) : `${getApiUrl()}${it.thumbUrl || it.imageUrl}`) : ((it.imageUrl).startsWith('http') ? it.imageUrl : `${getApiUrl()}${it.imageUrl}`)} />
                  <img
                    src={(it.imageUrl).startsWith('http') ? it.imageUrl : `${getApiUrl()}${it.imageUrl}`}
                    alt="feed"
                    loading="lazy"
                    onLoad={() => markLoaded(it._id)}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loaded[it._id] ? 'opacity-100' : 'opacity-0'}`}
                  />
                </picture>

                {/* skeleton / placeholder while image is loading */}
                {!loaded[it._id] && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-lg bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
                  </div>
                )}
              </div>
            )}

            <div className="p-3 flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-3">
                <button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Like</button>
                <button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Comment</button>
                <button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">Share</button>
              </div>
              <div className="text-xs">ID: {String(it._id).slice(-6)}{it._placeholder ? ' • sample' : ''}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
