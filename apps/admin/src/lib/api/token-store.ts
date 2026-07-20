/**
 * The access token lives in memory only — a module-level variable,
 * never `localStorage`/`sessionStorage`, and deliberately not React
 * state either (nothing here should re-render on every token
 * rotation; `apiFetch` just needs to read the latest value at request
 * time). This is the web half of ARCHITECTURE.md §4.3's split: the
 * *refresh* token is the one persisted, as an httpOnly cookie the
 * browser manages on our behalf — this module never sees it. A full
 * page reload wipes this value on purpose, which is why
 * AuthProvider's mount effect always re-derives it via a silent
 * `POST /auth/refresh` before rendering anything protected.
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
