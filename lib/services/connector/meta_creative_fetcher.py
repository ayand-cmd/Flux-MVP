"""
Meta Creative Performance Fetcher

Fetches ad-level performance data and creative assets from Meta Ads API.
Returns data structured for dim_creatives and fact_creative_daily tables.
"""

import time
import json
import requests
import sys
from typing import Dict, List, Any, Optional
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.exceptions import FacebookRequestError

# Force unbuffered output for real-time logging
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None


def fetch_creative_performance(
    ad_account_id: str,
    access_token: str,
    date_preset: str = 'last_3d'
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetches performance at the Ad level, maps Ads to Creatives, 
    and then fetches Creative thumbnails.
    
    Args:
        ad_account_id: Meta Ad Account ID (e.g., 'act_123456789')
        access_token: Meta API access token
        date_preset: Date preset for insights (default: 'last_3d')
    
    Returns:
        Dictionary with two keys:
        - 'creatives': List of unique creative attributes
        - 'performance': List of daily performance stats
    
    Raises:
        FacebookRequestError: If API request fails
        Exception: For other errors
    """
    try:
        # Initialize API
        FacebookAdsApi.init(access_token=access_token)
        
        # Ensure ad_account_id has 'act_' prefix
        if not ad_account_id.startswith('act_'):
            ad_account_id = f'act_{ad_account_id}'
        
        account = AdAccount(ad_account_id)

        # ---------------------------------------------------------
        # STEP 1: Get Performance (Level = Ad)
        # Note: We CANNOT ask for 'creative_id' here. We get 'ad_id'.
        # ---------------------------------------------------------
        print(f"🔍 Step 1: Fetching ad insights...")
        
        insight_params = {
            'level': 'ad',
            'date_preset': date_preset,
            'time_increment': 1,
            'limit': 100  # Reduced to avoid API limits
        }
        
        insight_fields = [
            'ad_id', 'ad_name', 'adset_id', 'adset_name', 
            'campaign_id', 'campaign_name',
            'spend', 'impressions', 'clicks', 
            'outbound_clicks', 'actions', 'action_values',
            'date_start', 'date_stop'
        ]

        insights = account.get_insights(fields=insight_fields, params=insight_params)
        
        # Convert to list to avoid cursor timeout and allow processing
        insights_data = [dict(x) for x in insights]
        print(f"   ✅ Found {len(insights_data)} performance rows.")

        if not insights_data:
            return {'creatives': [], 'performance': []}

        # ---------------------------------------------------------
        # STEP 2: Map Ad IDs -> Creative IDs
        # We need to fetch the 'Ad' objects to find out which creative they use.
        # ---------------------------------------------------------
        print(f"🔗 Step 2: Mapping Ads to Creatives...")
        
        # Extract unique Ad IDs from the insights
        unique_ad_ids = list(set([row['ad_id'] for row in insights_data if 'ad_id' in row]))
        
        # Batch fetch Ads to get their creative_id
        # chunking is safer for large accounts
        ad_id_to_creative_id = {}
        
        # Simple chunker (50 ids per request is safe for Graph API)
        chunk_size = 50
        for i in range(0, len(unique_ad_ids), chunk_size):
            chunk = unique_ad_ids[i:i + chunk_size]
            print(f"   Processing ad batch {i // chunk_size + 1} ({len(chunk)} ads)...")
            try:
                ads = Ad.get_by_ids(
                    ids=chunk,
                    fields=['creative']
                )
                # Map them: ad_id -> creative_id
                for ad in ads:
                    ad_dict = dict(ad)
                    ad_id = ad_dict.get('id')
                    # 'creative' field comes back as {'id': '...'}
                    if 'creative' in ad_dict and ad_id:
                        creative_obj = ad_dict['creative']
                        if isinstance(creative_obj, dict) and 'id' in creative_obj:
                            ad_id_to_creative_id[ad_id] = creative_obj['id']
                        elif hasattr(creative_obj, 'get') and creative_obj.get('id'):
                            ad_id_to_creative_id[ad_id] = creative_obj.get('id')
            except FacebookRequestError as e:
                error_code = e.api_error_code() if hasattr(e, 'api_error_code') else None
                if 'rate limit' in str(e).lower() or error_code == 4:
                    print(f"   ⏳ Rate limit hit. Waiting 60 seconds...")
                    time.sleep(60)
                    # Retry the batch
                    try:
                        ads = Ad.get_by_ids(ids=chunk, fields=['creative'])
                        for ad in ads:
                            ad_dict = dict(ad)
                            ad_id = ad_dict.get('id')
                            if 'creative' in ad_dict and ad_id:
                                creative_obj = ad_dict['creative']
                                if isinstance(creative_obj, dict) and 'id' in creative_obj:
                                    ad_id_to_creative_id[ad_id] = creative_obj['id']
                    except Exception:
                        print(f"   ⚠️ Failed to retry batch after rate limit")
                        continue
                else:
                    print(f"   ⚠️ Error fetching ad batch: {e}")
                    continue
            except Exception as e:
                print(f"   ⚠️ Unexpected error fetching ad batch: {e}")
                continue

        print(f"   ✅ Mapped {len(ad_id_to_creative_id)} ads to creatives")

        # ---------------------------------------------------------
        # STEP 3: Get Creative Assets (Thumbnails)
        # Now we have the creative IDs, let's get the images.
        # ---------------------------------------------------------
        unique_creative_ids = list(set(ad_id_to_creative_id.values()))
        print(f"🎨 Step 3: Fetching {len(unique_creative_ids)} unique creatives...")
        
        # Fetch creative details
        creatives_map = {}  # Store details by ID for easy lookup
        
        for i in range(0, len(unique_creative_ids), chunk_size):
            chunk = unique_creative_ids[i:i + chunk_size]
            print(f"   Processing creative batch {i // chunk_size + 1} ({len(chunk)} creatives)...")
            try:
                creative_objects = AdCreative.get_by_ids(
                    ids=chunk,
                    fields=['name', 'thumbnail_url', 'image_url', 'object_story_spec', 'body', 'title', 'call_to_action_type']
                )
                
                for c in creative_objects:
                    c_data = dict(c)
                    # Smart Thumbnail Logic
                    thumb = c_data.get('thumbnail_url') or c_data.get('image_url')
                    
                    # Try to dig into video data if image is missing
                    if not thumb and 'object_story_spec' in c_data:
                        spec = c_data['object_story_spec']
                        if isinstance(spec, dict):
                            if 'video_data' in spec:
                                video_data = spec['video_data']
                                if isinstance(video_data, dict):
                                    thumb = video_data.get('image_url') or video_data.get('picture')
                            elif 'link_data' in spec:
                                link_data = spec['link_data']
                                if isinstance(link_data, dict):
                                    thumb = link_data.get('picture') or link_data.get('image_url')

                    creatives_map[c_data['id']] = {
                        'id': c_data['id'],
                        'name': c_data.get('name', 'Unknown'),
                        'thumbnail_url': thumb or '',
                        'body': c_data.get('body') or '',
                        'title': c_data.get('title') or '',
                        'call_to_action_type': c_data.get('call_to_action_type') or '',
                        'platform': 'meta'
                    }
            except FacebookRequestError as e:
                error_code = e.api_error_code() if hasattr(e, 'api_error_code') else None
                if 'rate limit' in str(e).lower() or error_code == 4:
                    print(f"   ⏳ Rate limit hit. Waiting 60 seconds...")
                    time.sleep(60)
                    # Retry the batch
                    try:
                        creative_objects = AdCreative.get_by_ids(
                            ids=chunk,
                            fields=['name', 'thumbnail_url', 'image_url', 'object_story_spec', 'body', 'title', 'call_to_action_type']
                        )
                        for c in creative_objects:
                            c_data = dict(c)
                            thumb = c_data.get('thumbnail_url') or c_data.get('image_url')
                            if not thumb and 'object_story_spec' in c_data:
                                spec = c_data['object_story_spec']
                                if isinstance(spec, dict):
                                    if 'video_data' in spec:
                                        video_data = spec['video_data']
                                        if isinstance(video_data, dict):
                                            thumb = video_data.get('image_url') or video_data.get('picture')
                            creatives_map[c_data['id']] = {
                                'id': c_data['id'],
                                'name': c_data.get('name', 'Unknown'),
                                'thumbnail_url': thumb or '',
                                'body': c_data.get('body') or '',
                                'title': c_data.get('title') or '',
                                'call_to_action_type': c_data.get('call_to_action_type') or '',
                                'platform': 'meta'
                            }
                    except Exception:
                        print(f"   ⚠️ Failed to retry creative batch after rate limit")
                        continue
                else:
                    print(f"   ⚠️ Error fetching creative batch: {e}")
                    continue
            except Exception as e:
                print(f"   ⚠️ Unexpected error fetching creative batch: {e}")
                continue

        # ---------------------------------------------------------
        # STEP 4: Merge Everything
        # Combine Insights + Creative ID + Creative Details
        # ---------------------------------------------------------
        print("🔗 Step 4: Merging data...")
        final_performance = []
        final_creatives = list(creatives_map.values())

        for row in insights_data:
            ad_id = row.get('ad_id')
            if not ad_id:
                continue
                
            # Find the creative used by this ad
            c_id = ad_id_to_creative_id.get(ad_id)
            
            if c_id:
                # Parse actions and action_values
                actions = row.get('actions', [])
                action_values = row.get('action_values', [])
                
                # Extract common action types
                conversions = 0
                purchase_value = 0.0
                
                if actions:
                    for action in actions:
                        if isinstance(action, dict):
                            action_type = action.get('action_type', '')
                            if action_type in ['purchase', 'complete_registration', 'lead']:
                                conversions += int(action.get('value', 0))
                
                if action_values:
                    for action_value in action_values:
                        if isinstance(action_value, dict):
                            action_type = action_value.get('action_type', '')
                            if action_type == 'purchase':
                                purchase_value += float(action_value.get('value', 0))
                
                # Helper function to safely extract numeric values (handles lists from Facebook API)
                def safe_int(value, default=0):
                    if value is None:
                        return default
                    if isinstance(value, list):
                        # If it's a list, sum the values (Facebook sometimes returns actions as lists)
                        return sum(int(item.get('value', 0)) if isinstance(item, dict) else int(item) if isinstance(item, (int, str)) else 0 for item in value)
                    try:
                        return int(value) if value else default
                    except (ValueError, TypeError):
                        return default
                
                def safe_float(value, default=0.0):
                    if value is None:
                        return default
                    if isinstance(value, list):
                        return sum(float(item.get('value', 0)) if isinstance(item, dict) else float(item) if isinstance(item, (int, str, float)) else 0 for item in value)
                    try:
                        return float(value) if value else default
                    except (ValueError, TypeError):
                        return default
                
                # Extract outbound_clicks (may be a list of action objects)
                outbound_clicks_val = row.get('outbound_clicks', 0)
                if isinstance(outbound_clicks_val, list):
                    # Sum all outbound click values
                    outbound_clicks = sum(int(item.get('value', 0)) if isinstance(item, dict) else int(item) if isinstance(item, (int, str)) else 0 for item in outbound_clicks_val)
                else:
                    outbound_clicks = safe_int(outbound_clicks_val, 0)
                
                # Add the creative_id and ad-level fields to the performance row
                performance_row = {
                    'creative_id': c_id,
                    'ad_id': row.get('ad_id', ''),
                    'ad_name': row.get('ad_name', ''),
                    'adset_id': row.get('adset_id', ''),
                    'adset_name': row.get('adset_name', ''),
                    'campaign_id': row.get('campaign_id', ''),
                    'campaign_name': row.get('campaign_name', ''),
                    'date': row.get('date_start', ''),
                    'spend': safe_float(row.get('spend', 0), 0),
                    'impressions': safe_int(row.get('impressions', 0), 0),
                    'clicks': safe_int(row.get('clicks', 0), 0),
                    'outbound_clicks': outbound_clicks,
                    'conversions': conversions,
                    'purchase_value': purchase_value
                }
                final_performance.append(performance_row)

        print(f"✅ Sync Complete: {len(final_creatives)} Creatives, {len(final_performance)} Daily Rows.")
        
        return {
            'creatives': final_creatives,
            'performance': final_performance
        }

    except FacebookRequestError as e:
        error_code = e.api_error_code() if hasattr(e, 'api_error_code') else None
        error_msg = str(e)
        print(f"❌ Facebook API Error: {error_msg}")
        print(f"Error Code: {error_code}")
        raise
    except Exception as e:
        print(f"❌ Error in Meta Fetcher: {str(e)}")
        import traceback
        traceback.print_exc()
        # Raise it so the caller knows it failed
        raise

