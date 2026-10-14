// Runs the Rust relay and the Vite dev server together. Ctrl-C stops both.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const cargo = process.env.CARGO ?? (existsSync(join(homedir(), '.cargo/bin/cargo')) ? join(homedir(), '.cargo/bin/cargo') : 'cargo');
const procs = [
  ['relay', spawn(cargo, ['run', '--quiet'], { cwd: 'engine', stdio: 'inherit' })],
  ['app', spawn('npm', ['run', 'dev', '--', '--open'], { cwd: 'app', stdio: 'inherit', shell: process.platform === 'win32' })],
];
const stop = () => procs.forEach(([, p]) => p.kill('SIGINT'));
for (const [name, p] of procs) p.on('exit', (code) => (code && console.error(`${name} exited with ${code}`), stop()));
process.on('SIGINT', stop);
