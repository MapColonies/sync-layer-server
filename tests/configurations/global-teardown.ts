import dockerCompose from 'docker-compose';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Tearing down Docker containers...');
  await dockerCompose.down({
    commandOptions: ['--volumes', '--remove-orphans'],
  });
}
