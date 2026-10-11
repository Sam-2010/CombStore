/**
 * Direct Client-Side OAuth 2.0 PKCE (Proof Key for Code Exchange) Flow Logic
 */

export interface OAuthPKCEConfig {
  clientId: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scopes: string[];
}

export function generateCodeVerifier(length = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  let verifier = '';
  for (let i = 0; i < length; i++) {
    verifier += charset[randomValues[i] % charset.length];
  }
  return verifier;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);

  // Base64URL encode without padding
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64;
}

export const PROVIDER_OAUTH_CONFIGS: Record<'google-drive' | 'onedrive', OAuthPKCEConfig> = {
  'google-drive': {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    redirectUri: window.location.origin + '/oauth/callback.html',
    scopes: [
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  },
  onedrive: {
    clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    redirectUri: window.location.origin + '/oauth/callback.html',
    scopes: ['Files.ReadWrite.All', 'User.Read', 'offline_access'],
  },
};

/**
 * Initiates an OAuth PKCE popup authorization flow
 */
export async function startOAuthPKCEFlow(
  provider: 'google-drive' | 'onedrive',
  customClientId?: string
): Promise<{ code: string; codeVerifier: string; redirectUri: string }> {
  const config = PROVIDER_OAUTH_CONFIGS[provider];
  const clientId = customClientId || config.clientId;

  if (!clientId) {
    throw new Error(`No OAuth Client ID configured for ${provider}. Use Mock Cloud Mode or provide a Client ID.`);
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = Math.random().toString(36).substring(2, 15);

  sessionStorage.setItem(`pkce_verifier_${state}`, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${config.authorizationEndpoint}?${params.toString()}`;
  const width = 540;
  const height = 660;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    authUrl,
    `oauth_${provider}`,
    `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0`
  );

  if (!popup) {
    throw new Error('Popup blocked by browser. Please allow popups for CloudMesh.');
  }

  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel('cloudmesh_oauth_channel');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('OAuth sign-in timed out.'));
    }, 120000);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_RESPONSE' && event.data.state === state) {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error_description || event.data.error));
        } else {
          resolve({
            code: event.data.code,
            codeVerifier: verifier,
            redirectUri: config.redirectUri,
          });
        }
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      channel.removeEventListener('message', onMessage);
      channel.close();
      if (!popup.closed) popup.close();
    };

    channel.addEventListener('message', onMessage);
  });
}
