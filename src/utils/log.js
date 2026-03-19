const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
};

const prefix = `${C.bold}${C.cyan}nww-forge${C.reset}`;

export const log   = (msg)  => console.log(`${prefix} ${msg}`);
export const info  = (msg)  => console.log(`${prefix} ${C.blue}${msg}${C.reset}`);
export const ok    = (msg)  => console.log(`${prefix} ${C.green}✔${C.reset} ${msg}`);
export const warn  = (msg)  => console.warn(`${prefix} ${C.yellow}⚠${C.reset}  ${msg}`);
export const error = (msg)  => console.error(`${prefix} ${C.red}✖${C.reset} ${msg}`);
