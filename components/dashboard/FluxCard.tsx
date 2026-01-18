'use client'

import { useState } from 'react';
import { updateFluxConfig } from '@/app/actions/flux';
import { Loader2 } from 'lucide-react'; 

export function FluxCard({ flux }: { flux: any }) {
  const [isPending, setIsPending] = useState(false);
  
  // Parse config if it's a string, or use it directly if it's already JSON
  const currentConfig = typeof flux.config === 'string' 
    ? JSON.parse(flux.config) 
    : flux.config || {};

  const handleToggleVisuals = async () => {
    setIsPending(true);
    const newConfig = { 
      ...currentConfig, 
      enable_visuals: !currentConfig.enable_visuals 
    };
    
    try {
      await updateFluxConfig(flux.id, newConfig);
    } catch (e) {
      alert("Failed to save settings");
    } finally {
      setIsPending(false);
    }
  };

  // Status Logic
  const lastSynced = flux.last_synced_at ? new Date(flux.last_synced_at) : null;
  const isHealthy = lastSynced && (Date.now() - lastSynced.getTime()) < 24 * 60 * 60 * 1000; 

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            {flux.ad_account_name || `Account ${flux.ad_account_id}`}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Destination: Google Sheet
          </p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
          isHealthy 
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
          {lastSynced ? `Synced ${formatTimeAgo(lastSynced)}` : 'Never Synced'}
        </div>
      </div>

      <hr className="border-zinc-100 dark:border-zinc-800 my-4" />

      <div className="space-y-4">
        
        {/* Toggle: The Visualizer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">Ad Visuals</p>
            <p className="text-xs text-zinc-500">Fetch thumbnails into spreadsheet</p>
          </div>
          
          <button
            onClick={handleToggleVisuals}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              currentConfig.enable_visuals ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                currentConfig.enable_visuals ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
          <div>
            <p className="font-medium text-zinc-800 dark:text-zinc-200">AI Performance Reporter</p>
            <p className="text-xs text-zinc-500">Coming Soon</p>
          </div>
          <div className="h-6 w-11 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>

      </div>
      
      <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
         <span className="text-[10px] font-mono text-zinc-400">ID: {flux.id}</span>
         {isPending && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}