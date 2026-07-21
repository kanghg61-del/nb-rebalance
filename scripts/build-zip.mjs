#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const name = process.env.ZIP_NAME || 'reba-nextjs-full.zip';
const out = join(root, name);
const EX = ['node_modules/*','.next/*','.turbo/*','.cache/*','.git/*','.github/*','coverage/*','*.log','.DS_Store','.env','.env.local','.env.*.local',name];
const args = EX.map(p => `--exclude=${p}`).join(' ');
execSync(`cd ${JSON.stringify(root)} && zip -r ${JSON.stringify(name)} . ${args}`, { stdio: 'inherit' });
const mb = (statSync(out).size / 1024 / 1024).toFixed(2);
console.log(`[REBA · zip] ✓ ${name} (${mb} MB)`);
