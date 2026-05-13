const BOOLEAN_OPTIONS = new Set([
  'wait',
  'background',
  'json',
  'all',
]);

const VALUE_OPTIONS = new Set([
  'base',
  'scope',
  'timeout',
  'cwd',
  'job-id',
]);

function tokenize(input) {
  const text = String(input ?? '').trim();
  if (!text) {
    return [];
  }

  const tokens = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && index + 1 < text.length) {
        current += text[index + 1];
        index += 1;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function expandArgv(argv) {
  return argv.flatMap((item) => {
    if (typeof item !== 'string') {
      return [];
    }
    if (!item.includes(' ')) {
      return [item];
    }
    return tokenize(item);
  });
}

export function parseArgs(argv = []) {
  const tokens = expandArgv(argv);
  const [command = 'help', ...rest] = tokens;
  const options = {};
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const name = token.slice(2);
    if (BOOLEAN_OPTIONS.has(name)) {
      options[name] = true;
      continue;
    }

    if (!VALUE_OPTIONS.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }

    const value = rest[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name] = value;
    index += 1;
  }

  return { command, options, positionals, rawArgv: tokens };
}

export { tokenize };
