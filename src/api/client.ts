import { Octokit } from "@octokit/rest";
import { getToken } from "../utils/config.js";
import { c } from "../utils/display.js";

let _client: Octokit | null = null;

export function getClient(): Octokit {
  if (_client) return _client;
  const token = getToken();
  _client = new Octokit({
    auth: token,
    userAgent: "ghf/1.0.0",
    // Octokit's built-in request handling already respects Retry-After headers.
    // We layer on friendly error messages via friendlyError() in each command.
  });
  return _client;
}

/** Invalidate the cached client (called after login / logout) */
export function resetClient() {
  _client = null;
}

/** Returns true if a token is stored */
export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

/** Exits with a friendly error if no token is present */
export function requireAuth() {
  if (!isAuthenticated()) {
    console.error(
      "\x1b[31m✖  Not authenticated.\x1b[0m Run \x1b[36mghf auth login\x1b[0m to add your token."
    );
    process.exit(1);
  }
}

/**
 * Classify an API error and return a human-readable message.
 * All commands should pass their caught errors through here.
 */
export function friendlyError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const e = err as Error & { status?: number; response?: { data?: { message?: string }; headers?: Record<string, string> } };
  const status = e.status;
  const apiMsg = e.response?.data?.message ?? "";
  const retryAfter = e.response?.headers?.["retry-after"];

  if (status === 401) {
    return `Authentication failed — run \`ghf auth login\` to refresh your token.`;
  }
  if (status === 403) {
    if (apiMsg.toLowerCase().includes("rate limit")) {
      const wait = retryAfter ? ` Try again in ${retryAfter}s.` : " Wait a few minutes.";
      return `API rate limit exceeded.${wait} Authenticate with a token for higher limits.`;
    }
    return `Forbidden (403) — your token may be missing required scopes.${apiMsg ? ` GitHub says: ${apiMsg}` : ""}`;
  }
  if (status === 404) {
    return `Not found (404) — check the owner/repo name is correct.`;
  }
  if (status === 422) {
    return `Validation error (422)${apiMsg ? `: ${apiMsg}` : " — check your input."}`;
  }
  if (status === 429) {
    const wait = retryAfter ? ` Retry after ${retryAfter}s.` : "";
    return `Secondary rate limit hit (429).${wait}`;
  }
  if (status === 451) {
    return `Content blocked (451) — this resource is unavailable in your region.`;
  }
  return apiMsg || e.message;
}
