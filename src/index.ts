#!/usr/bin/env node

import { Command } from "commander";
import { registerAuth } from "./commands/auth.js";
import { registerUser } from "./commands/user.js";
import { registerRepo } from "./commands/repo.js";
import { registerPR } from "./commands/pr.js";
import { registerIssue } from "./commands/issue.js";
import { registerGist } from "./commands/gist.js";
import { registerOrg } from "./commands/org.js";
import { registerSearch } from "./commands/search.js";
import { registerActions } from "./commands/actions.js";
import { registerKeys } from "./commands/keys.js";
import { registerCompletion } from "./commands/completion.js";

const program = new Command();

program
  .name("ghf")
  .description(
    "A comprehensive GitHub CLI — browse profiles, repos, PRs, issues, Actions, and more.\n\n" +
    "  Run any command with --help to see available options.\n" +
    "  Get started: ghf auth login"
  )
  .version("1.0.0", "-v, --version", "Show version")
  .addHelpText(
    "after",
    `
Examples:
  ghf auth login                        # Authenticate
  ghf user view torvalds               # View a profile
  ghf repo list torvalds               # List public repos
  ghf repo view torvalds/linux         # View repo details
  ghf repo fork torvalds/linux         # Fork a repo
  ghf pr list microsoft/vscode         # List PRs
  ghf pr view microsoft/vscode 12345   # View a PR
  ghf pr create owner/repo             # Create a PR
  ghf issue list microsoft/vscode      # List issues
  ghf issue create owner/repo          # Create an issue
  ghf search repos "machine learning"  # Search repos
  ghf search code "useState" --repo facebook/react
  ghf gist list                        # Your gists
  ghf org view microsoft               # View org
  ghf actions runs microsoft/vscode    # Actions runs
  ghf keys ssh                         # Your SSH keys
`
  );

// Register all command groups
registerAuth(program);
registerUser(program);
registerRepo(program);
registerPR(program);
registerIssue(program);
registerGist(program);
registerOrg(program);
registerSearch(program);
registerActions(program);
registerKeys(program);
registerCompletion(program);

// Global error handler — surface any unhandled rejections
process.on("unhandledRejection", (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[31m✖  Unexpected error:\x1b[0m ${msg}`);
  process.exit(1);
});

program.parseAsync(process.argv).catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[31m✖  ${msg}\x1b[0m`);
  process.exit(1);
});
