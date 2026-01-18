import { createClient } from '@/lib/supabase/server';
import { FluxCard } from '@/components/dashboard/FluxCard';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { query } from '@/lib/db';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect('/login');
  }

  // Fetch Fluxes for this user
  // The fluxes table uses integer user_id referencing users.id (not Supabase auth UUID)
  // So we need to get the users.id from email first, then query fluxes
  const userResult = await query(
    'SELECT id FROM users WHERE email = $1',
    [user.email]
  );

  let fluxes = [];
  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    const fluxesResult = await query(
      'SELECT * FROM fluxes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    fluxes = fluxesResult.rows || [];
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Flux Dashboard</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Manage your ad connections and intelligence.</p>
          </div>
          <Link 
            href="/flux/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Flux
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fluxes?.map((flux) => (
            <FluxCard key={flux.id} flux={flux} />
          ))}
          
          {/* Empty State */}
          {(!fluxes || fluxes.length === 0) && (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              <p className="text-zinc-500">No fluxes active yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}