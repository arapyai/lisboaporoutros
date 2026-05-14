# Arquitetura do Projeto

Este documento resume a arquitetura geral descrita em `docs/lisboa_spec_geral.md` e a traduz para a estrutura atual do monorepo.

## Visao do sistema

O projeto Lisboa por Outros e composto por:

- clientes: app mobile, web PWA e painel admin
- backend: API FastAPI responsavel por conteudo, autenticacao admin, traducoes e audio
- persistencia: PostgreSQL com PostGIS
- integracoes externas: ElevenLabs, Gemini e Cloudflare R2

## Estrutura de repositorio alvo

Segundo a especificacao geral, o monorepo deve evoluir para workspaces separados por superficie de produto:

```text
.
├── backend/
├── mobile/
├── webapp/
├── admin/
├── docs/
└── .github/workflows/
```

## Estrutura atual

Neste momento o repositorio contem:

- `backend/`: implementacao completa do servidor e seus artefatos locais
- `docs/`: especificacao geral e documentacao transversal

Isso mantem a base pronta para receber os demais workspaces sem nova reorganizacao da raiz.

## Backend no monorepo

O workspace `backend/` concentra tudo que pertence ao servidor:

- codigo da aplicacao em `backend/app`
- migrations em `backend/alembic`
- testes em `backend/tests`
- lockfiles e configuracao do ambiente Python/Nix
- caches e artefatos locais de desenvolvimento do backend

## Fonte de verdade documental

- `docs/lisboa_spec_geral.md`: fonte de verdade funcional e arquitetural do projeto
- `backend/README.md`: operacao e desenvolvimento do backend
- `README.md`: leitura rapida da organizacao do monorepo
