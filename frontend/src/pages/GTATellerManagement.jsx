import React, { useState, useEffect, useContext } from 'react';
import { Plus, Trash2, Edit2, Save, X, Phone, Mail, Users } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import axios from 'axios';

export default function GTATellerManagement() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const API = getApiUrl();

  const [tellers, setTellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    position: 'Teller',
    status: 'active'
  });

  // Fetch GTA tellers
  const fetchTellers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/gta-tellers`);
      setTellers(response.data || []);
    } catch (error) {
      console.error('Error fetching GTA tellers:', error);
      showToast({
        type: 'error',
        message: 'Failed to load GTA tellers'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTellers();
  }, []);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast({ type: 'error', message: 'Name is required' });
      return;
    }

    try {
      if (editingId) {
        // Update existing teller
        await axios.put(`${API}/api/gta-tellers/${editingId}`, formData);
        setTellers(tellers.map(t => t._id === editingId ? { ...t, ...formData } : t));
        showToast({ type: 'success', message: 'Teller updated successfully' });
      } else {
        // Create new teller
        const response = await axios.post(`${API}/api/gta-tellers`, formData);
        setTellers([...tellers, response.data]);
        showToast({ type: 'success', message: 'Teller added successfully' });
      }

      // Reset form
      setFormData({ name: '', phone: '', email: '', position: 'Teller', status: 'active' });
      setEditingId(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error saving teller:', error);
      showToast({ type: 'error', message: 'Failed to save teller' });
    }
  };

  // Handle edit
  const handleEdit = (teller) => {
    setFormData({
      name: teller.name,
      phone: teller.phone || '',
      email: teller.email || '',
      position: teller.position || 'Teller',
      status: teller.status || 'active'
    });
    setEditingId(teller._id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this teller?')) return;

    try {
      await axios.delete(`${API}/api/gta-tellers/${id}`);
      setTellers(tellers.filter(t => t._id !== id));
      showToast({ type: 'success', message: 'Teller deleted successfully' });
    } catch (error) {
      console.error('Error deleting teller:', error);
      showToast({ type: 'error', message: 'Failed to delete teller' });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({ name: '', phone: '', email: '', position: 'Teller', status: 'active' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GTA Teller Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage tellers without RMI accounts for GTA scheduling</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus size={20} />
            Add Teller
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Teller' : 'Add New Teller'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Teller, Supervisor"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on-leave">On Leave</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  <Save size={18} />
                  {editingId ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                >
                  <X size={18} />
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tellers List */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading GTA tellers...</p>
          </div>
        ) : tellers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No GTA tellers added yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <Plus size={18} />
              Add First Teller
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Position</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tellers.map((teller, idx) => (
                  <tr key={teller._id || idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{teller.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {teller.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone size={16} className="text-blue-600" />
                          {teller.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {teller.email ? (
                        <span className="flex items-center gap-1">
                          <Mail size={16} className="text-blue-600" />
                          {teller.email}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{teller.position}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        teller.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : teller.status === 'on-leave'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {teller.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(teller)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium text-xs"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(teller._id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium text-xs"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Stats */}
        {!loading && tellers.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-gray-600 text-sm">Active Tellers</p>
              <p className="text-2xl font-bold text-green-600">
                {tellers.filter(t => t.status === 'active').length}
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-gray-600 text-sm">On Leave</p>
              <p className="text-2xl font-bold text-yellow-600">
                {tellers.filter(t => t.status === 'on-leave').length}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-gray-600 text-sm">Total Tellers</p>
              <p className="text-2xl font-bold text-blue-600">{tellers.length}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
