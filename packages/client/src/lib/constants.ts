const sanitizeUrl = (url?: string, fallback: string = ''): string => {
  if (!url) return fallback;
  // Strip BOM (\uFEFF), zero-width characters, surrounding quotes, and whitespace
  return url.replace(/^[\uFEFF\u200B\u200C\u200D"']+|[\uFEFF\u200B\u200C\u200D"']+$/g, '').trim() || fallback;
};

export const CLOUDFLARE_TUNNEL_URL = 'https://tales-vpn-stronger-pst.trycloudflare.com';

export const getApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    // When visiting directly through Cloudflare Tunnel, route to same-origin /api
    if (window.location.hostname.includes('trycloudflare.com')) {
      return `${window.location.origin}/api`;
    }
    // When visiting locally on developer machine
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000/api');
    }
    // When visiting through Vercel or other external domain, connect back to Cloudflare Tunnel
    return sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, `${CLOUDFLARE_TUNNEL_URL}/api`);
  }
  return sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, `${CLOUDFLARE_TUNNEL_URL}/api`);
};

export const getSocketUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('trycloudflare.com')) {
      return window.location.origin;
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return sanitizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, 'http://localhost:4000');
    }
    return sanitizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, CLOUDFLARE_TUNNEL_URL);
  }
  return sanitizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, CLOUDFLARE_TUNNEL_URL);
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();
export const APP_URL = sanitizeUrl(process.env.NEXT_PUBLIC_APP_URL, 'https://client-delta-rose-86.vercel.app');
export const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed';
