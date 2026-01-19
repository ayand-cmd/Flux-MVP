"""
Main entry point for Google Cloud Run Python worker.

Provides a Flask HTTP server with a /sync endpoint to trigger
Meta creative data synchronization.
"""

import os
import sys
from flask import Flask, request, jsonify

# Add project root to path for imports
project_root = os.path.abspath(os.path.dirname(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from lib.services.sync.meta_sync_service import sync_meta_creative_data

app = Flask(__name__)


@app.route('/sync', methods=['POST'])
def sync_meta_data():
    """
    POST /sync endpoint
    
    Expected JSON body:
    {
        "user_id": 123,
        "ad_account_id": "act_123456789",
        "access_token": "...",
        "date_preset": "last_3d"  # optional
    }
    
    Returns:
        JSON response with status and message
    """
    try:
        # Parse JSON body
        if not request.is_json:
            return jsonify({
                "status": "error",
                "message": "Request must be JSON"
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['user_id', 'ad_account_id', 'access_token']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({
                "status": "error",
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Extract parameters
        user_id = data['user_id']
        ad_account_id = data['ad_account_id']
        access_token = data['access_token']
        date_preset = data.get('date_preset', 'last_3d')  # Optional, default to last_3d
        
        # Validate user_id is an integer
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "user_id must be an integer"
            }), 400
        
        # Validate ad_account_id format (basic check)
        if not ad_account_id or not isinstance(ad_account_id, str):
            return jsonify({
                "status": "error",
                "message": "ad_account_id must be a non-empty string"
            }), 400
        
        # Validate access_token (basic check)
        if not access_token or not isinstance(access_token, str):
            return jsonify({
                "status": "error",
                "message": "access_token must be a non-empty string"
            }), 400
        
        # Call the sync function
        try:
            result_message = sync_meta_creative_data(
                user_id=user_id,
                ad_account_id=ad_account_id,
                access_token=access_token,
                date_preset=date_preset
            )
            
            return jsonify({
                "status": "success",
                "message": result_message
            }), 200
            
        except Exception as e:
            # Log the error for debugging
            print(f"❌ Sync error: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            
            return jsonify({
                "status": "error",
                "message": f"Sync failed: {str(e)}"
            }), 500
    
    except Exception as e:
        # Catch any unexpected errors
        print(f"❌ Unexpected error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "status": "error",
            "message": f"Internal server error: {str(e)}"
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Cloud Run"""
    return jsonify({
        "status": "healthy",
        "service": "meta-sync-worker"
    }), 200


@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        "service": "Meta Creative Sync Worker",
        "endpoints": {
            "POST /sync": "Trigger Meta creative data sync",
            "GET /health": "Health check endpoint"
        }
    }), 200


if __name__ == '__main__':
    # Get port from environment variable (Cloud Run requirement)
    port = int(os.environ.get('PORT', 8080))
    
    # Run Flask app
    # Set host to 0.0.0.0 to listen on all interfaces (required for Cloud Run)
    app.run(host='0.0.0.0', port=port, debug=False)

