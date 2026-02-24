import { Command } from "commander";
import { printSuccess, printInfo, c } from "../utils/display.js";

// ─── Completion scripts ────────────────────────────────────────────────────────

const BASH_COMPLETION = `
# ghf bash completion
# Add this to your ~/.bashrc or ~/.bash_profile:
#   eval "$(ghf completion bash)"

_ghf_completion() {
  local cur prev words cword
  _init_completion || return

  local commands="auth user repo pr issue gist org search actions keys help"
  local auth_cmds="login logout status"
  local user_cmds="view me followers following orgs gists stars follow unfollow keys notifications"
  local repo_cmds="list view create delete fork star unstar watch unwatch branches contributors languages releases tags topics readme commits commit forks clone-url collaborators webhooks"
  local pr_cmds="list view create merge close reopen review reviews comment files comments commits"
  local issue_cmds="list view create close reopen comment comments labels milestones"
  local gist_cmds="list view create star unstar fork forks delete"
  local org_cmds="view repos members list teams events"
  local search_cmds="users repos code issues commits topics"
  local actions_cmds="workflows runs run jobs rerun cancel secrets variables trigger logs"
  local keys_cmds="ssh gpg emails"

  case "\${words[1]}" in
    auth)    COMPREPLY=($(compgen -W "\$auth_cmds" -- "\$cur")) ;;
    user)    COMPREPLY=($(compgen -W "\$user_cmds" -- "\$cur")) ;;
    repo)    COMPREPLY=($(compgen -W "\$repo_cmds" -- "\$cur")) ;;
    pr)      COMPREPLY=($(compgen -W "\$pr_cmds" -- "\$cur")) ;;
    issue)   COMPREPLY=($(compgen -W "\$issue_cmds" -- "\$cur")) ;;
    gist)    COMPREPLY=($(compgen -W "\$gist_cmds" -- "\$cur")) ;;
    org)     COMPREPLY=($(compgen -W "\$org_cmds" -- "\$cur")) ;;
    search)  COMPREPLY=($(compgen -W "\$search_cmds" -- "\$cur")) ;;
    actions) COMPREPLY=($(compgen -W "\$actions_cmds" -- "\$cur")) ;;
    keys)    COMPREPLY=($(compgen -W "\$keys_cmds" -- "\$cur")) ;;
    *)       COMPREPLY=($(compgen -W "\$commands" -- "\$cur")) ;;
  esac
}

complete -F _ghf_completion ghf
`.trim();

const ZSH_COMPLETION = `
# ghf zsh completion
# Add this to your ~/.zshrc:
#   eval "$(ghf completion zsh)"

_ghf() {
  local state

  _arguments \\
    '1: :->command' \\
    '2: :->subcommand' \\
    '*: :->args'

  case \$state in
    command)
      local commands=(
        'auth:Manage GitHub authentication'
        'user:User profile commands'
        'repo:Repository commands'
        'pr:Pull request commands'
        'issue:Issue commands'
        'gist:Gist commands'
        'org:Organization commands'
        'search:Search GitHub'
        'actions:GitHub Actions commands'
        'keys:SSH and GPG key commands'
        'help:Display help'
      )
      _describe 'command' commands ;;
    subcommand)
      case \$words[2] in
        auth)    local subs=(login logout status) && _describe 'auth subcommand' subs ;;
        user)    local subs=(view me followers following orgs gists stars follow unfollow keys notifications) && _describe 'user subcommand' subs ;;
        repo)    local subs=(list view create delete fork star unstar watch unwatch branches contributors languages releases tags topics readme commits commit forks clone-url collaborators webhooks) && _describe 'repo subcommand' subs ;;
        pr)      local subs=(list view create merge close reopen review reviews comment files comments commits) && _describe 'pr subcommand' subs ;;
        issue)   local subs=(list view create close reopen comment comments labels milestones) && _describe 'issue subcommand' subs ;;
        gist)    local subs=(list view create star unstar fork forks delete) && _describe 'gist subcommand' subs ;;
        org)     local subs=(view repos members list teams events) && _describe 'org subcommand' subs ;;
        search)  local subs=(users repos code issues commits topics) && _describe 'search subcommand' subs ;;
        actions) local subs=(workflows runs run jobs rerun cancel secrets variables trigger logs) && _describe 'actions subcommand' subs ;;
        keys)    local subs=(ssh gpg emails) && _describe 'keys subcommand' subs ;;
      esac ;;
  esac
}

compdef _ghf ghf
`.trim();

