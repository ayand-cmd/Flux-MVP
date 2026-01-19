'use client'

import { useEffect, useState } from 'react';
import { Facebook, Globe, Loader2 } from 'lucide-react';

interface CreativeData {
  id: string;
  platform_id: string;
  platform: 'meta' | 'google';
  name: string | null;
  thumbnail_url: string | null;
  body_copy: string | null;
  headline: string | null;
  format: string | null;
  first_seen_date: string | null;
  created_at: string;
  updated_at: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  roas: number | null;
}

export function CreativeTable() {
  const [data, setData] = useState<CreativeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/analytics/creatives');
        
        if (!response.ok) {
          throw new Error('Failed to fetch creative data');
        }

        const result = await response.json();
        setData(result.data || []);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        console.error('Error fetching creatives:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <CreativeTableSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/30 rounded-xl p-6">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">No creative data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Creative
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Spend
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Impressions
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                ROAS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.map((creative) => (
              <tr
                key={creative.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    {creative.thumbnail_url ? (
                      <img
                        src={creative.thumbnail_url}
                        alt={creative.name || 'Creative thumbnail'}
                        className="w-12 h-12 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {creative.name || creative.headline || 'Untitled Creative'}
                      </p>
                      {creative.body_copy && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xs">
                          {creative.body_copy}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {creative.platform === 'meta' ? (
                      <Facebook className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Globe className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    )}
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 capitalize">
                      {creative.platform}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    ${creative.total_spend.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {creative.total_impressions.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {creative.roas !== null ? (
                    <span className={`text-sm font-medium ${
                      creative.roas >= 3
                        ? 'text-green-600 dark:text-green-400'
                        : creative.roas >= 2
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}>
                      {creative.roas.toFixed(2)}x
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreativeTableSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Creative
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Spend
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Impressions
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                ROAS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

