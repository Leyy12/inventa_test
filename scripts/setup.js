// `npm run setup` — creates .env from .env.example (never overwrites an existing .env).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, '.env');

if (fs.existsSync(target)) {
  console.log('.env already exists — open it and paste your API key after INVENTA_API_KEY=.');
} else {
  fs.copyFileSync(path.join(root, '.env.example'), target);
  console.log('Created .env — open it and paste your API key after INVENTA_API_KEY=.');
}
