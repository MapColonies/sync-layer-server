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
