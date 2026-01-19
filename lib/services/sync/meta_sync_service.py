"""
Meta Creative Sync Service

Syncs Meta creative performance data to Supabase tables:
- dim_creatives: Creative dimension table
- fact_creative_daily: Daily performance facts
"""

import os
import sys
from typing import Dict, List, Any, Optional
from supabase import create_client, Client
from datetime import datetime

# Add project root to path for imports
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from lib.services.connector.meta_creative_fetcher import fetch_creative_performance


def get_supabase_client() -> Client:
    """
    Initialize and return Supabase client.
    
    Uses service role key if available (bypasses RLS), otherwise falls back to anon key.
    For backend services, service role key is recommended.
    
    Returns:
        Supabase client instance
        
    Raises:
        ValueError: If required environment variables are missing
    """
    supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    
    # Prefer service role key for backend operations (bypasses RLS)
    # Fall back to anon key if service role is not available
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing Supabase credentials. "
            "Please set NEXT_PUBLIC_SUPABASE_URL and either "
            "SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY"
        )
    
    return create_client(supabase_url, supabase_key)


def sync_meta_creative_data(
    user_id: int,
    ad_account_id: str,
    access_token: str,
    date_preset: str = 'last_3d'
) -> str:
    """
    Syncs Meta creative performance data to Supabase.
    
    Args:
        user_id: User ID (for future RLS policies)
        ad_account_id: Meta Ad Account ID (e.g., 'act_123456789')
        access_token: Meta API access token
        date_preset: Date preset for insights (default: 'last_3d')
    
    Returns:
        Summary string describing what was synced
        
    Raises:
        Exception: If sync fails
    """
    print(f"🔄 Starting Meta Creative Sync for user {user_id}...")
    
    # Initialize Supabase client
    supabase = get_supabase_client()
    
    # ============================================
    # STEP 1: Fetch Data from Meta API
    # ============================================
    print("📥 Step 1: Fetching data from Meta API...")
    
    try:
        data = fetch_creative_performance(
            ad_account_id=ad_account_id,
            access_token=access_token,
            date_preset=date_preset
        )
    except Exception as e:
        print(f"❌ Failed to fetch data from Meta API: {e}")
        raise
    
    creatives = data.get('creatives', [])
    performance = data.get('performance', [])
    
    if not creatives and not performance:
        return "No data to sync"
    
    print(f"   ✅ Fetched {len(creatives)} creatives and {len(performance)} performance rows")
    
    # ============================================
    # PHASE 1: Sync Dimension (Creatives)
    # ============================================
    print("📊 Phase 1: Syncing creatives to dim_creatives...")
    
    # Prepare creatives for upsert
    creatives_to_upsert = []
    for creative in creatives:
        creative_row = {
            'platform_id': str(creative.get('id', '')),
            'platform': 'meta',
            'name': creative.get('name') or None,
            'thumbnail_url': creative.get('thumbnail_url') or None,
            'body_copy': creative.get('body') or None,
            'headline': creative.get('title') or None,
            'updated_at': datetime.utcnow().isoformat()
        }
        creatives_to_upsert.append(creative_row)
    
    if creatives_to_upsert:
        try:
            # Upsert creatives using platform_id as conflict key
            # Supabase upsert requires specifying the conflict column
            # Since platform_id has a UNIQUE constraint, we can use it for conflict resolution
            result = supabase.table('dim_creatives').upsert(
                creatives_to_upsert,
                on_conflict='platform_id'
            ).execute()
            
            print(f"   ✅ Upserted {len(creatives_to_upsert)} creatives")
        except Exception as e:
            # If on_conflict parameter doesn't work, try without it (Supabase should auto-detect)
            try:
                result = supabase.table('dim_creatives').upsert(
                    creatives_to_upsert
                ).execute()
                print(f"   ✅ Upserted {len(creatives_to_upsert)} creatives (without explicit on_conflict)")
            except Exception as e2:
                print(f"   ❌ Failed to upsert creatives: {e2}")
                raise
    
    # Retrieve mapping: platform_id -> internal UUID
    print("   🔍 Retrieving creative ID mapping...")
    platform_id_to_uuid: Dict[str, str] = {}
    
    try:
        # Fetch all creatives we just upserted to get their UUIDs
        platform_ids = [str(c.get('id', '')) for c in creatives if c.get('id')]
        
        if platform_ids:
            # Query in batches to avoid URL length issues
            batch_size = 100
            for i in range(0, len(platform_ids), batch_size):
                batch = platform_ids[i:i + batch_size]
                # Query by platform_id using .in_() filter
                # Supabase Python client uses: .in_('column_name', [values])
                response = supabase.table('dim_creatives').select('id, platform_id').in_(
                    'platform_id', batch
                ).execute()
                
                if response.data:
                    for row in response.data:
                        platform_id_to_uuid[row['platform_id']] = row['id']
        
        print(f"   ✅ Mapped {len(platform_id_to_uuid)} creatives to UUIDs")
    except Exception as e:
        print(f"   ❌ Failed to retrieve creative mapping: {e}")
        raise
    
    # ============================================
    # PHASE 2: Sync Facts (Performance)
    # ============================================
    print("📈 Phase 2: Syncing performance to fact_creative_daily...")
    
    # Prepare performance rows for upsert
    performance_to_upsert = []
    skipped_count = 0
    
    for perf in performance:
        meta_creative_id = str(perf.get('creative_id', ''))
        internal_creative_id = platform_id_to_uuid.get(meta_creative_id)
        
        # Skip rows where creative UUID is missing
        if not internal_creative_id:
            skipped_count += 1
            continue
        
        # Parse date and ad_id (required for unique constraint)
        date_str = perf.get('date', '')
        ad_id = perf.get('ad_id', '')
        
        if not date_str or not ad_id:
            skipped_count += 1
            continue
        
        # Map metrics (no aggregation - direct mapping from fetcher)
        performance_row = {
            'creative_id': internal_creative_id,
            'user_id': user_id,  # Add user_id for data isolation
            'ad_id': ad_id,
            'ad_name': perf.get('ad_name') or None,
            'adset_id': perf.get('adset_id') or None,
            'adset_name': perf.get('adset_name') or None,
            'campaign_id': perf.get('campaign_id') or None,
            'campaign_name': perf.get('campaign_name') or None,
            'date': date_str,
            'spend': float(perf.get('spend', 0) or 0),
            'impressions': int(perf.get('impressions', 0) or 0),
            'clicks': int(perf.get('clicks', 0) or 0),
            'link_clicks': int(perf.get('outbound_clicks', 0) or 0),
            'purchases': int(perf.get('conversions', 0) or 0),
            'revenue': float(perf.get('purchase_value', 0) or 0),
            'currency': 'USD',  # Default, can be made dynamic later
            'updated_at': datetime.utcnow().isoformat()
        }
        performance_to_upsert.append(performance_row)
    
    if skipped_count > 0:
        print(f"   ⚠️ Skipped {skipped_count} performance rows (missing creative mapping)")
    
    if performance_to_upsert:
        try:
            # Upsert performance data using (ad_id, date, user_id) as conflict key
            # Supabase handles unique constraints automatically
            # We need to upsert in batches to handle the unique constraint properly
            batch_size = 100
            total_upserted = 0
            
            for i in range(0, len(performance_to_upsert), batch_size):
                batch = performance_to_upsert[i:i + batch_size]
                
                # Upsert performance data using (ad_id, date, user_id) as conflict key
                # Try with explicit on_conflict first
                try:
                    result = supabase.table('fact_creative_daily').upsert(
                        batch,
                        on_conflict='ad_id,date,user_id'
                    ).execute()
                except Exception:
                    # Fallback: Supabase should auto-detect unique constraint
                    result = supabase.table('fact_creative_daily').upsert(
                        batch
                    ).execute()
                
                total_upserted += len(batch)
            
            print(f"   ✅ Upserted {total_upserted} performance rows")
        except Exception as e:
            print(f"   ❌ Failed to upsert performance data: {e}")
            raise
    
    # ============================================
    # Return Summary
    # ============================================
    summary = f"Synced {len(creatives_to_upsert)} creatives and {len(performance_to_upsert)} daily rows"
    if skipped_count > 0:
        summary += f" (skipped {skipped_count} rows)"
    
    print(f"✅ Sync Complete: {summary}")
    return summary