const FISH_COMPLETION = `
# ghf fish completion
# Save this to ~/.config/fish/completions/ghf.fish
# Or run: ghf completion fish > ~/.config/fish/completions/ghf.fish

set -l commands auth user repo pr issue gist org search actions keys

complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a auth    -d "Manage GitHub authentication"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a user    -d "User profile commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a repo    -d "Repository commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a pr      -d "Pull request commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a issue   -d "Issue commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a gist    -d "Gist commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a org     -d "Organization commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a search  -d "Search GitHub"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a actions -d "GitHub Actions commands"
complete -c ghf -f -n "not __fish_seen_subcommand_from \$commands" -a keys    -d "SSH and GPG key commands"

# auth
complete -c ghf -f -n "__fish_seen_subcommand_from auth" -a "login logout status"

# user
complete -c ghf -f -n "__fish_seen_subcommand_from user" -a "view me followers following orgs gists stars follow unfollow keys notifications"

# repo
complete -c ghf -f -n "__fish_seen_subcommand_from repo" -a "list view create delete fork star unstar watch unwatch branches contributors languages releases tags topics readme commits commit forks clone-url collaborators webhooks"

# pr
complete -c ghf -f -n "__fish_seen_subcommand_from pr" -a "list view create merge close reopen review reviews comment files comments commits"

# issue
complete -c ghf -f -n "__fish_seen_subcommand_from issue" -a "list view create close reopen comment comments labels milestones"

# gist
complete -c ghf -f -n "__fish_seen_subcommand_from gist" -a "list view create star unstar fork forks delete"

# org
complete -c ghf -f -n "__fish_seen_subcommand_from org" -a "view repos members list teams events"

# search
complete -c ghf -f -n "__fish_seen_subcommand_from search" -a "users repos code issues commits topics"

# actions
complete -c ghf -f -n "__fish_seen_subcommand_from actions" -a "workflows runs run jobs rerun cancel secrets variables trigger logs"

# keys
complete -c ghf -f -n "__fish_seen_subcommand_from keys" -a "ssh gpg emails"
`.trim();

const INSTALL_INSTRUCTIONS: Record<string, string> = {
  bash: `# Add to ~/.bashrc or ~/.bash_profile:\neval "$(ghf completion bash)"`,
  zsh: `# Add to ~/.zshrc:\neval "$(ghf completion zsh)"`,
  fish: `# Save to fish completions:\nghf completion fish > ~/.config/fish/completions/ghf.fish`,
};

export function registerCompletion(program: Command) {
  program
    .command("completion [shell]")
    .description("Output shell completion script (bash|zsh|fish)")
    .option("--instructions", "Show installation instructions instead of the script", false)
    .action((shell: string | undefined, opts) => {
      const detected = process.env.SHELL?.split("/").pop() ?? "bash";
      const target = (shell ?? detected).toLowerCase();

      const scripts: Record<string, string> = { bash: BASH_COMPLETION, zsh: ZSH_COMPLETION, fish: FISH_COMPLETION };
      const script = scripts[target];

      if (!script) {
        console.error(c.err(`✖  Unknown shell "${target}". Supported: bash, zsh, fish`));
        process.exit(1);
      }

      if (opts.instructions) {
        console.log(c.muted(INSTALL_INSTRUCTIONS[target] ?? ""));
        return;
      }

      // Print raw script — caller pipes it through eval or redirects to file
      process.stdout.write(script + "\n");
    });
}
