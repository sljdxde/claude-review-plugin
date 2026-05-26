#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(pluginRoot, 'plugins', 'claude-review', 'scripts', 'claude-review.mjs');

const args = process.argv.slice(2);
const command = args[0];

// Help text
function showHelp() {
  console.log(`
  \x1b[1m\x1b[36mclaude-review\x1b[0m - Codex plugin for Claude Code reviews

  \x1b[1mUsage:\x1b[0m
    claude-review <command> [options]

  \x1b[1mCommands:\x1b[0m
    enable          Enable the plugin in Codex configuration
    doctor          Check if all dependencies are ready
    setup           Alias for doctor
    review          Run a code review
    status          Show background job status
    result          Show review results
    cancel          Cancel a running job
    help            Show this help message

  \x1b[1mReview Options:\x1b[0m
    --scope <type>      Review scope: working-tree, branch, or auto (default: auto)
    --base <ref>        Base ref for branch review (e.g., main, master)
    --wait              Run in foreground and wait for result
    --background        Run in background (default)
    --timeout <min>     Timeout in minutes (default: 30)
    --json              Output as JSON
    --cwd <path>        Working directory

  \x1b[1mExamples:\x1b[0m
    claude-review enable                    Setup Codex integration
    claude-review review                    Review current changes
    claude-review review --base main        Review against main branch
    claude-review review --wait             Review and wait for result
    claude-review status                    Check job status
    claude-review result                    Show latest result

  \x1b[1mDocumentation:\x1b[0m
    https://github.com/sljdxde/claude-review-plugin
  `);
}

// Get Codex config path
function getCodexConfigPath() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.codex', 'config.toml');
}

// Enable command - write plugin config to Codex
async function runEnable() {
  const configPath = getCodexConfigPath();
  const configDir = path.dirname(configPath);

  console.log('\x1b[1m\x1b[36m[claude-review]\x1b[0m Enabling plugin in Codex...\n');

  // Ensure config directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Read existing config or create new
  let existingConfig = '';
  try {
    existingConfig = await fs.readFile(configPath, 'utf8');
  } catch {
    // File doesn't exist yet
  }

  // Check if already configured
  if (existingConfig.includes('claude-review@local-codex-plugins')) {
    console.log('  \x1b[32m✓\x1b[0m Plugin already enabled in Codex');
    console.log(`  \x1b[90mConfig: ${configPath}\x1b[0m`);
    return;
  }

  // Add plugin configuration
  const pluginConfig = `
# Claude Review Plugin
[plugins."claude-review@local-codex-plugins"]
enabled = true
`;

  await fs.appendFile(configPath, pluginConfig, 'utf8');

  console.log('  \x1b[32m✓\x1b[0m Plugin enabled in Codex');
  console.log(`  \x1b[90mConfig: ${configPath}\x1b[0m`);
  console.log('\n  You can now use the plugin in Codex:');
  console.log('    \x1b[36m"Let Claude review my changes"\x1b[0m');
  console.log('    \x1b[36m"Claude review against main"\x1b[0m');
}

// Doctor command - check dependencies
async function runDoctor() {
  console.log('\x1b[1m\x1b[36m[claude-review]\x1b[0m Checking dependencies...\n');

  const checks = [];

  // Check Node.js
  const nodeVersion = process.version;
  const nodeOk = parseInt(nodeVersion.slice(1)) >= 22;
  checks.push({
    name: 'Node.js',
    version: nodeVersion,
    ok: nodeOk,
    required: '>=22'
  });

  // Check Git
  try {
    const gitResult = await execCommand('git', ['--version']);
    checks.push({
      name: 'Git',
      version: gitResult.stdout.trim(),
      ok: true
    });
  } catch {
    checks.push({
      name: 'Git',
      version: 'not found',
      ok: false,
      fix: 'Install Git: https://git-scm.com/'
    });
  }

  // Check Claude Code CLI
  try {
    const claudeResult = await execCommand('claude', ['--version']);
    checks.push({
      name: 'Claude Code',
      version: claudeResult.stdout.trim(),
      ok: true
    });
  } catch {
    checks.push({
      name: 'Claude Code',
      version: 'not found',
      ok: false,
      fix: 'Install: npm install -g @anthropic-ai/claude-code'
    });
  }

  // Check Claude auth
  try {
    const authResult = await execCommand('claude', ['auth', 'status']);
    const authData = JSON.parse(authResult.stdout);
    checks.push({
      name: 'Claude Auth',
      version: authData.authMethod || 'authenticated',
      ok: authData.loggedIn === true
    });
  } catch {
    checks.push({
      name: 'Claude Auth',
      version: 'not authenticated',
      ok: false,
      fix: 'Run: claude auth login'
    });
  }

  // Check Codex config
  const configPath = getCodexConfigPath();
  try {
    const config = await fs.readFile(configPath, 'utf8');
    const enabled = config.includes('claude-review@local-codex-plugins');
    checks.push({
      name: 'Codex Plugin',
      version: enabled ? 'enabled' : 'disabled',
      ok: enabled,
      fix: enabled ? null : 'Run: claude-review enable'
    });
  } catch {
    checks.push({
      name: 'Codex Plugin',
      version: 'not configured',
      ok: false,
      fix: 'Run: claude-review enable'
    });
  }

  // Print results
  let allOk = true;
  for (const check of checks) {
    const icon = check.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const version = check.version ? `\x1b[90m${check.version}\x1b[0m` : '';
    console.log(`  ${icon} ${check.name} ${version}`);

    if (!check.ok) {
      allOk = false;
      if (check.fix) {
        console.log(`    \x1b[33m→ ${check.fix}\x1b[0m`);
      }
    }
  }

  console.log('');
  if (allOk) {
    console.log('  \x1b[32m\x1b[1mAll checks passed! Ready to use.\x1b[0m');
    console.log('\n  Try it now:');
    console.log('    \x1b[36mclaude-review review --scope working-tree --wait\x1b[0m');
  } else {
    console.log('  \x1b[31m\x1b[1mSome checks failed. Please fix the issues above.\x1b[0m');
  }
}

// Helper to execute commands
function execCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

// Forward command to the main script
async function forwardToScript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      process.exitCode = code;
      resolve();
    });

    child.on('error', reject);
  });
}

// Main
async function main() {
  switch (command) {
    case 'enable':
      await runEnable();
      break;

    case 'doctor':
    case 'setup':
      await runDoctor();
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;

    default:
      // Forward all other commands to the main script
      await forwardToScript(args);
      break;
  }
}

main().catch((error) => {
  console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
  process.exitCode = 1;
});
