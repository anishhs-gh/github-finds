import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getClient, requireAuth } from "../api/client.js";
import {
  printTitle, printKeyValue, printTable, printError, printSuccess,
  printSection, c, formatDate, truncate, stateBadge,
} from "../utils/display.js";

function splitRepo(ownerRepo: string): { owner: string; repo: string } {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) { printError(`Invalid format. Use owner/repo`); process.exit(1); }
  return { owner, repo };
}

export function registerActions(program: Command) {
  const actions = program.command("actions").description("GitHub Actions commands");

  // ── actions workflows ──────────────────────────────────────────────────────
  actions
    .command("workflows <owner/repo>")
    .description("List workflows in a repository")
    .action(async (ownerRepo: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching workflows…").start();
      try {
        const { data } = await getClient().rest.actions.listRepoWorkflows({ owner, repo, per_page: 100 });
        spinner.stop();
        printTitle(`Workflows — ${ownerRepo}`);
        if (!data.workflows.length) { console.log(c.muted("  No workflows.")); return; }
        printTable(
          ["ID", "Name", "State", "Path"],
          data.workflows.map((w) => [w.id, w.name, stateBadge(w.state), w.path])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch workflows.", err);
      }
    });

  // ── actions runs ───────────────────────────────────────────────────────────
  actions
    .command("runs <owner/repo>")
    .description("List workflow runs in a repository")
    .option("-w, --workflow <id_or_name>", "Filter by workflow ID or filename")
    .option("-b, --branch <branch>", "Filter by branch")
    .option("-s, --status <status>", "queued|in_progress|completed|success|failure|cancelled")
    .option("-l, --limit <n>", "Max results", "15")
    .action(async (ownerRepo: string, opts) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const limit = parseInt(opts.limit, 10);
      const spinner = ora("Fetching workflow runs…").start();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let runs: any[] = [];
        if (opts.workflow) {
          const { data } = await getClient().rest.actions.listWorkflowRuns({
            owner,
            repo,
            workflow_id: isNaN(Number(opts.workflow)) ? opts.workflow : Number(opts.workflow),
            branch: opts.branch,
            status: opts.status,
            per_page: Math.min(limit, 100),
          });
          runs = data.workflow_runs;
        } else {
          const { data } = await getClient().rest.actions.listWorkflowRunsForRepo({
            owner,
            repo,
            branch: opts.branch,
            status: opts.status,
            per_page: Math.min(limit, 100),
          });
          runs = data.workflow_runs;
        }
        spinner.stop();
        printTitle(`Workflow Runs — ${ownerRepo}`);
        if (!runs.length) { console.log(c.muted("  No workflow runs.")); return; }
        printTable(
          ["ID", "Workflow", "Branch", "Event", "Status", "Conclusion", "Started"],
          runs.slice(0, limit).map((r) => [
            r.id,
            truncate(r.name ?? "—", 25),
            r.head_branch ?? "—",
            r.event,
            stateBadge(r.status ?? "—"),
            r.conclusion ? stateBadge(r.conclusion) : c.muted("pending"),
            formatDate(r.created_at),
          ])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch workflow runs.", err);
      }
    });

  // ── actions run ────────────────────────────────────────────────────────────
  actions
    .command("run <owner/repo> <run_id>")
    .description("View details of a workflow run")
    .action(async (ownerRepo: string, runId: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const run_id = parseInt(runId, 10);
      const spinner = ora(`Fetching run ${run_id}…`).start();
      try {
        const [{ data: run }, { data: jobsData }] = await Promise.all([
          getClient().rest.actions.getWorkflowRun({ owner, repo, run_id }),
          getClient().rest.actions.listJobsForWorkflowRun({ owner, repo, run_id, per_page: 50 }),
        ]);
        spinner.stop();
        printTitle(`Run #${run.run_number} — ${run.name ?? "—"}`);
        printKeyValue([
          ["ID", run.id],
          ["Workflow", run.name ?? "—"],
          ["Branch", run.head_branch ?? "—"],
          ["Commit", run.head_sha?.slice(0, 10) ?? "—"],
          ["Event", run.event],
          ["Status", stateBadge(run.status ?? "—")],
          ["Conclusion", run.conclusion ? stateBadge(run.conclusion) : c.muted("pending")],
          ["Attempt", run.run_attempt ?? 1],
          ["Started", formatDate(run.created_at)],
          ["Updated", formatDate(run.updated_at)],
          ["URL", run.html_url],
        ]);
        if (jobsData.jobs.length) {
          printSection("Jobs");
          printTable(
            ["ID", "Name", "Status", "Conclusion", "Started", "Completed"],
            jobsData.jobs.map((j) => [
              j.id,
              truncate(j.name, 30),
              stateBadge(j.status),
              j.conclusion ? stateBadge(j.conclusion) : c.muted("pending"),
              formatDate(j.started_at),
              formatDate(j.completed_at),
            ])
          );
        }
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not fetch run ${runId}.`, err);
      }
    });

  // ── actions jobs ───────────────────────────────────────────────────────────
  actions
    .command("jobs <owner/repo> <run_id>")
    .description("List jobs for a workflow run")
    .action(async (ownerRepo: string, runId: string) => {
      const { owner, repo } = splitRepo(ownerRepo);
      const run_id = parseInt(runId, 10);
      const spinner = ora("Fetching jobs…").start();
      try {
        const { data } = await getClient().rest.actions.listJobsForWorkflowRun({ owner, repo, run_id, per_page: 100 });
        spinner.stop();
        printTitle(`Jobs — Run ${run_id} in ${ownerRepo}`);
        if (!data.jobs.length) { console.log(c.muted("  No jobs.")); return; }
        for (const job of data.jobs) {
          console.log(`\n  ${stateBadge(job.conclusion ?? job.status)} ${c.ok(job.name)}`);
          console.log(`  ${c.muted(`Runner: ${job.runner_name ?? "—"}  Started: ${formatDate(job.started_at)}`)}`);
          if (job.steps?.length) {
            for (const step of job.steps) {
              const icon = step.conclusion === "success" ? c.ok("✔") : step.conclusion === "failure" ? c.err("✖") : c.muted("○");
              console.log(`    ${icon} ${step.name}  ${c.muted(`(${step.number})`)}`);
            }
          }
        }
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch jobs.", err);
      }
    });

  // ── actions rerun ──────────────────────────────────────────────────────────
  actions
    .command("rerun <owner/repo> <run_id>")
    .description("Re-run a workflow run (requires auth + write access)")
    .option("--failed-only", "Re-run only failed jobs", false)
    .action(async (ownerRepo: string, runId: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const run_id = parseInt(runId, 10);
      const spinner = ora(`Re-running run ${run_id}…`).start();
      try {
        if (opts.failedOnly) {
          await getClient().rest.actions.reRunWorkflowFailedJobs({ owner, repo, run_id });
        } else {
          await getClient().rest.actions.reRunWorkflow({ owner, repo, run_id });
        }
        spinner.succeed(`Run ${run_id} re-triggered`);
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not re-run ${runId}.`, err);
      }
    });

  // ── actions cancel ─────────────────────────────────────────────────────────
  actions
    .command("cancel <owner/repo> <run_id>")
    .description("Cancel a workflow run (requires auth + write access)")
    .action(async (ownerRepo: string, runId: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const run_id = parseInt(runId, 10);
      const spinner = ora(`Cancelling run ${run_id}…`).start();
      try {
        await getClient().rest.actions.cancelWorkflowRun({ owner, repo, run_id });
        spinner.succeed(`Run ${run_id} cancelled`);
      } catch (err) {
        spinner.fail("Failed");
        printError(`Could not cancel run ${runId}.`, err);
      }
    });

  // ── actions secrets ────────────────────────────────────────────────────────
  actions
    .command("secrets <owner/repo>")
    .description("List secrets (names only — values are never exposed) (requires auth + admin access)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching secrets…").start();
      try {
        const { data } = await getClient().rest.actions.listRepoSecrets({ owner, repo, per_page: 100 });
        spinner.stop();
        printTitle(`Secrets — ${ownerRepo}`);
        console.log(c.muted("  (Secret values are never exposed by the API)"));
        if (!data.secrets.length) { console.log(c.muted("  No secrets.")); return; }
        printTable(
          ["Name", "Updated"],
          data.secrets.map((s) => [s.name, formatDate(s.updated_at)])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch secrets. Requires admin access.", err);
      }
    });

  // ── actions variables ──────────────────────────────────────────────────────
  actions
    .command("variables <owner/repo>")
    .description("List Actions variables for a repository (requires auth + write access)")
    .action(async (ownerRepo: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const spinner = ora("Fetching variables…").start();
      try {
        const { data } = await getClient().rest.actions.listRepoVariables({ owner, repo, per_page: 100 });
        spinner.stop();
        printTitle(`Variables — ${ownerRepo}`);
        if (!data.variables.length) { console.log(c.muted("  No variables.")); return; }
        printTable(
          ["Name", "Value", "Updated"],
          data.variables.map((v) => [v.name, truncate(v.value, 60), formatDate(v.updated_at)])
        );
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not fetch variables.", err);
      }
    });

  // ── actions trigger ────────────────────────────────────────────────────────
  actions
    .command("trigger <owner/repo> <workflow>")
    .description("Trigger a workflow_dispatch event (requires auth + write access)")
    .option("-b, --branch <branch>", "Branch or tag to run on", "main")
    .action(async (ownerRepo: string, workflow: string, opts) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);

      const { confirm } = await inquirer.prompt([{
        type: "confirm",
        name: "confirm",
        message: `Trigger workflow "${workflow}" on branch "${opts.branch}" in ${ownerRepo}?`,
        default: false,
      }]);
      if (!confirm) { console.log(c.muted("Aborted.")); return; }

      const spinner = ora("Triggering workflow…").start();
      try {
        await getClient().rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: isNaN(Number(workflow)) ? workflow : Number(workflow),
          ref: opts.branch,
        });
        spinner.succeed(`Workflow "${workflow}" triggered on ${opts.branch}`);
      } catch (err) {
        spinner.fail("Failed");
        printError("Could not trigger workflow. Ensure it has a workflow_dispatch trigger.", err);
      }
    });

  // ── actions logs ───────────────────────────────────────────────────────────
  actions
    .command("logs <owner/repo> <run_id>")
    .description("Download URL for workflow run logs (requires auth)")
    .action(async (ownerRepo: string, runId: string) => {
      requireAuth();
      const { owner, repo } = splitRepo(ownerRepo);
      const run_id = parseInt(runId, 10);
      const spinner = ora("Getting log URL…").start();
      try {
        // The API redirects to the actual download URL
        const response = await getClient().request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs", {
          owner,
          repo,
          run_id,
          request: { redirect: "manual" },
        });
        spinner.stop();
        // Octokit follows redirects; if we get a URL in headers, show it
        const url = (response.headers as Record<string, string | undefined>)["location"] ?? response.url;
        printTitle(`Log Download — Run ${run_id}`);
        console.log(c.link(url ?? "(URL unavailable — try fetching directly)"));
      } catch (err: unknown) {
        // 302 redirect gives us the actual URL in the error
        if (err instanceof Error && "response" in err) {
          const res = (err as { response?: { headers?: Record<string, string> } }).response;
          const location = res?.headers?.["location"];
          spinner.stop();
          if (location) {
            printTitle(`Log Download URL — Run ${run_id}`);
            console.log(c.link(location));
            return;
          }
        }
        spinner.fail("Failed");
        printError("Could not get log URL.", err);
      }
    });
}
