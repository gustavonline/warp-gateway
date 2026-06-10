const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function canColor() {
  return !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);
}

export function color(name, text) {
  return canColor() && COLORS[name] ? `${COLORS[name]}${text}${COLORS.reset}` : text;
}

export function bold(text) { return color('bold', text); }
export function dim(text) { return color('dim', text); }
export function green(text) { return color('green', text); }
export function yellow(text) { return color('yellow', text); }
export function red(text) { return color('red', text); }
export function cyan(text) { return color('cyan', text); }
export function magenta(text) { return color('magenta', text); }

export function header(title, subtitle = '') {
  console.log(`${magenta('✦')} ${bold(title)}`);
  if (subtitle) console.log(dim(subtitle));
}

export function step(index, total, title) {
  console.log(`\n${cyan(`[${index}/${total}]`)} ${bold(title)}`);
}

export function ok(message) { console.log(`${green('✅')} ${message}`); }
export function info(message) { console.log(`${cyan('ℹ️ ')} ${message}`); }
export function warn(message) { console.log(`${yellow('⚠️ ')} ${message}`); }
export function fail(message) { console.log(`${red('❌')} ${message}`); }
export function bullet(label, value = '') { console.log(`  ${dim('•')} ${label}${value ? ` ${value}` : ''}`); }
export function command(text) { return cyan(text); }
