const sanitizeUrl = (url?: string, fallback: string = ''): string => {
  if (!url) return fallback;
  // Strip BOM (\uFEFF), zero-width characters, surrounding quotes, and whitespace
  return url.replace(/^[\uFEFF\u200B\u200C\u200D"']+|[\uFEFF\u200B\u200C\u200D"']+$/g, '').trim() || fallback;
};

export const API_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000/api');
export const SOCKET_URL = sanitizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL, 'http://localhost:4000');
export const APP_URL = sanitizeUrl(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000');
export const YOUTUBE_EMBED_URL = 'https://www.youtube.com/embed';
