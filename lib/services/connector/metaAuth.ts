import axios from 'axios';

// 1. Generate the "Login with Facebook" URL
// UPDATED: Now accepts 'userEmail' as an argument
export function getMetaLoginUrl(userEmail: string) {
  // Ensure we are using the correct API version
  const rootUrl = 'https://www.facebook.com/v21.0/dialog/oauth';
  
  // ENCODE the email so it travels safely as a string
  // This is the "suitcase" we pack the email into
  const state = Buffer.from(userEmail).toString('base64'); 

  const options = {
    client_id: process.env.META_CLIENT_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    state: state, // <--- CRITICAL: Attaching the email here
    scope: 'email,ads_read', 
  };

  const qs = new URLSearchParams(options as any).toString();
  return `${rootUrl}?${qs}`;
}


// 2. The Token Trader (Short -> Long)
export async function exchangeMetaCodeForToken(code: string) {
  // A. Trade the "Code" for a "Short-Lived Token"
  const tokenUrl = 'https://graph.facebook.com/v17.0/oauth/access_token';
  const { data: shortTokenData } = await axios.get(tokenUrl, {
    params: {
      client_id: process.env.META_CLIENT_ID,
      client_secret: process.env.META_CLIENT_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    },
  });

  const shortLivedToken = shortTokenData.access_token;

  // B. Trade the "Short-Lived Token" for a "Long-Lived Token" (60 Days)
  const { data: longTokenData } = await axios.get(tokenUrl, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_CLIENT_ID,
      client_secret: process.env.META_CLIENT_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });

  return longTokenData.access_token; // This is the Golden Key 🔑
}

// 3. Helper to get the user's Facebook Email (to match with Supabase)
export async function getMetaUserDetails(accessToken: string) {
  const { data } = await axios.get('https://graph.facebook.com/me', {
    params: {
      fields: 'id,email,name',
      access_token: accessToken,
    },
  });
  return data;
}