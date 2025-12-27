'use client'; // This makes it a Client Component (interactive)

import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [status, setStatus] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 1. Simulate "Login" (In a real app, we'd use a session provider)
  // For this MVP, we just ask them to type their email to "unlock" the dashboard
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) setIsLoggedIn(true);
  };

  // 2. Save the Sheet ID to Supabase
  const saveSettings = async () => {
    setStatus('Saving...');
    const res = await fetch('/api/user/settings', {
      method: 'POST',
      body: JSON.stringify({ email, spreadsheetId: sheetId }),
    });
    if (res.ok) setStatus('✅ Sheet ID Saved!');
    else setStatus('❌ Error saving.');
  };

  // 3. Trigger the Sync
  const runSync = async () => {
    setStatus('⏳ Syncing to Google Sheets...');
    const res = await fetch('/api/test-sync', {
      method: 'POST',
      body: JSON.stringify({ email, spreadsheetId: sheetId }),
    });
    const data = await res.json();
    if (res.ok) setStatus('✅ ' + data.message);
    else setStatus('❌ ' + data.error);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-20">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ad Pacing Sentinel 🇮🇳</h1>

        {!isLoggedIn ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-center mb-4">
              Step 1: Connect your Google Account to enable Sheet access.
            </p>
             {/* This button hits your existing Google Auth flow */}
            <a
              href="/api/auth/google/login" // We'll create this redirect helper next
              className="block w-full py-3 px-4 bg-white border border-gray-300 rounded-lg text-center hover:bg-gray-50 font-medium text-gray-700 mb-6"
              onClick={() => alert("Make sure to come back here after logging in!")}
            >
              <span className="mr-2">G</span> Connect Google Account
            </a>
            
            <div className="border-t pt-6">
              <p className="text-xs text-gray-400 uppercase font-bold mb-2">Already Connected?</p>
              <input
                type="email"
                placeholder="Enter your email to login"
                className="w-full p-3 border rounded-lg mb-3 text-black"
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Access Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">Logged in as: <strong>{email}</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Google Sheet ID</label>
              <input
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="1aBcD..."
                className="w-full p-3 border rounded-lg text-sm font-mono text-black"
              />
              <button 
                onClick={saveSettings}
                className="text-xs text-blue-600 mt-2 hover:underline"
              >
                Save as Default
              </button>
            </div>

            <button
              onClick={runSync}
              className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 shadow-md transition-all active:scale-95"
            >
              ⚡ SYNC LIVE ADS
            </button>

            {status && (
              <div className="p-4 bg-gray-100 rounded-lg text-center text-sm font-medium text-gray-800">
                {status}
              </div>
            )}
            
            <button onClick={() => setIsLoggedIn(false)} className="text-gray-400 text-xs w-full text-center">Logout</button>
          </div>
        )}
      </div>
    </main>
  );
}