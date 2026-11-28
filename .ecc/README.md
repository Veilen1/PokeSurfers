# ECC + Vercel en PokeSurfers

Selección curada para este proyecto. No se ejecutó el instalador de ECC ni se
activaron hooks.

## Origen

- **ECC:** <https://github.com/affaan-m/ECC> — MIT — commit `4adeee6` (2026-11-19).
- **Vercel React Best Practices:** <https://github.com/vercel-labs/agent-skills> —
  MIT — commit `5a37a63`.

## Skills disponibles (globales)

| Skill | Uso acá |
| --- | --- |
| `vercel-react-best-practices` | Performance de React/Vite: waterfalls, memo, efectos, listeners |
| `react-patterns` | Componentes, hooks, límites server/client |
| `frontend-a11y` | Formularios, foco, teclado |
| `security-review` | Auth, cookies, endpoints, secretos |
| `click-path-audit` | Bugs de estado en login/market/leaderboard |
| `verification-loop` | Cierre: build, tests, lint, diff |
| `seo` | Metadata y contenido público |
| `product-lens` | Priorizar features del juego |

## Agentes (prompts en `.ecc/agents/`)

- `code-reviewer.md`
- `security-reviewer.md`
- `performance-optimizer.md`

Se pasan como instrucciones a subagentes; no se registran automáticamente.

## Deploy

Ver `docs/DEPLOY.md` (frontend Vercel + proxy `/api`, backend Render o Vercel).
