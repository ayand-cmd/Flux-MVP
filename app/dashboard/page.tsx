'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ExternalLink, RefreshCw, Layers } from 'lucide-react';

interface Flux {
  id: string;
  name: string;
  last_synced_at: string | null;
  sheet_name: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fluxes, setFluxes] = useState<Flux[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Auth Check (Retained from original logic)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromUrl = params.get('email');
    
    if (emailFromUrl) {
      localStorage.setItem('userEmail', emailFromUrl);
      setUserEmail(emailFromUrl);
      window.history.replaceState({}, '', '/dashboard');
    } else {
      const emailFromStorage = localStorage.getItem('userEmail');
      if (emailFromStorage) {
        setUserEmail(emailFromStorage);
      } else {
        router.push('/');
      }
    }
  }, [router]);

  // 2. Data Fetch (Retained from original logic)
  useEffect(() => {
    if (!userEmail) return;

    const fetchFluxes = async () => {
      try {
        const res = await fetch(`/api/fluxes?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();
        if (res.ok) {
          setFluxes(data.fluxes || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFluxes();
  }, [userEmail]);

  if (!userEmail) return null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-gray-500 mt-1">Manage your active data synchronizations.</p>
        </div>
        <Link href="/flux/new">
          <button className="group flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95">
            <Plus className="w-5 h-5" />
            New Flux
          </button>
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 font-medium">Loading your fluxes...</p>
        </div>
      ) : fluxes.length === 0 ? (
        
        // Empty State
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            <Layers className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No fluxes configured</h3>
          <p className="text-gray-500 mb-8 max-w-sm">
            You haven't set up any data pipelines yet. Create your first Flux to start syncing Meta Ads to Sheets.
          </p>
          <Link href="/flux/new">
            <button className="text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-2 transition-colors">
              Create Flux <ExternalLink className="w-4 h-4" />
            </button>
          </Link>
        </div>

      ) : (
        
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fluxes.map((flux) => (
            <div 
              key={flux.id} 
              className="group bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-xl hover:shadow-gray-100 hover:border-indigo-100 transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                  <RefreshCw className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  flux.last_synced_at 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {flux.last_synced_at ? 'Active' : 'Pending'}
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-2">{flux.name}</h3>
              <p className="text-sm text-gray-500 mb-6 truncate flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                {flux.sheet_name}
              </p>
              
              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  <p>Last Sync</p>
                  <p className="font-medium text-gray-600">
                    {flux.last_synced_at 
                      ? new Date(flux.last_synced_at).toLocaleDateString() 
                      : 'Never'}
                  </p>
                </div>
                <button className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}