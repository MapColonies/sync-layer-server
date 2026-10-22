# Sync Layer Server

----------------------------------

Service that continuously synchronizes geospatial layer data from a third-party GraphQL API into a remote PostgreSQL database.

See [SYNC.md](./SYNC.md) for a detailed description of the sync module architecture and lifecycle.

## Development
When in development you should use the command `npm run start:dev`. The main benefits are that it enables offline mode for the config package, and source map support for NodeJS errors.

### Features:

- eslint configuration by [@map-colonies/eslint-config](https://github.com/MapColonies/eslint-config)

- prettier configuration by [@map-colonies/prettier-config](https://github.com/MapColonies/prettier-config)

- vitest

- .nvmrc

- Multi stage production-ready Dockerfile

- commitlint

- git hooks

- logging by [@map-colonies/js-logger](https://github.com/MapColonies/js-logger)

- config load with [@map-colonies/config](https://www.npmjs.com/package/@map-colonies/config)

- Tracing and metrics by [@map-colonies/telemetry](https://github.com/MapColonies/telemetry)

- github templates

- bug report

- feature request

- pull request

- github actions

- on pull_request

- LGTM

- test

- lint

- snyk

## Installation

Install deps with npm

```bash
npm install
```

## Run Locally

Clone the project

```bash

git clone https://link-to-project

```

Go to the project directory

```bash

cd sync-layer-server

```

Install dependencies

```bash

npm install

```

Start the server

```bash

npm run start

```

## Run Migrations
Run migrations before you start the app

## Migrations Development
* Update metadata file or change DB details (fakeDB for example)
* npm run migration:create

### Shell
Run the following command:

```sh
npm run migration:run
```

### Docker
Build the migrations image:

```sh
docker build -t sync-layer-server-migration:latest -f migrations.Dockerfile .
```
Run image:
```sh
docker run -it --rm --network host sync-layer-server-migration:latest
```

If you want to change the connection properties you can do it via either:
1. Env variables
2. Inject a config file based on your environment


Via env variables:
```sh
docker run -it -e DB_USERNAME=VALUE  -e DB_PASSWORD=VALUE -e DB_NAME=VALUE -e DB_TYPE=VALUE -e DB_HOST=VALUE -e DB_PORT=VALUE --rm --network host sync-layer-server-migration:latest
```

#### SSL/TLS Configuration

For secure database connections using SSL certificates:

**Environment Variables:**
- `DB_ENABLE_SSL_AUTH` - Set to `true` to enable SSL (default: `false`)
- `DB_KEY_PATH` - Path to client private key file
- `DB_CERT_PATH` - Path to client certificate file
- `DB_CA_PATH` - Path to CA certificate file (optional)

The CA certificate is optional. When `DB_CA_PATH` is set, the server certificate is verified against it (verification is enforced when `NODE_ENV=production`). When `DB_CA_PATH` is not set or empty, the connection is still encrypted, but the server certificate is not verified (`rejectUnauthorized: false`).

In the Helm chart, `DB_CA_PATH` is rendered only when `postgres.ssl.caFileName` is set.

**Example with SSL (omit `DB_CA_PATH` to connect without a CA certificate):**
```sh
docker run -it \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=sync-layer \
  -e DB_ENABLE_SSL_AUTH=true \
  -e DB_KEY_PATH=/app/certs/client-key.pem \
  -e DB_CERT_PATH=/app/certs/client-cert.pem \
  -e DB_CA_PATH=/app/certs/ca.pem \
  -v /path/to/certs:/app/certs:ro \
  --rm --network host \
  sync-layer-server-migration:latest
```

Via injecting a config file, assuming you want to run the migration on your production:

production.json:
```json
{
  "openapiConfig": {
    "filePath": "./openapi3.yaml",
    "basePath": "/docs",
    "rawPath": "/api",
    "uiPath": "/api"
  },
  "logger": {
    "level": "info"
  },
  "server": {
    "port": "8085"
  },
  "db": {
    "type": "postgres",
    "username": "postgres",
    "password": "postgres",
    "database": "catalog",
    "port": 5432
  }
}
```
```sh
docker run -it --rm -e NODE_ENV=production --network host -v /path/to/proudction.json:/usr/app/config/production.json sync-layer-server-migrations:latest
```
---

## Running Tests

To run tests, run the following command

```bash

npm run test

```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```
