'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const [error, setError] = useState<string | null>(null);

  // Check authentication on mount
  useEffect(() => {
    // Get email from URL params or localStorage
    const params = new URLSearchParams(window.location.search);
    const emailFromUrl = params.get('email');
    
    if (emailFromUrl) {
      localStorage.setItem('userEmail', emailFromUrl);
      setUserEmail(emailFromUrl);
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    } else {
      const emailFromStorage = localStorage.getItem('userEmail');
      if (emailFromStorage) {
        setUserEmail(emailFromStorage);
      } else {
        // No email found - redirect to home
        router.push('/');
        return;
      }
    }
  }, [router]);

  // Fetch fluxes when userEmail is available
  useEffect(() => {
    if (!userEmail) return;

    const fetchFluxes = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/fluxes?email=${encodeURIComponent(userEmail)}`);
        const data = await res.json();

        if (res.ok) {
          setFluxes(data.fluxes || []);
        } else {
          if (res.status === 404) {
            // User not found - redirect to home
            router.push('/');
          } else {
            setError(data.error || 'Failed to fetch fluxes');
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch fluxes');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFluxes();
  }, [userEmail, router]);

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    router.push('/');
  };

  const formatLastSynced = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // If no user email, don't render (redirect will happen)
  if (!userEmail) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">Flux</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title and New Flux Button */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Your Fluxes</h2>
          <Link
            href="/flux/new"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
          >
            + New Flux
          </Link>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && fluxes.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                You have no active syncs
              </h3>
              <p className="text-gray-600 mb-6">
                Create one to get started with automated ad data syncing.
              </p>
              <Link
                href="/flux/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Your First Flux
              </Link>
            </div>
          </div>
        )}

        {/* Flux Cards Grid */}
        {fluxes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fluxes.map((flux) => (
              <div
                key={flux.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {flux.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4">{flux.sheet_name}</p>
                <div className="flex items-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      flux.last_synced_at
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    Last Synced: {formatLastSynced(flux.last_synced_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

