# apha-insights-backoffice

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_apha-insights-backoffice&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_apha-insights-backoffice)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_apha-insights-backoffice&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_apha-insights-backoffice)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_apha-insights-backoffice&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_apha-insights-backoffice)

IDM Insights (working name) is the back office frontend for APHA's International Disease Monitoring (IDM) team. IDM
uses it to record risk level changes, replacing risk level changes that are currently produced by hand and published as
PDF reports. This is a skeleton service: the check your answers step logs a submission but does not send or store it
until the backend API exists.

It is built on the Core Delivery Platform (CDP) Node.js frontend template and follows the structure of
[apha-risk-insights-frontend](https://github.com/DEFRA/apha-risk-insights-frontend).

| Route                                          | Page                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /`                                        | Home, with a link to the update risk level page                                                     |
| `GET`, `POST /update-risk-level`               | Choose whether each disease's risk level goes up, down or stays, and add a comment for each disease |
| `GET`, `POST /update-risk-level/check-answers` | Check the answers, then submit                                                                      |
| `GET /update-risk-level/confirmation`          | Submission received                                                                                 |
| `GET /health`                                  | Health check used by the platform                                                                   |

The service name shown in the header and page titles is the `serviceDisplayName` default in
[src/config/config.js](./src/config/config.js). The risk level scale is in
[src/constants/risk-levels.js](./src/constants/risk-levels.js).

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Testing](#testing)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd apha-insights-backoffice
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/config.js`.

## Proxy

We are using forward-proxy which is set up by default. Services are automatically configured with the proxy environment variables when deployed.

Node.js 24 uses these variables to route outbound HTTP(S) requests through the proxy:

NODE_USE_ENV_PROXY=1
HTTPS_PROXY=...
NO_PROXY=...

No additional proxy configuration is required in the service.

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run setup:husky
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

The service runs at <http://localhost:3000>. To override config defaults, copy [.env.example](./.env.example) to `.env`.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Testing

Tests live in `test/`: `test/unit/` mirrors `src/`, and `test/integration/narrow/` exercises the routes through
`server.inject()`.

To run the tests with coverage, then the linters:

```bash
npm test
npm run lint
```

To re-run tests as files change:

```bash
npm run test:watch
```

To run the tests in Docker, as CI does:

```bash
npm run docker:test
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag apha-insights-backoffice`

Build:

```bash
docker build --target development --no-cache --tag apha-insights-backoffice:development .
```

Run:

```bash
docker run -p 3003:3000 apha-insights-backoffice:development
```

### Production image

Build:

```bash
docker build --no-cache --tag apha-insights-backoffice .
```

Run:

```bash
docker run -p 3003:3000 apha-insights-backoffice
```

### Docker Compose

A local environment with:

- Floci (replacing Localstack) for AWS services (S3, SQS)
- Redis
- This service, in `development` mode at <http://localhost:3003> (debugger on port 9231)

```bash
npm run docker:up
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
