import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { useParams } from 'react-router-dom';

export default function UserProfile(){
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(()=>{
    (async ()=>{
      try{
        const API = getApiUrl();
        const [uRes, fRes] = await Promise.all([
          axios.get(`${API}/api/users/${id}`, { timeout: 8000 }),
          axios.get(`${API}/api/media/feed?userId=${id}`, { timeout: 8000 })
        ]);
        setUser(uRes.data);
        setItems(fRes.data?.items || []);
      }catch(e){ setErr(e.response?.data?.message || e.message || 'Failed'); }
      finally{ setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-500">{err}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <img src={user.avatarUrl ? `${getApiUrl()}${user.avatarUrl}` : '/favicon.ico'} className="w-20 h-20 rounded-full object-cover" alt="avatar"/>
        <div>
          <div className="text-xl font-semibold">{user.name || user.username}</div>
          <div className="text-sm text-gray-400">{user.username} • {user.role}</div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Posts</h3>
      <div className="space-y-3">
        {items.length === 0 && <div className="text-sm text-gray-500">No posts yet</div>}
        {items.map(it => (
          <div key={it._id} className="border rounded overflow-hidden">
            {it.imageUrl && <img src={`${getApiUrl()}${it.imageUrl}`} alt="post" className="w-full object-cover max-h-[600px]" />}
            {it.caption && <div className="p-3 text-sm text-gray-700 dark:text-gray-300">{it.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
