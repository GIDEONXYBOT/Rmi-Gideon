import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { useNavigate } from 'react-router-dom';

export default function UsersList(){
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(()=>{ (async ()=>{
    setLoading(true); setError('');
    try{
      const res = await axios.get(`${getApiUrl()}/api/users`, { timeout: 8000 });
      setUsers(res.data || []);
    }catch(err){ setError(err.response?.data?.message || err.message || 'Failed'); }
    finally{ setLoading(false); }
  })(); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">People</h2>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {users.map(u => (
          <div key={u._id} className="p-3 border rounded flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer" onClick={()=>navigate(`/users/${u._id}`)}>
            <img src={u.avatarUrl ? `${getApiUrl()}${u.avatarUrl}` : '/favicon.ico'} className="w-12 h-12 rounded-full object-cover" alt="a" />
            <div className="flex-1">
              <div className="font-semibold">{u.name || u.username}</div>
              <div className="text-xs text-gray-400">{u.role} • {u.status}</div>
            </div>
            <div className="text-sm text-indigo-600">View</div>
          </div>
        ))}
      </div>
    </div>
  );
}
