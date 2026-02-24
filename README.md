# ghf

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A comprehensive GitHub CLI built with TypeScript and the GitHub REST API. Browse profiles, repositories, pull requests, issues, gists, organizations, GitHub Actions, and much more — all from your terminal.

---

## Features

See [FEATURES.md](./FEATURES.md) for the complete feature list and what is/isn't implementable via the GitHub REST API.

**Command groups:**
- `auth` — Login, logout, status
- `user` — Profiles, followers, following, stars, gists, SSH keys, notifications
- `repo` — List, view, create, delete, fork, star/unstar, watch, branches, contributors, languages, releases, tags, topics, README, commits, clone URLs, collaborators, webhooks
- `pr` — List, view, create, merge, close, reopen, review, add comment, list files/reviews/comments/commits
- `issue` — List, view, create, close, reopen, comment, labels, milestones
- `gist` — List, view, create, star, fork, delete
- `org` — View, repos, members, teams, events
- `search` — Users, repos, code, issues, commits, topics
- `actions` — Workflows, runs, jobs, rerun, cancel, secrets, variables, trigger, logs
- `keys` — SSH keys, GPG keys, emails

---

## Installation

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
# Clone or download the repo
cd ghf

# Install dependencies
npm install

# Build
npm run build

# Link globally (makes `ghf` available everywhere)
npm link
```

Now you can run `ghf` from anywhere.

---

## Authentication

Most read operations work without authentication. For private repos, creating PRs/issues/gists, starring, forking, and Actions management you need a token.

### Create a Personal Access Token (PAT)

1. Go to **https://github.com/settings/tokens**
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` — private repos, PRs, issues
   - `read:user` — full profile info
   - `user:follow` — follow/unfollow
   - `gist` — gist management
   - `read:org` — org membership
   - `workflow` — GitHub Actions
   - `admin:public_key` — SSH keys
   - `admin:gpg_key` — GPG keys
   - `delete_repo` — delete repos (optional)

### Login

```bash
ghf auth login
# Paste your token at the prompt

# Or pass it directly:
ghf auth login --token ghp_xxxxxxxxxxxx
```

### Check status

```bash
ghf auth status
```

### Logout

```bash
ghf auth logout
```

---

## Usage

### Help

```bash
ghf --help
ghf <command> --help
ghf <command> <subcommand> --help
```

---

### User Commands

```bash
# View any user's public profile
ghf user view torvalds

# View your own profile (requires auth)
ghf user me

# List followers/following
ghf user followers torvalds --limit 20
ghf user following torvalds

# List user's organizations
ghf user orgs google

# List user's public gists
ghf user gists defunkt

# List starred repos
ghf user stars torvalds

# Follow / unfollow (requires auth)
ghf user follow torvalds
ghf user unfollow torvalds

# List public SSH keys
ghf user keys torvalds

# Your notifications (requires auth)
ghf user notifications
ghf user notifications --all
```

---

### Repository Commands

```bash
# List public repos for a user
ghf repo list torvalds
ghf repo list torvalds --sort stars --limit 10

# Paginate — jump to a specific page or page interactively
ghf repo list torvalds --page 2
ghf repo list torvalds --all-pages    # prompts "Load next page?" after each page

# List your repos including private (requires auth)
ghf repo list --type all

# View repo details
ghf repo view torvalds/linux
ghf repo view microsoft/vscode

# Create a repo (requires auth)
ghf repo create
ghf repo create --name my-project --description "My project" --private

# Delete a repo (requires auth + delete_repo scope)
ghf repo delete owner/repo

# Fork a repo (requires auth)
ghf repo fork torvalds/linux
ghf repo fork torvalds/linux --org my-org

# Star / unstar (requires auth)
ghf repo star microsoft/vscode
ghf repo unstar microsoft/vscode

# Watch / unwatch (requires auth)
ghf repo watch microsoft/vscode
ghf repo unwatch microsoft/vscode

# Branches
ghf repo branches torvalds/linux

# Contributors
ghf repo contributors microsoft/vscode --limit 10

# Language breakdown
ghf repo languages torvalds/linux

# Releases
ghf repo releases microsoft/vscode

# Tags
ghf repo tags torvalds/linux --limit 10

# Topics
ghf repo topics microsoft/vscode

# View README
ghf repo readme torvalds/linux

# List commits
ghf repo commits microsoft/vscode --branch main --limit 10
ghf repo commits microsoft/vscode --author bpasero

# View a single commit
ghf repo commit microsoft/vscode abc1234567

# List forks
ghf repo forks torvalds/linux --limit 10

# Get clone URLs
ghf repo clone-url torvalds/linux

# List collaborators (requires push access)
ghf repo collaborators owner/repo

# List webhooks (requires admin access)
ghf repo webhooks owner/repo
```

---

### Pull Request Commands

