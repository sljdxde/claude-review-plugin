function formatList(items = []) {
  return items.map((item) => `- ${item}`).join('\n');
}

export function renderSetupReport(report) {
  const readiness = report.ready ? 'ready' : 'not ready';
  const authStatus = report.claude.authUsable ? 'OK' : 'FAILED';
  const lines = [
    `Claude Review setup: ${readiness}`,
    '',
    `- Node: ${report.node.available ? report.node.version : 'missing'}`,
    `- Git: ${report.git.available ? report.git.version : 'missing'}`,
    `- Claude: ${report.claude.available ? report.claude.version : 'missing'}`,
    `- Non-interactive Claude run: ${authStatus}`,
  ];

  if (report.nextSteps?.length) {
    lines.push('', 'Next:', formatList(report.nextSteps));
  }

  return `${lines.join('\n')}\n`;
}

export function renderQueuedReview({ jobId }) {
  return [
    `Claude review started in the background as ${jobId}.`,
    `Check /claude:status ${jobId} for progress.`,
    '',
  ].join('\n');
}

export function renderSingleJobStatus(job) {
  return [
    `${job.id} | ${job.target?.label ?? 'unknown target'} | ${job.status} | ${job.phase ?? 'unknown phase'}`,
    job.logFile ? `Log: ${job.logFile}` : null,
  ].filter(Boolean).join('\n');
}

export function renderStatusReport({ workspaceRoot, jobs }) {
  const lines = [`Claude Review jobs for ${workspaceRoot}`, ''];
  const running = jobs.filter((job) => ['queued', 'running'].includes(job.status));
  const recent = jobs.filter((job) => !['queued', 'running'].includes(job.status));

  lines.push('Running:');
  lines.push(running.length ? formatList(running.map((job) => `${job.id} | ${job.target?.label ?? 'unknown'} | ${job.phase ?? job.status}`)) : '- none');
  lines.push('');
  lines.push('Recent:');
  lines.push(recent.length ? formatList(recent.map((job) => `${job.id} | ${job.target?.label ?? 'unknown'} | ${job.status}`)) : '- none');
  lines.push('');

  return lines.join('\n');
}

export function renderStoredJobResult(job) {
  return [
    `Claude Review result: ${job.id}`,
    `Target: ${job.target?.label ?? 'unknown target'}`,
    `Status: ${job.status}`,
    '',
    job.result?.rawOutput ?? job.errorMessage ?? 'No stored output.',
    '',
  ].join('\n');
}

export function renderCancelReport(job) {
  return [
    `Claude review cancelled: ${job.id}`,
    `Target: ${job.target?.label ?? 'unknown target'}`,
    '',
  ].join('\n');
}
