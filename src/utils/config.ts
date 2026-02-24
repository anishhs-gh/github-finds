import Conf from "conf";
import type { AppConfig } from "../types/index.js";

const store = new Conf<AppConfig>({
  projectName: "github-finder",
  schema: {
    token: { type: "string" },
  },
});

export function getToken(): string | undefined {
  return store.get("token");
}

export function setToken(token: string): void {
  store.set("token", token);
}

export function clearToken(): void {
  store.delete("token");
}

export function getConfigPath(): string {
  return store.path;
}
