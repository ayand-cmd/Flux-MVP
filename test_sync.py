"""
Test script for meta_sync_service.py

Loads credentials from .env and tests the sync_meta_creative_data function.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env.local (or .env)
load_dotenv('.env.local')
load_dotenv('.env')  # Fallback to .env

# Add lib/services/sync to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib', 'services', 'sync'))

from meta_sync_service import sync_meta_creative_data


def main():
    # Load credentials from environment
    access_token = os.getenv('META_ACCESS_TOKEN')
    ad_account_id = os.getenv('AD_ACCOUNT_ID')
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    # Prefer service role key, fall back to anon key
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    # Validate required environment variables
    missing_vars = []
    if not access_token:
        missing_vars.append('META_ACCESS_TOKEN')
    if not ad_account_id:
        missing_vars.append('AD_ACCOUNT_ID')
    if not supabase_url:
        missing_vars.append('NEXT_PUBLIC_SUPABASE_URL')
    if not supabase_key:
        missing_vars.append('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if missing_vars:
        print("❌ ERROR: Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nPlease add these to your .env.local or .env file.")
        sys.exit(1)
    
    print("=" * 60)
    print("🧪 Testing Meta Creative Sync Service")
    print("=" * 60)
    print(f"📊 Ad Account: {ad_account_id}")
    print(f"🔑 Access Token: {access_token[:20]}...")
    print(f"🗄️  Supabase URL: {supabase_url}")
    key_type = "Service Role" if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else "Anon"
    print(f"🔐 Supabase Key: {key_type} ({supabase_key[:20]}...)")
    print(f"👤 User ID: 1 (test)")
    print()
    
    try:
        # Call the sync function
        result = sync_meta_creative_data(
            user_id=7,
            ad_account_id=ad_account_id,
            access_token=access_token,
            date_preset='last_3d'
        )
        
        print()
        print("=" * 60)
        print("✅ SUCCESS: Sync completed!")
        print("=" * 60)
        print()
        print(f"📋 Result Summary: {result}")
        print()
        print("=" * 60)
        print("✅ Test completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ ERROR: Test failed")
        print("=" * 60)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print()
        print("Full traceback:")
        print("-" * 60)
        import traceback
        traceback.print_exc()
        print("-" * 60)
        sys.exit(1)


if __name__ == '__main__':
    main()

