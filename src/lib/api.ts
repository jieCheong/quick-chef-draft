/*
This is place in frontend that knows how to call the backend API, and shapes the data in a way that's easy for the rest of the app to use.
Every page, every hook calls apiFetch() - never raw fetch() directly
*/


const BASE_URL = import.meta.env.VITE_API_BASE_URL;
// VITE_API_URL will be something like 'http://localhost:3000' in development, and the real backend URL in production

export async function apiFetch<T = unknown>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const token = localStorage.getItem('qc_token'); // or get it from a cookie, or however you store it
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'API request failed');
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}
 export const apiGet = <T = unknown>(path: string) => apiFetch<T>(path);
 export const apiPost = <T = unknown>(path: string, body: unknown) =>
    apiFetch<T>(path, {
        method: 'POST',
        body: JSON.stringify(body)
    });
 export const apiPatch = <T = unknown>(path: string, body: unknown) =>
    apiFetch<T>(path, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
 export const apiDelete = <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' });