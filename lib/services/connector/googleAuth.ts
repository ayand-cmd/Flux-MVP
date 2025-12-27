import { google } from 'googleapis';

// 1. Initialize the official Google Auth Client
// This object knows your credentials and where to redirect users.
export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 2. The Function to Generate the Login URL
export function getGoogleLoginUrl() {
  // Define exactly what permissions we are asking for
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email', // Get user's email address
    'https://www.googleapis.com/auth/spreadsheets', // Read/Write Sheets
    'https://www.googleapis.com/auth/drive.file',   // Create/Edit specific files
  ];

  // Generate the URL
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // CRITICAL: This gives us the "Refresh Token" for background updates
    prompt: 'consent',      // Forces the consent screen (useful during dev to ensure we get the token)
    scope: scopes,
  });
}