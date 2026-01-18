import { createClient } from '@/lib/supabase/server';
import { FluxCard } from '@/components/dashboard/FluxCard';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch Fluxes for this user
  const { data: fluxes } = await supabase
    .from('fluxes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Flux Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage your ad connections and intelligence.</p>
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