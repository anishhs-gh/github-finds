export interface AppConfig {
  token?: string;
}

export interface DisplayOptions {
  json?: boolean;
  wide?: boolean;
  limit?: number;
  page?: number;
}

export type MergeMethod = "merge" | "squash" | "rebase";
export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
export type IssueState = "open" | "closed" | "all";
export type PRState = "open" | "closed" | "all";
export type RepoSort = "created" | "updated" | "pushed" | "full_name";
export type RepoType = "all" | "public" | "private" | "forks" | "sources" | "member";
