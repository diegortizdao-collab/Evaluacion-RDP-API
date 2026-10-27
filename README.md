# Evaluación RDP · API

Cloudflare Worker + Neon (Postgres) para la app [Evaluacion-RDP-Escorial](https://github.com/diegortizdao-collab/Evaluacion-RDP-Escorial).
Endpoints: `GET /evals` y `PUT /evals/:key`. El total (sobre 100) se recalcula en el servidor con los pesos de la rúbrica.

## Estado
- Base Neon: proyecto **Evaluacion RDP Escorial** (sa-east-1), tabla `rdp_evals` ya creada (`schema.sql`).

## Despliegue (Cloudflare, conectado a GitHub)
1. Workers & Pages → Create → Import a repository → `Evaluacion-RDP-API` (carpeta raíz: `/`).
2. Nombre del Worker: `evaluacion-rdp-api`.
3. Settings → Variables and secrets → secreto `NEON_URL` (connection string de Neon, botón *Connect*).
4. Copiar la URL del Worker en `config.js` → `API_URL` del repo de la app.

---
Desarrollado por Mgter. Diego Ortiz — Líder de Mejora Continua | Consultor ISO
