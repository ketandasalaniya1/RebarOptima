# Release checklist

## Platform accounts

`seedDefaults` syncs subscription packages and system roles on every successful database connection. It does not change `passwordHash` or `isActive` on an account that already exists.

Set these before deploying to a database that does not already contain the accounts:

- `DEVELOPER_PASSWORD` creates the developer account only when that account is missing.
- `DEVELOPER_EMAIL` is optional. When it is unset, the developer email used for lookup and creation is `dev@gmail.com`.
- `SUPERADMIN_EMAIL` is the superadmin address. Set it to the existing address on a database that already has that account, so startup does not warn that the account was not created. The existing row is not modified.
- `SUPERADMIN_PASSWORD` creates the superadmin account only when `SUPERADMIN_EMAIL` is set and that account is missing.

If a password variable is missing and the account does not exist, the account is not created and the server logs a warning. No password is printed.

Also set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `MONGODB_URI` for the deployment database. Do not point a test run at that URI.

## Build

From the repo root, with the production API URL available to Vite:

```
npm run build
```

That builds the backend and the frontend. Start the API with `npm run start` after the build. The frontend build is static files.

## Local test data

`npm run e2e:seed` recreates the six local roles and yard stock against the API on `127.0.0.1:3100`. It refuses any Mongo host other than localhost and any database other than `rebaroptima_e2e`.

## Rollback

Keep the previous build directory. To roll back, stop the process, restore the previous `backend/dist` and frontend assets, and start again. Do not run a seed against the production database.

## Backup

Take a Mongo dump of the production database before deploy. Restore that dump to roll data back. This checklist does not start that dump.
