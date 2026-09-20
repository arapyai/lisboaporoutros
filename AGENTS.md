# AGENTS

## Preview local

- O preview suportado do projeto roda o monorepo localmente e é publicado por um Cloudflare
  Tunnel nomeado, protegido por Cloudflare Access.
- Netlify não faz parte do fluxo de preview nem de deploy deste repositório.
- Configure três hostnames no mesmo tunnel: PWA para `http://localhost:5173`, admin para
  `http://localhost:5174` e API para `http://localhost:8000`.
- Use Quick Tunnels (`trycloudflare.com`) somente com seed ou mocks descartáveis. Nunca exponha
  por Quick Tunnel uma cópia de dados da Railway.
- Tokens do tunnel e credenciais ficam apenas em `.env.preview.local`, que não é versionado.

## Dados locais

- A cópia de dados para testes vem exclusivamente do ambiente `development` da Railway e é
  obtida por `pg_dump` read-only executado via Railway SSH.
- Nunca sincronize produção sem autorização explícita do usuário.
- O destino deve ser um PostgreSQL local em `localhost`/`127.0.0.1`, com nome terminado em
  `_preview`. O script deve recusar qualquer outro destino antes de apagar ou restaurar dados.
- Não copie usuários administrativos nem filas/jobs. Remova identificadores de revisores e
  crie somente o usuário administrativo local documentado.
- Dumps são temporários, não podem ser commitados e devem ser removidos mesmo em caso de erro.

## Ambientes publicados

- Railway continua sendo a plataforma de deploy de API, PostgreSQL, PWA e admin.
- Preview local por tunnel e staging na Railway são fluxos distintos. Não altere Railway,
  Cloudflare DNS/Access ou produção sem pedido explícito.
