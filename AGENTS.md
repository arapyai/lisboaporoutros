# AGENTS

## Escopo
- Este repositório contém apenas o backend do projeto Lisboa por Outros.
- Implementar apenas backend, testes automatizados e infraestrutura local de desenvolvimento.

## Ambiente
- Usar `nix develop` antes de executar comandos de desenvolvimento.
- Usar `uv` para gerir dependências Python e lockfile.
- Manter dependências nativas e toolchain no `flake.nix`.

## Stack padrão
- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL 16 com PostGIS em produção
- pytest para testes

## Regras de implementação
- Preferir mudanças pequenas e localizadas.
- Todos os endpoints retornam envelope JSON `{data, meta}`.
- Endpoints públicos são read-only e não exigem autenticação.
- Endpoints admin exigem autenticação Bearer JWT.
- Nunca aprovar traduções automaticamente.
- Nunca sobrescrever `audio_files.manually_uploaded=true` em regenerações automáticas.
- Suportar waypoints livres em percursos no backend.
- Encapsular integrações externas em services testáveis.

## Base de dados
- Toda mudança de schema exige migration Alembic.
- A migration inicial deve tentar habilitar PostGIS quando o backend estiver em PostgreSQL.
- Manter unicidade funcional para traduções, áudio e vozes padrão.

## Testes
- Toda feature nova deve incluir testes.
- Cobertura mínima do backend: 70%.
- Testar regras de negócio críticas com unit tests e integration tests.

## Git
- Usar commits atômicos.
- Seguir Conventional Commits.
- Não misturar refatoração e mudança funcional no mesmo commit.

## Segurança
- Nunca commitar segredos.
- Manter `.env.example` sem valores reais.
- Validar uploads e inputs externos.
