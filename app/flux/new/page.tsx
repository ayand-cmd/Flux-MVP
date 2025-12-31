'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, Check, AlertCircle, FileSpreadsheet, 
  Facebook, ChevronLeft, LayoutGrid, Database, BarChart3 
} from 'lucide-react';
import Link from 'next/link';

// --- Types ---
interface FormData {
  name: string;
  sheetUrl: string;
  adAccountId: string;
  granularity: 'Daily' | 'Hourly' | 'Weekly' | '';
  breakdowns: string[];
  frequency: 'Daily Update' | 'Hourly Update' | '';
  analysis_logic: boolean;
  raw_data_tab: string;
  analysis_tab: string;
}

interface AdAccount { account_id: string; name: string; currency: string; account_status: number; }
interface Tab { title: string; sheetId: number; }

export default function NewFlux() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasFacebookToken, setHasFacebookToken] = useState<boolean | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    sheetUrl: '',
    adAccountId: '',
    granularity: 'Daily',
    breakdowns: [],
    frequency: 'Daily Update',
    analysis_logic: false,
    raw_data_tab: '',
    analysis_tab: ''
  });

  // --- Logic Integration ---
  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (!email) { router.push('/'); return; }
    setUserEmail(email);
  }, [router]);

  useEffect(() => {
    if (currentStep === 2 && userEmail && hasFacebookToken === null) checkFacebookAuth();
  }, [currentStep, userEmail]);

  useEffect(() => {
    if (currentStep === 2 && hasFacebookToken === true && adAccounts.length === 0) fetchAdAccounts();
  }, [currentStep, hasFacebookToken]);

  const checkFacebookAuth = async () => {
    if (!userEmail) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/user/check-auth?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      setHasFacebookToken(res.ok ? data.hasFacebookToken : false);
    } catch (err) { setError('Auth check failed'); } 
    finally { setIsLoading(false); }
  };

  const fetchAdAccounts = async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/facebook/accounts?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (res.ok) setAdAccounts(data.accounts || []);
    } catch (err) { setError('Failed to fetch accounts'); }
  };

  const handleStep1Next = async () => {
    if (!formData.name) return setError('Please name your flux');
    if (!formData.sheetUrl.includes('docs.google.com/spreadsheets')) return setError('Invalid Google Sheet URL');
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/sheets/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, sheetUrl: formData.sheetUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setTabs(data.tabs || []);
        setError(null);
        setCurrentStep(2);
      } else {
        setError(data.error || 'Failed to access sheet. Make sure the sheet is public or shared with the service account.');
      }
    } catch (err) { setError('Failed to access sheet'); }
    finally { setIsLoading(false); }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/fluxes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          name: formData.name,
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

      if (res.ok) router.push('/dashboard');
      else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) { setError('Failed to create flux'); }
    finally { setIsLoading(false); }
  };

  // --- Helper Components ---
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      {[
        { n: 1, label: "Destination" },
        { n: 2, label: "Source" },
        { n: 3, label: "Config" },
        { n: 4, label: "Mapping" }
      ].map((step, i) => (
        <div key={step.n} className="flex flex-col items-center relative z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
            currentStep >= step.n ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'
          }`}>
            {currentStep > step.n ? <Check className="w-4 h-4" /> : step.n}
          </div>
          <span className={`text-xs mt-2 font-medium ${currentStep >= step.n ? 'text-indigo-600' : 'text-gray-400'}`}>
            {step.label}
          </span>
        </div>
      ))}
      {/* Progress Bar Line */}
      <div className="absolute top-4 left-0 w-full h-[2px] bg-gray-100 -z-0">
        <div 
          className="h-full bg-indigo-600 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      
      {/* Top Navigation */}
      <div className="absolute top-8 left-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>

      <div className="max-w-xl w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Configure Flux</h1>
          <p className="text-gray-500 mt-2">Connect your data sources in 4 simple steps.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden relative">
          
          <div className="p-8">
            <div className="relative mb-8">
               <StepIndicator />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl flex items-start gap-3 border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="min-h-[300px]">
              {/* STEP 1: DESTINATION */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Flux Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-gray-900 placeholder:text-gray-400"
                      placeholder="e.g. Q4 Marketing Report"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Google Sheets URL</label>
                    <div className="relative">
                      <FileSpreadsheet className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      <input 
                        type="url" 
                        className="w-full pl-12 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-gray-900 placeholder:text-gray-400"
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={formData.sheetUrl}
                        onChange={(e) => setFormData({...formData, sheetUrl: e.target.value})}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <LayoutGrid className="w-3 h-3" />
                      Must be accessible by the service account.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: SOURCE */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                  <div className="p-5 border border-indigo-100 bg-indigo-50/50 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center shrink-0 shadow-sm">
                      <Facebook className="w-5 h-5 text-white" fill="currentColor" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Meta Ads Source</h4>
                      <p className="text-sm text-gray-500">Connect your ad account.</p>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : !hasFacebookToken ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-6">Authorization required to fetch ad accounts.</p>
                      <a href={`/api/auth/facebook/login?email=${encodeURIComponent(userEmail || '')}`}
                         className="inline-flex items-center gap-2 px-6 py-3 bg-[#1877F2] text-white font-medium rounded-xl hover:bg-[#166FE5] transition-colors shadow-lg shadow-blue-200">
                        Connect with Facebook
                      </a>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Select Ad Account</label>
                      <select 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                        value={formData.adAccountId}
                        onChange={(e) => setFormData({...formData, adAccountId: e.target.value})}
                      >
                        <option value="">Choose an account...</option>
                        {adAccounts.map(acc => (
                          <option key={acc.account_id} value={acc.account_id}>{acc.name} ({acc.currency})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: CONFIG */}
              {currentStep === 3 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Time Granularity</label>
                      <div className="grid grid-cols-2 gap-4">
                        {['Daily', 'Weekly'].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setFormData({...formData, granularity: opt as any})}
                            className={`py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                              formData.granularity === opt 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-white rounded-lg border border-gray-200">
                             <BarChart3 className="w-5 h-5 text-indigo-600" />
                           </div>
                           <div>
                             <h5 className="font-semibold text-gray-900">Enable AI Analysis</h5>
                             <p className="text-xs text-gray-500">Automatically generate insights tab.</p>
                           </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={formData.analysis_logic} onChange={(e) => setFormData({...formData, analysis_logic: e.target.checked})} />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                 </div>
              )}

              {/* STEP 4: MAPPING */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                   <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <Database className="w-4 h-4 inline mr-2 text-gray-400" />
                        Raw Data Destination
                      </label>
                      <select 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={formData.raw_data_tab}
                        onChange={(e) => setFormData({...formData, raw_data_tab: e.target.value})}
                      >
                        <option value="">Select a sheet tab...</option>
                        {tabs.map(t => <option key={t.sheetId} value={t.title}>{t.title}</option>)}
                        <option value="__CREATE_NEW_DATA__" className="font-bold">+ Create New Tab</option>
                      </select>
                   </div>
                   
                   {formData.analysis_logic && (
                     <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          <BarChart3 className="w-4 h-4 inline mr-2 text-gray-400" />
                          Analysis Destination
                        </label>
                        <select 
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={formData.analysis_tab}
                          onChange={(e) => setFormData({...formData, analysis_tab: e.target.value})}
                        >
                          <option value="">Select a sheet tab...</option>
                          {tabs.map(t => <option key={t.sheetId} value={t.title}>{t.title}</option>)}
                          <option value="__CREATE_NEW_ANALYSIS__" className="font-bold">+ Create New Tab</option>
                        </select>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            {currentStep > 1 ? (
              <button 
                onClick={() => setCurrentStep(c => c - 1)}
                className="px-6 py-2.5 text-gray-600 font-medium hover:text-gray-900 transition-colors"
              >
                Back
              </button>
            ) : (
              <div></div>
            )}

            <button 
              onClick={() => {
                if (currentStep === 1) handleStep1Next();
                else if (currentStep === 2) setCurrentStep(3);
                else if (currentStep === 3) setCurrentStep(4);
                else handleSubmit();
              }}
              disabled={isLoading || (currentStep === 2 && !formData.adAccountId) || (currentStep === 4 && !formData.raw_data_tab)}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : currentStep === 4 ? 'Launch Flux' : 'Next Step'}
              {!isLoading && currentStep !== 4 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}