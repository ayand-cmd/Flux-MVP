'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { extractSheetId } from '@/lib/utils';

interface FormData {
  name: string;
  sheetUrl: string;
  template: 'Hourly' | 'Daily' | '';
  adAccountId: string;
  adAccountName: string;
}

interface AdAccount {
  account_id: string;
  name: string;
  currency: string;
  account_status: number;
}

export default function NewFlux() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFacebookToken, setHasFacebookToken] = useState<boolean | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    sheetUrl: '',
    template: '',
    adAccountId: '',
    adAccountName: ''
  });

  // Load user email and form data from localStorage on mount
  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (!email) {
      router.push('/');
      return;
    }
    setUserEmail(email);

    // Load saved form data
    const savedData = localStorage.getItem('fluxFormData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed);
        // Restore step if we have data
        if (parsed.name && parsed.sheetUrl && parsed.template) {
          setCurrentStep(2);
        }
      } catch (e) {
        console.error('Error loading saved form data:', e);
      }
    }
  }, [router]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (userEmail && formData.name) {
      localStorage.setItem('fluxFormData', JSON.stringify(formData));
    }
  }, [formData, userEmail]);

  // Check Facebook auth status when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && userEmail && hasFacebookToken === null) {
      checkFacebookAuth();
    }
  }, [currentStep, userEmail, hasFacebookToken]);

  // Fetch ad accounts when Facebook is connected
  useEffect(() => {
    if (currentStep === 2 && hasFacebookToken === true && adAccounts.length === 0) {
      fetchAdAccounts();
    }
  }, [currentStep, hasFacebookToken]);

  const checkFacebookAuth = async () => {
    if (!userEmail) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/user/check-auth?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();

      if (res.ok) {
        setHasFacebookToken(data.hasFacebookToken);
      } else {
        setError(data.error || 'Failed to check authentication');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdAccounts = async () => {
    if (!userEmail) return;

    setIsLoadingAccounts(true);
    setError(null);
    try {
      const res = await fetch(`/api/facebook/accounts?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();

      if (res.ok) {
        setAdAccounts(data.accounts || []);
      } else {
        setError(data.error || 'Failed to fetch ad accounts');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ad accounts');
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleStep1Next = () => {
    // Validation
    if (!formData.name.trim()) {
      setError('Please enter a name for your flux');
      return;
    }

    if (!formData.sheetUrl.trim()) {
      setError('Please enter a Google Sheets URL');
      return;
    }

    // Validate Google Sheets URL
    const isValidUrl = formData.sheetUrl.includes('docs.google.com/spreadsheets') ||
                       formData.sheetUrl.includes('/spreadsheets/d/');
    
    if (!isValidUrl) {
      setError('Please enter a valid Google Sheets URL');
      return;
    }

    if (!formData.template) {
      setError('Please select a template type');
      return;
    }

    setError(null);
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!formData.adAccountId) {
      setError('Please select an ad account');
      return;
    }
    setError(null);
    setCurrentStep(3);
  };

  const handleSubmit = async () => {
    if (!userEmail) {
      router.push('/');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/fluxes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          name: formData.name,
          sheetUrl: formData.sheetUrl,
          template: formData.template,
          adAccountId: formData.adAccountId
        })
      });

      const data = await res.json();

      if (res.ok) {
        // Clear localStorage and redirect
        localStorage.removeItem('fluxFormData');
        router.push('/dashboard');
      } else {
        setError(data.error || 'Failed to create flux');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create flux');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectFacebook = () => {
    if (!userEmail) return;
    window.location.href = `/api/auth/facebook/login?email=${encodeURIComponent(userEmail)}`;
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!userEmail) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              Flux
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
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
              Destination
            </span>
            <span className={currentStep >= 2 ? 'text-blue-600 font-semibold' : ''}>
              Source
            </span>
            <span className={currentStep >= 3 ? 'text-blue-600 font-semibold' : ''}>
              Review
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Step 1: Destination */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Destination (Google Sheets)</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flux Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="e.g., Q4 Campaign"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Sheets URL
                </label>
                <input
                  type="url"
                  value={formData.sheetUrl}
                  onChange={(e) => updateFormData('sheetUrl', e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Paste the full URL of your Google Sheet
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Type
                </label>
                <select
                  value={formData.template}
                  onChange={(e) => updateFormData('template', e.target.value as 'Hourly' | 'Daily')}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a template</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Daily">Daily</option>
                </select>
              </div>

              <button
                onClick={handleStep1Next}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Source */}
        {currentStep === 2 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Source (Facebook Ads)</h2>

            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Checking authentication...</p>
              </div>
            )}

            {!isLoading && hasFacebookToken === false && (
              <div className="space-y-6">
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 mb-4">
                    You need to connect your Facebook account to sync ad data.
                  </p>
                  <button
                    onClick={handleConnectFacebook}
                    className="px-6 py-3 bg-[#1877F2] text-white font-semibold rounded-lg hover:bg-[#166FE5] transition-colors"
                  >
                    Connect Facebook
                  </button>
                </div>
              </div>
            )}

            {!isLoading && hasFacebookToken === true && (
              <div className="space-y-6">
                {isLoadingAccounts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading ad accounts...</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Ad Account
                      </label>
                      <select
                        value={formData.adAccountId}
                        onChange={(e) => {
                          const selected = adAccounts.find(acc => acc.account_id === e.target.value);
                          updateFormData('adAccountId', e.target.value);
                          updateFormData('adAccountName', selected?.name || '');
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select an ad account</option>
                        {adAccounts
                          .filter(acc => acc.account_status === 1)
                          .map((account) => (
                            <option key={account.account_id} value={account.account_id}>
                              {account.name} ({account.account_id}) - {account.currency}
                            </option>
                          ))}
                      </select>
                      {adAccounts.filter(acc => acc.account_status === 1).length === 0 && (
                        <p className="mt-2 text-sm text-red-600">
                          No active ad accounts found. Please check your Facebook Ads account.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleStep2Next}
                        disabled={!formData.adAccountId}
                        className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Launch */}
        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review & Launch</h2>

            <div className="space-y-6 mb-8">
              <div className="p-6 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4">Flux Details</h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formData.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Google Sheet</dt>
                    <dd className="mt-1 text-sm text-gray-900 break-all">{formData.sheetUrl}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Template</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formData.template}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Ad Account</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formData.adAccountName} ({formData.adAccountId})
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Flux'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

