import path from 'path';
import dockerCompose from 'docker-compose';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Tearing down Docker containers...');
  await dockerCompose.down({
    cwd: REPO_ROOT,
    config: 'docker-compose.test.yml',
    commandOptions: ['--volumes', '--remove-orphans'],
  });
}
