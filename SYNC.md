# Cross-Computer GitHub Workflow

GitHub is the source of truth for this project.

## Start work on another computer

```bash
git clone git@github.com:dimaso-doo/dimaso-audit-tool.git
cd dimaso-audit-tool
git switch feature/audit-mvp
npm install
cp .env.example .env.local
npm run dev
```

## Daily sync

```bash
git fetch origin
git switch feature/audit-mvp
git pull --ff-only
```

Before pushing:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git push
```

Never commit `.env.local`, API keys, `.next`, or `node_modules`.
