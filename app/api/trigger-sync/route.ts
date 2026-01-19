import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Check if user is logged in (Supabase Auth)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { ad_account_id } = body;

    if (!ad_account_id) {
      return NextResponse.json(
        { error: 'Missing required field: ad_account_id' },
        { status: 400 }
      );
    }

    // 3. Look up user data from users table
    // Get the integer user.id and fb_exchange_token
    const userResult = await query(
      'SELECT id, fb_exchange_token FROM users WHERE email = $1',
      [user.email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const { id: userId, fb_exchange_token } = userResult.rows[0];

    if (!fb_exchange_token) {
      return NextResponse.json(
        { error: 'Facebook access token not found. Please connect your Facebook account first.' },
        { status: 400 }
      );
    }

    // 4. Validate WORKER_URL is configured
    const workerUrl = process.env.WORKER_URL;
    if (!workerUrl) {
      console.error('WORKER_URL environment variable is not set');
      return NextResponse.json(
        { error: 'Worker service is not configured' },
        { status: 500 }
      );
    }

    // 5. Trigger the Python worker
    try {
      const workerResponse = await fetch(`${workerUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          ad_account_id: ad_account_id,
          access_token: fb_exchange_token,
        }),
      });

      // Get response from worker
      const workerData = await workerResponse.json();

      // If worker returned an error status
      if (!workerResponse.ok) {
        return NextResponse.json(
          {
            error: workerData.message || 'Worker request failed',
            status: workerData.status || 'error',
          },
          { status: workerResponse.status }
        );
      }

      // 6. Return the JSON response from worker
      return NextResponse.json(workerData, { status: 200 });

    } catch (fetchError: any) {
      console.error('Error calling worker:', fetchError);
      return NextResponse.json(
        {
          error: `Failed to connect to worker service: ${fetchError.message}`,
          status: 'error',
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error in trigger-sync route:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        status: 'error',
      },
      { status: 500 }
    );
  }
}

