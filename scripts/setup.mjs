import { copyFileSync, existsSync } from 'node:fs';

const target = 'apps/api/.env';
if (existsSync(target)) {
  console.log(`${target} already exists, leaving it untouched.`);
} else {
  copyFileSync('.env.example', target);
  console.log(`Created ${target} from .env.example`);
}