```bash
# List PRs
ghf pr list microsoft/vscode
ghf pr list microsoft/vscode --state closed --limit 10 --page 2
ghf pr list microsoft/vscode --all-pages

# View a PR
ghf pr view microsoft/vscode 12345

# Create a PR (requires auth)
ghf pr create owner/repo
ghf pr create owner/repo --title "Fix bug" --head my-feature --base main

# Merge a PR (requires auth + write access)
ghf pr merge owner/repo 42
ghf pr merge owner/repo 42 --method squash

# Close / reopen a PR
ghf pr close owner/repo 42
ghf pr reopen owner/repo 42

# Submit a review (requires auth)
ghf pr review owner/repo 42 --event APPROVE
ghf pr review owner/repo 42 --event REQUEST_CHANGES

# List reviews
ghf pr reviews owner/repo 42

# Add a comment (requires auth)
ghf pr comment owner/repo 42 --body "Looks good!"

# List comments
ghf pr comments owner/repo 42

# List changed files
ghf pr files owner/repo 42

# List commits in a PR
ghf pr commits owner/repo 42
```

---

### Issue Commands

```bash
# List issues
ghf issue list microsoft/vscode
ghf issue list microsoft/vscode --state closed --label bug
ghf issue list microsoft/vscode --page 2 --all-pages

# View an issue
ghf issue view microsoft/vscode 1234

# Create an issue (requires auth)
ghf issue create owner/repo
ghf issue create owner/repo --title "Bug report" --label bug

# Close / reopen
ghf issue close owner/repo 42
ghf issue reopen owner/repo 42

# Add a comment (requires auth)
ghf issue comment owner/repo 42

# List comments
ghf issue comments owner/repo 42

# List available labels
ghf issue labels microsoft/vscode

# List milestones
ghf issue milestones microsoft/vscode
```

---

### Gist Commands

```bash
# List your gists (requires auth)
ghf gist list

# View a gist
ghf gist view <gist_id>

# Create a gist (requires auth)
ghf gist create
ghf gist create --file snippet.py --description "My script" --public

# Star / unstar (requires auth)
ghf gist star <gist_id>
ghf gist unstar <gist_id>

# Fork a gist (requires auth)
ghf gist fork <gist_id>

# List forks
ghf gist forks <gist_id>

# Delete a gist (requires auth)
ghf gist delete <gist_id>
```

---

### Organization Commands

```bash
# View org details
ghf org view google
ghf org view microsoft

# List org repos
ghf org repos google --sort stars --limit 20

# List public members
ghf org members google --limit 20

# List your org memberships (requires auth)
ghf org list

# List teams (requires org membership + auth)
ghf org teams google

# Recent public events
ghf org events google
```

---

### Search Commands

```bash
# Search users
ghf search users "linus torvalds"
ghf search users "john --limit 5"

# Search repos
ghf search repos "machine learning"
ghf search repos "react" --language javascript --sort stars
ghf search repos "kubernetes" --stars ">1000" --all-pages

# Search code
ghf search code "useState" --repo facebook/react
ghf search code "console.log" --language javascript

# Search issues
ghf search issues "memory leak" --repo torvalds/linux
ghf search issues "login bug" --type pr --state open

# Search commits
ghf search commits "fix typo" --repo microsoft/vscode

# Search topics
ghf search topics "machine-learning"
```

---

### GitHub Actions Commands

```bash
# List workflows
ghf actions workflows microsoft/vscode

# List workflow runs
ghf actions runs microsoft/vscode
ghf actions runs microsoft/vscode --branch main --status failure

# View a run
ghf actions run microsoft/vscode 12345678

# List jobs in a run
ghf actions jobs microsoft/vscode 12345678

# Re-run (requires auth + write access)
ghf actions rerun owner/repo 12345678
ghf actions rerun owner/repo 12345678 --failed-only

# Cancel a run (requires auth + write access)
ghf actions cancel owner/repo 12345678

# List secrets (names only, requires admin access)
ghf actions secrets owner/repo

# List variables (requires write access)
ghf actions variables owner/repo

# Trigger workflow dispatch (requires auth + write access)
ghf actions trigger owner/repo my-workflow.yml --branch main

# Get log download URL (requires auth)
ghf actions logs owner/repo 12345678
```

---

### Keys Commands

```bash
# List your SSH keys (requires auth + admin:public_key scope)
ghf keys ssh

# List your GPG keys (requires auth + admin:gpg_key scope)
ghf keys gpg

# List your emails (requires auth)
ghf keys emails
```

---

### Shell Completion

```bash
# Bash — add to ~/.bashrc or ~/.bash_profile
eval "$(ghf completion bash)"

# Zsh — add to ~/.zshrc
eval "$(ghf completion zsh)"

# Fish — save to completions directory
ghf completion fish > ~/.config/fish/completions/ghf.fish

# Print the script without evaluating (e.g. to inspect or pipe)
ghf completion bash
ghf completion zsh --instructions   # show install instructions instead
```

---

## Development

```bash
# Run in dev mode (no build needed)
npm run dev -- user view torvalds
npm run dev -- search repos "react"

# Type check
npm run typecheck

# Run tests
npm test
npm run test:watch      # re-runs on file changes
npm run test:coverage   # generates coverage/

# Build
npm run build

# Run built version
ghf user view torvalds
```

---

## Configuration

Token is stored securely using the [conf](https://github.com/sindresorhus/conf) library.

- **macOS**: `~/Library/Preferences/ghf-nodejs/config.json`
- **Linux**: `~/.config/ghf-nodejs/config.json`
- **Windows**: `%APPDATA%\ghf-nodejs\Config\config.json`

Check the config path with `ghf auth status`.
