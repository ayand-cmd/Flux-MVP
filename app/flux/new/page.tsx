'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Tab {
  title: string;
  sheetId: number;
}

interface FormData {
  name: string;
  sheetUrl: string;
  adAccountId: string;
  adAccountName: string;
  granularity: 'Daily' | 'Hourly' | 'Weekly' | '';
  breakdowns: string[];
  frequency: 'Daily Update' | 'Hourly Update' | '';
  analysis_logic: boolean;
  raw_data_tab: string;
  analysis_tab: string;
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    sheetUrl: '',
    adAccountId: '',
    adAccountName: '',
    granularity: '',
    breakdowns: [],
    frequency: 'Daily Update',
    analysis_logic: false,
    raw_data_tab: '',
    analysis_tab: ''
  });

  const breakdownOptions = ['Age', 'Gender', 'Platform', 'Region'];

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
        // Restore step based on data
        if (parsed.sheetUrl && tabs.length > 0) {
          if (parsed.adAccountId) {
            if (parsed.granularity) {
              setCurrentStep(4);
            } else {
              setCurrentStep(3);
            }
          } else {
            setCurrentStep(2);
          }
        }
      } catch (e) {
        console.error('Error loading saved form data:', e);
      }
    }
  }, [router]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (userEmail) {
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

  const fetchSheetMetadata = async () => {
    if (!userEmail || !formData.sheetUrl) return;

    setIsLoadingTabs(true);
    setError(null);
    try {
      const res = await fetch('/api/sheets/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          sheetUrl: formData.sheetUrl
        })
      });

      const data = await res.json();

      if (res.ok) {
        setTabs(data.tabs || []);
        return true;
      } else {
        setError(data.error || 'Failed to fetch sheet metadata');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sheet metadata');
      return false;
    } finally {
      setIsLoadingTabs(false);
    }
  };

  const handleStep1Next = async () => {
    // Validation
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

    setError(null);
    const success = await fetchSheetMetadata();
    
    if (success) {
      setCurrentStep(2);
    }
  };

  const handleStep2Next = () => {
    if (!formData.adAccountId) {
      setError('Please select an ad account');
      return;
    }
    setError(null);
    setCurrentStep(3);
  };

  const handleStep3Next = () => {
    if (!formData.granularity) {
      setError('Please select a granularity');
      return;
    }
    if (!formData.frequency) {
      setError('Please select a frequency');
      return;
    }
    setError(null);
    setCurrentStep(4);
  };

  const handleSubmit = async () => {
    if (!userEmail) {
      router.push('/');
      return;
    }

    // Validation
    if (!formData.raw_data_tab || !formData.analysis_tab) {
      setError('Please select both Raw Data and Analysis tabs');
      return;
    }

    if (formData.raw_data_tab === formData.analysis_tab) {
      setError('Raw Data and Analysis tabs must be different');
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
          name: formData.name || `Flux ${new Date().toLocaleDateString()}`,
          sheetUrl: formData.sheetUrl,
          adAccountId: formData.adAccountId,
          config: {
            granularity: formData.granularity,
            breakdowns: formData.breakdowns,
            frequency: formData.frequency,
            analysis_logic: formData.analysis_logic
          },
          destination_mapping: {
            raw_data_tab: formData.raw_data_tab,
            analysis_tab: formData.analysis_tab
          }
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

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleBreakdown = (breakdown: string) => {
    setFormData(prev => ({
      ...prev,
      breakdowns: prev.breakdowns.includes(breakdown)
        ? prev.breakdowns.filter(b => b !== breakdown)
        : [...prev.breakdowns, breakdown]
    }));
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
            {[1, 2, 3, 4].map((step) => (
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
                {step < 4 && (
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
              Configuration
            </span>
            <span className={currentStep >= 4 ? 'text-blue-600 font-semibold' : ''}>
              Mapping
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 1 of 4: Destination (Google Sheets)</h2>
            
            <div className="space-y-6">
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

              <button
                onClick={handleStep1Next}
                disabled={isLoadingTabs}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLoadingTabs ? 'Fetching Sheet Info...' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Source */}
        {currentStep === 2 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 2 of 4: Source (Meta Ads)</h2>

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

        {/* Step 3: Configuration */}
        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 3 of 4: Configuration</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Granularity
                </label>
                <select
                  value={formData.granularity}
                  onChange={(e) => updateFormData('granularity', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select granularity</option>
                  <option value="Daily">Daily</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Breakdowns
                </label>
                <div className="flex flex-wrap gap-2">
                  {breakdownOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleBreakdown(option)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        formData.breakdowns.includes(option)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Select one or more breakdown dimensions
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="frequency"
                      value="Daily Update"
                      checked={formData.frequency === 'Daily Update'}
                      onChange={(e) => updateFormData('frequency', e.target.value)}
                      className="mr-3"
                    />
                    <span>Daily Update</span>
                  </label>
                  <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-not-allowed opacity-50 bg-gray-50">
                    <input
                      type="radio"
                      name="frequency"
                      value="Hourly Update"
                      disabled
                      className="mr-3"
                    />
                    <span className="flex items-center gap-2">
                      Hourly Update
                      <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                        Coming Soon
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.analysis_logic}
                    onChange={(e) => updateFormData('analysis_logic', e.target.checked)}
                    className="mr-3"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Include Performance Analysis
                  </span>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleStep3Next}
                  disabled={!formData.granularity || !formData.frequency}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Mapping */}
        {currentStep === 4 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 4 of 4: Mapping</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raw Data Destination
                </label>
                <select
                  value={formData.raw_data_tab}
                  onChange={(e) => updateFormData('raw_data_tab', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a tab</option>
                  {tabs.map((tab) => (
                    <option key={tab.sheetId} value={tab.title}>
                      {tab.title}
                    </option>
                  ))}
                  <option value="__CREATE_NEW_DATA__">Create New "Data" Tab</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Analysis Destination
                </label>
                <select
                  value={formData.analysis_tab}
                  onChange={(e) => updateFormData('analysis_tab', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a tab</option>
                  {tabs.map((tab) => (
                    <option key={tab.sheetId} value={tab.title}>
                      {tab.title}
                    </option>
                  ))}
                  <option value="__CREATE_NEW_ANALYSIS__">Create New "Analysis" Tab</option>
                </select>
                {formData.raw_data_tab && formData.analysis_tab && formData.raw_data_tab === formData.analysis_tab && (
                  <p className="mt-2 text-sm text-red-600">
                    Raw Data and Analysis tabs must be different
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !formData.raw_data_tab || !formData.analysis_tab || formData.raw_data_tab === formData.analysis_tab}
                  className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create Flux'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
