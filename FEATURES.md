# github-finder — Feature Feasibility Document

This document covers every meaningful GitHub REST API capability and whether it can be implemented in a CLI app, with reasons for any limitations.

---

## ✅ IMPLEMENTED FEATURES

### Authentication
| Feature | Command | Notes |
|---------|---------|-------|
| Login with Personal Access Token | `auth login` | Stores token in OS keychain / config file |
| Logout (clear token) | `auth logout` | Removes stored token |
| Show auth status | `auth status` | Shows current user + scopes |

> **Why PAT and not OAuth?** True OAuth requires a browser redirect to github.com and a local callback server. A CLI can do this but it requires registering a GitHub App/OAuth App with client credentials baked in — not appropriate for an open-source tool without a hosted component. PAT (Personal Access Token) is the standard approach for developer CLIs.

---

### User Profile
| Feature | Command | Notes |
|---------|---------|-------|
| View any user's public profile | `user view <username>` | Name, bio, location, followers, public repos, etc. |
| View your own profile | `user me` | Authenticated — shows private info too |
| List followers | `user followers <username>` | Paginated |
| List following | `user following <username>` | Paginated |
| List user's public orgs | `user orgs <username>` | |
| List user's public gists | `user gists <username>` | |
| List user's starred repos | `user stars <username>` | |

---

### Repositories
| Feature | Command | Notes |
|---------|---------|-------|
| List user's public repos | `repo list <username>` | Sort by stars/updated/name |
| List your repos (incl. private) | `repo list --mine` | Requires auth |
| View repo details | `repo view <owner/repo>` | Stars, forks, language, topics, license |
| List repo branches | `repo branches <owner/repo>` | |
| List repo contributors | `repo contributors <owner/repo>` | |
| List repo languages | `repo languages <owner/repo>` | With byte counts |
| List repo releases | `repo releases <owner/repo>` | Tag, date, assets |
| List repo tags | `repo tags <owner/repo>` | |
| List repo topics | `repo topics <owner/repo>` | |
| View repo README | `repo readme <owner/repo>` | Rendered as plain text |
| Get clone URLs | `repo clone-url <owner/repo>` | HTTPS and SSH |
| Fork a repo | `repo fork <owner/repo>` | Requires auth |
| Star / Unstar a repo | `repo star <owner/repo>` / `repo unstar` | Requires auth |
| Watch / Unwatch a repo | `repo watch <owner/repo>` / `repo unwatch` | Requires auth |
| List repo commits | `repo commits <owner/repo>` | Paginated, filterable by branch/author |
| View a single commit | `repo commit <owner/repo> <sha>` | Diff stats, files changed |
| List repo issues (open/closed) | `repo issues <owner/repo>` | See Issues section |
| List repo pull requests | `repo prs <owner/repo>` | See PRs section |
| Delete a repo | `repo delete <owner/repo>` | Requires auth + admin scope |
| Create a repo | `repo create` | Requires auth, interactive prompts |

---

### Pull Requests
| Feature | Command | Notes |
|---------|---------|-------|
| List PRs on a repo | `pr list <owner/repo>` | Filter by state (open/closed/merged) |
| View PR details | `pr view <owner/repo> <number>` | Title, description, status, labels, reviewers |
| Create a PR | `pr create <owner/repo>` | Interactive: title, body, base, head branch |
| Merge a PR | `pr merge <owner/repo> <number>` | Merge strategies: merge/squash/rebase |
| Close a PR | `pr close <owner/repo> <number>` | Requires write access |
| List PR reviews | `pr reviews <owner/repo> <number>` | |
| Add a PR review | `pr review <owner/repo> <number>` | APPROVE / REQUEST_CHANGES / COMMENT |
| Add a comment to a PR | `pr comment <owner/repo> <number>` | |
| List PR files changed | `pr files <owner/repo> <number>` | |
| Check PR mergeable status | `pr view` | Shown in PR details |

---

### Issues
| Feature | Command | Notes |
|---------|---------|-------|
| List issues | `issue list <owner/repo>` | Filter by state/label/assignee |
| View issue details | `issue view <owner/repo> <number>` | Body, comments, labels, assignees |
| Create an issue | `issue create <owner/repo>` | Interactive: title, body, labels, assignees |
| Close an issue | `issue close <owner/repo> <number>` | Requires write access |
| Reopen an issue | `issue reopen <owner/repo> <number>` | Requires write access |
| Add a comment to an issue | `issue comment <owner/repo> <number>` | |
| List issue comments | `issue comments <owner/repo> <number>` | |

