const args = process.argv.slice(2);
const delayMs = Number(process.env.FAKE_CLAUDE_DELAY_MS || 0);

async function maybeDelay() {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

if (args.includes('--version')) {
  process.stdout.write('2.1.140 (Claude Code)\n');
  process.exit(0);
}

if (args[0] === '-p' || args.includes('--print')) {
  await maybeDelay();
  if (args.some((value) => value.includes('Reply with OK only.'))) {
    process.stdout.write('OK\n');
    process.exit(0);
  }
  process.stdout.write('Findings\n- [P2] Example issue from fake Claude\n');
  process.exit(0);
}

if (args[0] === 'ultrareview') {
  await maybeDelay();
  if (args.includes('--json')) {
    process.stdout.write(
      JSON.stringify({
        findings: [{ priority: 'P1', message: 'Example ultrareview finding' }],
      }),
    );
  } else {
    process.stdout.write('Findings\n- [P1] Example ultrareview finding\n');
  }
  process.exit(0);
}

process.stderr.write(`Unexpected args: ${args.join(' ')}\n`);
process.exit(1);
