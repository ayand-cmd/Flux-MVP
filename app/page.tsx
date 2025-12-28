'use client';

import { useState, useEffect } from 'react';
import { extractSheetId } from '@/lib/utils';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [userEmail, setUserEmail] = useState<string>('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [syncResult, setSyncResult] = useState<any>(null);

  // Check URL params on load for email from Google login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const email = params.get('email');
      if (email) {
        setUserEmail(email);
        setCurrentStep(2); // Auto-advance to Step 2 if email exists
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Step 1: Google Connection
  const handleGoogleConnect = () => {
    window.location.href = '/api/auth/google/login';
  };

  // Step 2: Save Configuration
  const handleSaveConfiguration = async () => {
    if (!userEmail || !sheetUrl) {
      setStatus('❌ Please enter your Google Sheet URL');
      return;
    }

    setIsLoading(true);
    setStatus('💾 Saving configuration...');

    try {
      const extractedId = extractSheetId(sheetUrl);
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail, 
          spreadsheetId: extractedId 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('✅ Configuration saved!');
        setCurrentStep(3);
      } else {
        setStatus(`❌ ${data.error || 'Failed to save configuration'}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Connect Facebook and fetch accounts
  const handleFacebookConnect = () => {
    if (!userEmail) {
      setStatus('❌ Email is required');
      return;
    }
    window.location.href = `/api/auth/facebook/login?email=${encodeURIComponent(userEmail)}`;
  };

  // Fetch ad accounts after Facebook connection
  const fetchAdAccounts = async () => {
    if (!userEmail) return;

    setIsLoading(true);
    setStatus('🔍 Fetching ad accounts...');

    try {
      const res = await fetch(`/api/facebook/accounts?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();

      if (res.ok && data.accounts) {
        setAccounts(data.accounts);
        setStatus(`✅ Found ${data.accounts.length} ad account(s)`);
      } else {
        setStatus(`❌ ${data.error || 'Failed to fetch ad accounts'}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch accounts when reaching step 3
  useEffect(() => {
    if (currentStep === 3 && userEmail && accounts.length === 0) {
      fetchAdAccounts();
    }
  }, [currentStep, userEmail]);

  // Select and save ad account
  const handleSelectAccount = async (accountId: string, name: string) => {
    if (!userEmail) return;

    setIsLoading(true);
    setStatus(`💾 Saving ${name}...`);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail, 
          adAccountId: accountId 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSelectedAccount(accountId);
        setStatus(`✅ Active Account: ${name}`);
      } else {
        setStatus(`❌ ${data.error || 'Failed to save account'}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Final: Sync Now
  const handleSyncNow = async () => {
    if (!userEmail || !sheetUrl) {
      setStatus('❌ Missing email or sheet URL');
      return;
    }

    setIsLoading(true);
    setStatus('⏳ Syncing data to Google Sheets...');
    setSyncResult(null);

    try {
      const extractedId = extractSheetId(sheetUrl);
      const res = await fetch('/api/test-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userEmail, 
          spreadsheetId: extractedId 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('✅ Sync complete!');
        setSyncResult(data);
      } else {
        setStatus(`❌ ${data.error || 'Sync failed'}`);
        setSyncResult(data);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      setSyncResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h1 className="text-3xl font-bold text-center">Ad Pacing Tool</h1>
          <p className="text-blue-100 text-center mt-2">3-Step Onboarding</p>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step ? '✓' : step}
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span className={currentStep >= 1 ? 'text-blue-600 font-semibold' : ''}>
              Google
            </span>
            <span className={currentStep >= 2 ? 'text-blue-600 font-semibold' : ''}>
              Configure
            </span>
            <span className={currentStep >= 3 ? 'text-blue-600 font-semibold' : ''}>
              Facebook
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1: Google Connection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Google Account</h2>
                <p className="text-gray-600">
                  Connect your Google account to access Google Sheets
                </p>
              </div>
              <button
                onClick={handleGoogleConnect}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg"
              >
                🔗 Connect Google Account
              </button>
            </div>
          )}

          {/* Step 2: Configuration */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Your Sheet</h2>
                <p className="text-gray-600 mb-4">
                  Enter your Google Sheet URL. You can paste the full URL or just the ID.
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Sheet URL
                </label>
                <input
                  type="text"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMvs0XRA5nFNd/edit#gid=0"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                {userEmail && (
                  <p className="text-xs text-gray-500 mt-2">
                    Logged in as: <span className="font-semibold">{userEmail}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleSaveConfiguration}
                disabled={isLoading || !sheetUrl}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg"
              >
                {isLoading ? '💾 Saving...' : '💾 Save Configuration'}
              </button>
            </div>
          )}

          {/* Step 3: Meta Connection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Facebook Ads</h2>
                <p className="text-gray-600 mb-4">
                  Connect your Facebook account to access ad accounts
                </p>
              </div>

              {accounts.length === 0 ? (
                <button
                  onClick={handleFacebookConnect}
                  className="w-full py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg"
                >
                  📘 Connect Facebook Ads
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Ad Account</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {accounts.map((acc) => (
                        <button
                          key={acc.account_id}
                          onClick={() => handleSelectAccount(acc.account_id, acc.name)}
                          disabled={acc.account_status !== 1 || isLoading}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            selectedAccount === acc.account_id
                              ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          } ${
                            acc.account_status !== 1 || isLoading
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-gray-900">{acc.name}</div>
                              <div className="text-sm text-gray-500">
                                ID: {acc.account_id} • {acc.currency}
                              </div>
                            </div>
                            {acc.account_status === 1 ? (
                              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                                Active
                              </span>
                            ) : (
                              <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">
                                Disabled
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedAccount && (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          ✅ Account selected and saved!
                        </p>
                      </div>

                      {/* Sync Now Button */}
                      <button
                        onClick={handleSyncNow}
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-xl"
                      >
                        {isLoading ? '⏳ Syncing...' : '⚡ Sync Now'}
                      </button>

                      {/* Sync Results */}
                      {syncResult && (
                        <div className="mt-4">
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">Sync Results:</h3>
                          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto">
                            <pre>{JSON.stringify(syncResult, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status Message */}
          {status && (
            <div className={`p-4 rounded-lg text-center text-sm font-medium ${
              status.includes('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : status.includes('❌')
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {status}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
