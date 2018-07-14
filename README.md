# The OpenAerialMap API

## Initialization

1. Run `docker-compose -f docker-compose.yml -f docker-compose.debug.yml up --build` to build and start in development mode.

## Database Initialization

First, install PostgreSQL. Then:

```bash
createdb openaerialmap_development
```

To import data from a `mongoexport`:

```bash
node_modules/.bin/ts-node bin/00-import-users.ts < users.json
node_modules/.bin/ts-node bin/01-import-images.ts < images.json
node_modules/.bin/ts-node bin/02-import-uploads.ts < uploads.json
node_modules/.bin/ts-node bin/03-import-metas.ts < metas.json
```