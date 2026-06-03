import fs from 'fs';
import path from 'path';

let loaded = false;

export function ensureEnv() {
  if (loaded || process.env.ANTHROPIC_API_KEY) { loaded = true; return; }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const contents = fs.readFileSync(envPath, 'utf8');
    for (const line of contents.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
    loaded = true;
  } catch {
    // file missing — ok in production
  }
}
