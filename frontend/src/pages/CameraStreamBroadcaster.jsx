import React, { useState, useEffect, useContext, useRef } from 'react';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Camera, Share2, Copy, QrCode, Eye, Send, Wifi, WifiOff, Play, Square } from 'lucide-react';
import axios from 'axios';

export default function CameraStreamBroadcaster() {
  const { settings, user } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const frameIntervalRef = useRef(null);
  
  const [mode, setMode] = useState('select'); // select, broadcast, viewer
  const [broadcastId, setBroadcastId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [viewerStream, setViewerStream] = useState(null);
  const [viewerImage, setViewerImage] = useState(null);
  const [streamQuality, setStreamQuality] = useState('medium');
  
  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
        setCameraError('Failed to access camera list');
      }
    };

    getCameras();
  }, []);

  // Setup WebSocket connection
  const setupWebSocket = (id, isbroadcaster = true) => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const apiUrl = getApiUrl().replace(/^https?:/, '').replace(/\/$/, '');
      const wsUrl = `${protocol}${apiUrl.split('/')[2]}/ws/camera/${id}`;
      
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        
        // Send connection info
        wsRef.current.send(JSON.stringify({
          type: 'init',
          role: isbroadcaster ? 'broadcaster' : 'viewer',
          user: user?.name || user?.username
        }));
        
        showToast({ type: 'success', message: `✅ Connected to broadcast ${id}` });
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'frame' && !isStreaming) {
            // Viewer received frame
            setViewerImage(`data:image/jpeg;base64,${message.data}`);
          } else if (message.type === 'status') {
            console.log('📊 Status:', message.data);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };
      
      wsRef.current.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        setIsConnected(false);
      };
      
      wsRef.current.onclose = () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);
        stopStreaming();
      };
    } catch (err) {
      console.error('Error setting up WebSocket:', err);
      showToast({ type: 'error', message: 'Failed to connect to stream server' });
    }
  };

  // Start broadcasting
  const startBroadcasting = async () => {
    try {
      setCameraError(null);
      
      // Generate broadcast ID
      const id = Math.random().toString(36).substring(2, 15).toUpperCase();
      setBroadcastId(id);
      
      // Setup WebSocket
      setupWebSocket(id, true);
      
      // Get camera stream
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          frameRate: { ideal: 15 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(err => console.error('Play error:', err));
      }

      setStream(mediaStream);
      setIsStreaming(true);
      setMode('broadcast');
      showToast({ type: 'success', message: `📷 Broadcasting started (ID: ${id})` });
      
      // Start sending frames
      sendFrames();
    } catch (err) {
      console.error('Error starting broadcast:', err);
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Camera permission denied'
        : 'Failed to start camera';
      setCameraError(errorMsg);
      showToast({ type: 'error', message: errorMsg });
    }
  };

  // Send video frames to WebSocket
  const sendFrames = () => {
    if (!videoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // Draw frame
    ctx.drawImage(video, 0, 0);

    // Convert to JPEG and send
    canvas.toBlob(
      (blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'frame',
              data: base64,
              timestamp: Date.now()
            }));
          }
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      streamQuality === 'high' ? 0.9 : streamQuality === 'medium' ? 0.7 : 0.5
    );

    frameIntervalRef.current = setTimeout(sendFrames, streamQuality === 'high' ? 100 : 200);
  };

  // Join broadcast as viewer
  const joinBroadcast = async () => {
    if (!broadcastId.trim()) {
      showToast({ type: 'error', message: 'Please enter broadcast ID' });
      return;
    }

    try {
      // Setup WebSocket
      setupWebSocket(broadcastId.toUpperCase(), false);
      setMode('viewer');
      showToast({ type: 'info', message: `📡 Connecting to broadcast...` });
    } catch (err) {
      console.error('Error joining broadcast:', err);
      showToast({ type: 'error', message: 'Failed to join broadcast' });
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (frameIntervalRef.current) {
      clearTimeout(frameIntervalRef.current);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    
    setStream(null);
    setIsStreaming(false);
    setIsConnected(false);
    setMode('select');
    setBroadcastId('');
    setViewerImage(null);
    showToast({ type: 'info', message: '📷 Stream stopped' });
  };

  // Copy broadcast ID
  const copyBroadcastId = () => {
    navigator.clipboard.writeText(broadcastId);
    showToast({ type: 'success', message: '📋 Broadcast ID copied!' });
  };

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'} p-4 md:p-6`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Wifi size={32} className={isConnected ? 'text-green-600' : 'text-gray-400'} />
            <div>
              <h1 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                🔴 Stream Camera Broadcaster
              </h1>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                Broadcast Android phone camera to other devices
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Broadcast Mode */}
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition`}
              onClick={() => setMode('setup-broadcast')}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                    📱 Broadcast Camera
                  </h2>
                  <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Start streaming from this device
                  </p>
                </div>
                <Send size={40} className="text-blue-500" />
              </div>
              <ul className={`text-sm space-y-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                <li>✓ Share camera with other devices</li>
                <li>✓ Get unique broadcast code</li>
                <li>✓ Real-time video streaming</li>
              </ul>
            </div>

            {/* Viewer Mode */}
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition`}
              onClick={() => setMode('setup-viewer')}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                    🖥️ Watch Stream
                  </h2>
                  <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                    View someone else's camera
                  </p>
                </div>
                <Eye size={40} className="text-green-500" />
              </div>
              <ul className={`text-sm space-y-2 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                <li>✓ Enter broadcast code</li>
                <li>✓ Live view from remote camera</li>
                <li>✓ No camera required</li>
              </ul>
            </div>
          </div>
        )}

        {/* Setup Broadcast */}
        {mode === 'setup-broadcast' && !isStreaming && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 max-w-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                📷 Setup Broadcast
              </h2>
              <button onClick={() => setMode('select')} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            {cameraError && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">
                {cameraError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Camera
                </label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${cameras.indexOf(camera) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Stream Quality
                </label>
                <select
                  value={streamQuality}
                  onChange={(e) => setStreamQuality(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="low">Low (Fast, mobile friendly)</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="high">High (Best quality, more bandwidth)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={startBroadcasting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Play size={20} />
                  Start Broadcasting
                </button>
                <button
                  onClick={() => setMode('select')}
                  className="flex-1 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Broadcasting Active */}
        {mode === 'broadcast' && isStreaming && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Feed */}
            <div className="lg:col-span-2">
              <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
                <div className="relative bg-black aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      backgroundColor: '#000'
                    }}
                  />
                  
                  {/* Status Overlay */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="font-semibold">BROADCASTING</span>
                  </div>

                  {/* Connection Status */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 text-white px-3 py-1 rounded-full">
                    <Wifi size={16} className={isConnected ? 'text-green-400' : 'text-red-400'} />
                    <span className="text-sm">{isConnected ? 'Connected' : 'Connecting...'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Broadcast Info */}
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
                📡 Broadcast ID
              </h3>

              <div className="mb-4">
                <div className={`p-4 rounded-lg text-center font-mono font-bold text-xl ${
                  dark ? 'bg-gray-700 text-blue-300' : 'bg-blue-50 text-blue-600'
                }`}>
                  {broadcastId}
                </div>
              </div>

              <button
                onClick={copyBroadcastId}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 mb-4"
              >
                <Copy size={18} />
                Copy ID
              </button>

              <div className={`p-4 rounded-lg mb-4 ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <p className={`text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Share Instructions:
                </p>
                <ol className={`text-sm space-y-1 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <li>1. Copy the broadcast ID above</li>
                  <li>2. Tell other users this ID</li>
                  <li>3. They open "Watch Stream"</li>
                  <li>4. Paste ID to connect</li>
                </ol>
              </div>

              <button
                onClick={stopStreaming}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
              >
                <Square size={18} />
                Stop Broadcasting
              </button>
            </div>
          </div>
        )}

        {/* Setup Viewer */}
        {mode === 'setup-viewer' && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 max-w-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>
                🖥️ Join Broadcast
              </h2>
              <button onClick={() => setMode('select')} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Broadcast ID
                </label>
                <input
                  type="text"
                  value={broadcastId}
                  onChange={(e) => setBroadcastId(e.target.value.toUpperCase())}
                  placeholder="Enter broadcast code here..."
                  className={`w-full px-4 py-2 rounded-lg border text-lg font-mono tracking-widest ${
                    dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className={`p-4 rounded-lg ${dark ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <p className={`text-sm ${dark ? 'text-gray-300' : 'text-blue-800'}`}>
                  💡 Ask the broadcaster to share their ID with you
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={joinBroadcast}
                  disabled={!broadcastId.trim()}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Eye size={20} />
                  Join Broadcast
                </button>
                <button
                  onClick={() => setMode('select')}
                  className="flex-1 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewing Stream */}
        {mode === 'viewer' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stream View */}
            <div className="lg:col-span-2">
              <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
                <div className="relative bg-black aspect-video flex items-center justify-center">
                  {viewerImage ? (
                    <>
                      <img
                        src={viewerImage}
                        alt="Stream"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          backgroundColor: '#000'
                        }}
                      />
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-full animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        <span className="font-semibold">LIVE</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <Wifi size={64} className="text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">Waiting for stream...</p>
                      <p className="text-gray-600 text-sm mt-2">
                        {isConnected ? 'Connected, waiting for broadcaster' : 'Connecting...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Info */}
            <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <h3 className={`text-lg font-bold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
                📡 Connection
              </h3>

              <div className="space-y-3 mb-4">
                <div>
                  <p className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Broadcast ID
                  </p>
                  <p className="font-mono text-lg font-bold text-blue-600">{broadcastId}</p>
                </div>

                <div>
                  <p className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                    <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={stopStreaming}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2"
              >
                <WifiOff size={18} />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
