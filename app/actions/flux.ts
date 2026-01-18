'use server'

import { createClient } from '@/lib/supabase/server'; 
import { revalidatePath } from 'next/cache';

export async function updateFluxConfig(fluxId: string, newConfig: any) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('fluxes')
    .update({ 
      config: newConfig,
      updated_at: new Date().toISOString() 
    })
    .eq('id', fluxId)
    .eq('user_id', user.id); 

  if (error) {
    console.error('Failed to update flux:', error);
    throw new Error('Failed to update settings');
  }

  revalidatePath('/dashboard');
  return { success: true };
}