---

### Gists
| Feature | Command | Notes |
|---------|---------|-------|
| List your gists | `gist list` | Requires auth |
| View a gist | `gist view <id>` | Shows file contents |
| Create a gist | `gist create` | Interactive: filename, content, public/secret |
| Star a gist | `gist star <id>` | Requires auth |

---

### Organizations
| Feature | Command | Notes |
|---------|---------|-------|
| View org details | `org view <org>` | Public info |
| List org public repos | `org repos <org>` | |
| List org members | `org members <org>` | Public members |
| List your org memberships | `org list` | Requires auth |

---

### Search
| Feature | Command | Notes |
|---------|---------|-------|
| Search users | `search users <query>` | |
| Search repositories | `search repos <query>` | Filter by language, stars, forks |
| Search code | `search code <query>` | Returns file matches |
| Search issues | `search issues <query>` | |
| Search commits | `search commits <query>` | |

---

### GitHub Actions
| Feature | Command | Notes |
|---------|---------|-------|
| List workflows | `actions workflows <owner/repo>` | |
| List workflow runs | `actions runs <owner/repo>` | Filter by status/branch |
| View a workflow run | `actions run <owner/repo> <run_id>` | Status, timing, conclusion |
| List run jobs | `actions jobs <owner/repo> <run_id>` | |
| Re-run a workflow | `actions rerun <owner/repo> <run_id>` | Requires write access |
| Cancel a workflow run | `actions cancel <owner/repo> <run_id>` | Requires write access |
| List repo secrets (names only) | `actions secrets <owner/repo>` | Values are never returned by API |
| Trigger workflow dispatch | `actions trigger <owner/repo> <workflow>` | Requires workflow_dispatch event |

---

### SSH Keys (Authenticated User)
| Feature | Command | Notes |
|---------|---------|-------|
| List your SSH keys | `keys ssh` | |
| List your GPG keys | `keys gpg` | |

---

## ❌ NOT IMPLEMENTED — WITH REASONS

| Feature | Reason |
|---------|--------|
| **OAuth Browser Flow** | Requires hosting a GitHub OAuth App with client_id/secret. Not suitable for an open-source CLI without a server. PAT is the standard alternative. |
| **Git operations (clone, push, pull)** | These are git protocol operations, not GitHub REST API. Use `git` CLI directly. We provide the clone URL. |
| **GitHub Copilot API** | Copilot completions API is not publicly available for third-party integrations. |
| **GitHub Packages (npm/docker registry)** | Would require registry-specific protocols (npm/Docker), not just REST. Out of scope. |
| **GitHub Marketplace** | Browse-only web experience, no useful REST endpoints for CLI use. |
| **GitHub Pages configuration** | Limited API surface, easily done on the web. |
| **Admin API (org billing, audit log)** | Requires GitHub Enterprise + org admin role. Impractical for general use. |
| **GraphQL API** | We use REST exclusively for simplicity. GraphQL would allow combining requests but adds significant complexity. |
| **Webhook management** | Webhooks require a publicly reachable server to receive events — meaningless in a local CLI context. |
| **GitHub Apps management** | Creating/managing GitHub Apps requires web UI registration and involves complex JWT flows. |
| **Repository rulesets/branch protection (write)** | Complex admin feature, read is possible but write requires admin. Low utility in CLI. |
| **Dependabot alerts (write)** | Read-only via API for non-Enterprise accounts. |
| **Code scanning / SARIF upload** | CI/CD tool concern, not a CLI profile viewer. |
| **GitHub Sponsors** | No public write API endpoints. |
| **Notifications (real-time)** | REST API gives a snapshot, not a live stream. Real-time requires SSE/webhooks. |
| **Delete commits / force push** | Not a GitHub REST API operation — this is pure git. |

---

## Authentication Scopes Required

When creating your PAT at https://github.com/settings/tokens, select:

| Scope | Used For |
|-------|----------|
| `repo` | Private repos, PRs, issues, branches |
| `read:user` | Full user profile |
| `user:follow` | Follow/unfollow users |
| `gist` | Create/manage gists |
| `read:org` | Org membership details |
| `workflow` | GitHub Actions read + trigger |
| `admin:public_key` | List SSH keys |
| `admin:gpg_key` | List GPG keys |
| `delete_repo` | Delete repositories |

> For read-only usage, `repo` + `read:user` + `read:org` + `workflow` covers most features.
