"""
Test script for meta_creative_fetcher.py

Loads credentials from .env and tests the fetch_creative_performance function.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env.local (or .env)
load_dotenv('.env.local')
load_dotenv('.env')  # Fallback to .env

# Add lib/services/connector to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib', 'services', 'connector'))

from meta_creative_fetcher import fetch_creative_performance


def main():
    # Load credentials from environment
    access_token = os.getenv('META_ACCESS_TOKEN')
    ad_account_id = os.getenv('AD_ACCOUNT_ID')
    
    if not access_token:
        print("❌ ERROR: META_ACCESS_TOKEN not found in .env or .env.local")
        print("   Please add: META_ACCESS_TOKEN=your_token_here")
        sys.exit(1)
    
    if not ad_account_id:
        print("❌ ERROR: AD_ACCOUNT_ID not found in .env or .env.local")
        print("   Please add: AD_ACCOUNT_ID=act_123456789 (or just 123456789)")
        sys.exit(1)
    
    print("=" * 60)
    print("🧪 Testing Meta Creative Fetcher")
    print("=" * 60)
    print(f"📊 Ad Account: {ad_account_id}")
    print(f"🔑 Access Token: {access_token[:20]}...")
    print()
    
    try:
        # Call the function
        result = fetch_creative_performance(
            ad_account_id=ad_account_id,
            access_token=access_token,
            date_preset='last_3d'
        )
        
        print()
        print("=" * 60)
        print("✅ SUCCESS: Data fetched successfully!")
        print("=" * 60)
        print()
        
        # Display summary
        print(f"📈 Summary:")
        print(f"   - Total Creatives: {len(result['creatives'])}")
        print(f"   - Total Performance Records: {len(result['performance'])}")
        print()
        
        # Show first 3 creatives with thumbnails
        print("🎨 First 3 Creatives (with thumbnails):")
        print("-" * 60)
        
        for i, creative in enumerate(result['creatives'][:3], 1):
            print(f"\n{i}. Creative ID: {creative['id']}")
            print(f"   Name: {creative['name']}")
            print(f"   Thumbnail URL: {creative['thumbnail_url'] or '(no thumbnail)'}")
            print(f"   Title: {creative['title'] or '(no title)'}")
            print(f"   Body: {creative['body'][:50] + '...' if len(creative.get('body', '')) > 50 else creative.get('body', '(no body)')}")
            print(f"   CTA Type: {creative['call_to_action_type'] or '(no CTA)'}")
        
        if len(result['creatives']) > 3:
            print(f"\n   ... and {len(result['creatives']) - 3} more creatives")
        
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
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

