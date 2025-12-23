import React, { useState, useEffect } from 'react';
import { Users, Building2, RotateCcw, Save } from 'lucide-react';
import ScheduleRotation from './ScheduleRotation';

export default function WorkplaceSchedule() {
  const [selectedWorkplace, setSelectedWorkplace] = useState('both'); // 'rmi', 'gta', 'both'
  const [view, setView] = useState('schedule'); // 'schedule' | 'settings'

  const workplaces = [
    { id: 'rmi', name: 'RMI', color: 'blue', icon: '🏢' },
    { id: 'gta', name: 'GTA', color: 'green', icon: '🎮' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workplace Schedule & Rotation</h1>
              <p className="text-gray-600 mt-1">Manage staff rotation between RMI and GTA</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('schedule')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  view === 'schedule'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => setView('settings')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  view === 'settings'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Settings
              </button>
            </div>
          </div>

          {/* Workplace Selector */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setSelectedWorkplace('both')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                selectedWorkplace === 'both'
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users size={20} />
              Both Workplaces
            </button>
            {workplaces.map(workplace => (
              <button
                key={workplace.id}
                onClick={() => setSelectedWorkplace(workplace.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  selectedWorkplace === workplace.id
                    ? `bg-${workplace.color}-100 text-${workplace.color}-700 border-2 border-${workplace.color}-600`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Building2 size={20} />
                {workplace.icon} {workplace.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {view === 'schedule' ? (
          <div className="space-y-6">
            {/* Workplace Info */}
            {selectedWorkplace !== 'both' && (
              <div className={`bg-${selectedWorkplace === 'rmi' ? 'blue' : 'green'}-50 border-l-4 border-${selectedWorkplace === 'rmi' ? 'blue' : 'green'}-600 p-4 rounded`}>
                <p className="text-sm text-gray-700">
                  Scheduling for: <span className="font-bold">{selectedWorkplace === 'rmi' ? 'RMI' : 'GTA'}</span>
                </p>
              </div>
            )}

            {/* Schedule Rotation Component */}
            <ScheduleRotation workplace={selectedWorkplace} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Schedule Settings</h2>

            <div className="space-y-6">
              {/* RMI Settings */}
              <div className="border-l-4 border-blue-600 pl-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">🏢 RMI Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Staff per Shift
                    </label>
                    <input
                      type="number"
                      defaultValue={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Working Days per Week
                    </label>
                    <input
                      type="number"
                      defaultValue={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* GTA Settings */}
              <div className="border-l-4 border-green-600 pl-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">🎮 GTA Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Staff per Shift
                    </label>
                    <input
                      type="number"
                      defaultValue={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Working Days per Week
                    </label>
                    <input
                      type="number"
                      defaultValue={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Rotation Rules */}
              <div className="border-l-4 border-purple-600 pl-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">🔄 Rotation Rules</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-gray-700">Rotate staff between RMI and GTA monthly</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-gray-700">Fair distribution of shifts</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded" />
                    <span className="text-gray-700">Respect employee preferences</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  <Save size={20} />
                  Save Settings
                </button>
                <button className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
                  <RotateCcw size={20} />
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
