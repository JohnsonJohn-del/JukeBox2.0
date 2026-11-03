import { API_URL, getApiUrl } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success?: boolean;
}

interface ApiError {
  message?: string;
  statusCode?: number;
  error?: {
    message?: string;
    code?: string;
  };
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys<T>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map(transformKeys) as T;
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[snakeToCamel(key)] = transformKeys(value);
    }
    return result as T;
  }
  return obj as T;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getEffectiveBaseUrl(): string {
    return getApiUrl() || this.baseUrl;
  }

  private getToken(): string | null {
    return useAuthStore.getState().token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const activeBase = this.getEffectiveBaseUrl();
      const response = await fetch(`${activeBase}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get('content-type') || '';
      let json: (ApiResponse<T> & ApiError) | null = null;

      if (contentType.includes('application/json')) {
        try {
          json = await response.json();
        } catch {
          json = null;
        }
      }

      if (!response.ok) {
        let errorMessage = json?.message || json?.error?.message;
        if (!errorMessage) {
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            errorMessage = 'Backend server is unreachable via tunnel. Please ensure your local server and Cloudflare tunnel are active.';
          } else {
            const rawText = !json ? await response.text().catch(() => '') : '';
            errorMessage = `Request failed (${response.status}): ${rawText.slice(0, 100) || response.statusText || 'Unknown error'}`;
          }
        }
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      if (!json) {
        const rawText = await response.text().catch(() => '');
        throw new Error(`Invalid response format from server (${contentType || 'non-JSON'}): ${rawText.slice(0, 100)}`);
      }

      if ((json as any).success === false && json.error?.message) {
        toast.error(json.error.message);
        throw new Error(json.error.message);
      }

      const payload = json.data !== undefined ? json.data : json;
      return transformKeys<T>(payload as T);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const networkMsg = 'Network error. Could not connect to backend server.';
        toast.error(networkMsg);
        throw new Error(networkMsg);
      }
      throw error;
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export const api = new ApiClient(API_URL);
