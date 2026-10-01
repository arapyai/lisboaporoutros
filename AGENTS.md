# AGENTS

## Fonte de verdade

- A branch `production` é a referência canônica do repositório e a branch padrão no GitHub.
- Toda branch de trabalho deve partir de `production` e todo Pull Request deve ter `production`
  como base, salvo uma recuperação emergencial explicitamente documentada.
- `main` e `development` são branches legadas. Não publique domínios canônicos nem inicie
  trabalho novo a partir delas.
- Não faça push direto em `production`: use branch descritiva, testes, PR e revisão. Não faça
  merge sem pedido explícito.

## Publicação

- Os três serviços públicos — API, PWA e admin — devem ser publicados pelo ambiente de produção
  da Railway a partir da mesma revisão de `production`.
- `https://api.lisbon.literarymap.org`, `https://lisbon.literarymap.org` e
  `https://admin.lisbon.literarymap.org` são domínios canônicos de produção. Não os associe ao
  ambiente `development`.
- Evite deploy manual de branch de feature em domínio canônico. O commit publicado deve ser
  rastreável na branch `production`.
- Antes e depois de publicar, confirme ambiente, serviço, branch, commit, migrations, health,
  HTTP dos frontends e um fluxo real no navegador. `SUCCESS` no Railway sozinho não basta.
- O ambiente `development` é apenas para integração temporária e usa somente domínios de
  desenvolvimento ou do provedor.

## Banco e migrations

- Nunca presuma que o histórico Alembic do banco coincide com a branch. Consulte a revisão
  aplicada antes do deploy quando houve publicação manual anterior.
- Se o banco apontar para uma revisão ausente no Git, recupere a migration original e restaure
  uma única cadeia linear; não use downgrade ou `stamp` para esconder drift.
- Toda migration nova deve ter teste e `uv run alembic heads` deve retornar uma única head.

## Qualidade

- Correções de coordenadas exigem confirmação explícita, autorização no backend e
  auditoria transacional (antes/depois, responsável, data e fonte). GPS do visitante
  nunca altera conteúdo. Não fabrique histórico para dados anteriores à auditoria.
- A sessão do admin em outro domínio não implica autenticação no site público;
  nunca transfira tokens em URLs. Testes com GPS simulado não validam sensores reais.

- Mudanças de frontend exigem unit tests, lint, build e E2E proporcional em Chromium, Firefox e
  WebKit. Inclua mobile, desktop, estados de erro e interações críticas.
- Mudanças de backend exigem lint, formatação e a suíte completa com cobertura mínima de 70%.
- Casos editoriais e operacionais também precisam de auditoria explícita; não trate ausência de
  conteúdo, credencial ou aprovação como bug de interface.

## Confiabilidade do administrativo

- Listagens devem carregar também relações aninhadas usadas pelos serializers, sem consultas
  por item (N+1). Teste o orçamento de queries com múltiplos pontos distintos e uma sessão
  nova; caches da fixture podem ocultar carregamento lazy. Meça no serviço publicado, sem
  confundir tempo interno do backend com a jornada completa no navegador.
- Mudança de seção, item, histórico e logout deve consultar o guard de rascunhos.
  Defaults automáticos não são edições humanas; operações em andamento bloqueiam a saída.
- Consulta falha não equivale a coleção vazia. Atualização em segundo plano não pode desmontar
  o editor nem substituir alterações locais. Cubra erro inicial, retry e refetch durante edição.
- Abas de idioma devem associar aba/painel, manter um único alvo no Tab e suportar
  setas/Home/End sem remontar rascunhos. Gravações devem bloquear edição concorrente até a
  resposta; teste também falha de gravação e retenção do texto digitado.
- Waypoints são gravados pelo recálculo, não pelo botão de guardar narrativa. Inclua-os no
  indicador de alterações e na recuperação local, com versão e isolamento por administrador.
- Traduções de metadados e pontes têm gravação e aprovação explícitas. Uma resposta HTTP 200
  de geração de áudio também exige verificar o estado do job; áudio antigo não prova sucesso.
- Falha ao iniciar WebGL não pode derrubar o admin: preserve coordenadas, GPS e edição
  narrativa com uma alternativa clara. Teste o fallback sem confundi-lo com um mapa validado.
- Na recuperação de legado, compare também registro do router, configuração, dependências,
  modelos, todos os caminhos de criação/importação e CSS responsivo. Migração existente não
  comprova que a funcionalidade esteja acessível. PDF/XLSX devem usar o mesmo snapshot/códigos.

## Pipeline editorial e áudio

- Tradução, aprovação editorial e geração de áudio são etapas separadas.
- Nunca aprove traduções automaticamente. Gere áudio traduzido apenas para traduções já
  aprovadas.
- Nunca sobrescreva `audio_files.manually_uploaded=true` em regenerações automáticas.
- Antes de um disparo em lote, verifique credencial, voz, quota, volume persistente e worker;
  registre o job e acompanhe itens concluídos e falhos até estado terminal.

## Instruções específicas

- Para trabalho em `backend/`, aplique também `backend/AGENTS.md`.

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
- Preview local por tunnel e ambiente `development` são fluxos distintos. Não altere Railway,
  Cloudflare DNS/Access ou produção sem pedido explícito.
