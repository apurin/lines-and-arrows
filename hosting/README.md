# Website hosting

`lines-and-arrows.dev` is served from `website/` by Caddy on Railway: project
`lines-and-arrows`, environment `production`, service `website`, one replica in
EU West. The [Caddyfile](./Caddyfile) keeps the clean URLs, 404 page, `www`
redirect, and cache headers the site links rely on.

DNS stays on Cloudflare. The apex and `www` are CNAMEs to the targets Railway
shows for each custom domain, and both must stay DNS only: Spanish ISPs block
Cloudflare's shared proxy addresses during football matches.

The service itself holds three settings: Dockerfile path
`hosting/Dockerfile`, healthcheck path `/`, and the variable `PORT=8080`.
Railway no longer reads `railway.json`, so these live on the service rather
than in the repository.

## Deploying

Deploy after `npm run website:prepare`, from a clean checkout of the commit to
publish. `railway up` uploads the working tree, not the commit, so anything
uncommitted and not ignored ships too. The CLI reads a workspace token from
`RAILWAY_API_TOKEN`. Such a token cannot run `railway link`, so pass the
project ID shown in the project's settings in the Railway dashboard.

```sh
railway up --project <project-id> \
  --environment production --service website --ci \
  --message "$(git log -1 --format='%h %s')"
```

The healthcheck must pass before Railway moves traffic, so a broken Caddyfile
leaves the previous deployment serving.
