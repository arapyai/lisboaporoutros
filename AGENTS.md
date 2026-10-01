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
- Contratos editoriais e identidade de etapas também devem passar no runner
  `scripts/test-postgres-ux.sh`: PostgreSQL/PostGIS privado, migrations reais e dados sintéticos.
  SQLite/create_all ou geração de DDL não substituem aplicação real das migrations;
  o job `postgres-editorial` do CI executa os casos que a suíte comum pula sem esse runner.

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

- Painéis de domínio são donos de dependências, filtros, campos e editores relacionados.
  Lifecycle compartilhado de drafts/save/guard não deve manter caminhos mortos de outros
  domínios. Render callbacks retornam componentes estáveis; não defina tipos de componentes
  dentro do render. Teste identidade/foco durante digitação e requests específicos da tela,
  distinguindo tradução de ponto de coleção global de traduções de textos.
- Pendências agregadas reutilizam as regras de prontidão do backend, sem inferir publicação
  no cliente nem consultar cada percurso/idioma separadamente. Falha por fonte não é zero
  pendências; refetch falho identifica dados antigos. Links preservam item, idioma e etapa.
- Inventário de cópias locais é somente leitura, validado e limitado à identidade ativa.
  Listar/abrir nunca restaura, apaga, aprova ou inicia geração. Bandejas de status não devem
  cobrir ações: teste cliques normais no fim da página também em viewports de pouca altura.
- Listagens devem carregar também relações aninhadas usadas pelos serializers, sem consultas
  por item (N+1). Teste o orçamento de queries com múltiplos pontos distintos e uma sessão
  nova; caches da fixture podem ocultar carregamento lazy. Meça no serviço publicado, sem
  confundir tempo interno do backend com a jornada completa no navegador.
- Mudança de seção, item, histórico e logout deve consultar o guard de rascunhos.
  Defaults automáticos não são edições humanas; operações em andamento bloqueiam a saída.
- Navegação com escolha assíncrona captura um único destino; não altere seleção antes do
  aceite. Cancelar histórico deve restaurar a entrada, não substituir somente sua URL e
  consumir Voltar/Avançar. Teste cancelamentos repetidos seguidos de saída confirmada.
- Drawer móvel deve ceder contenção/inert ao diálogo de saída. Cancelar devolve foco ao
  campo; fechar devolve ao invocador/busca somente após remoção e restauração de inert.
  Cleanup simulado de StrictMode não é fechamento real nem autoriza mover foco.
- Foco inicial agendado deve verificar se a pessoa já interage no editor antes de mover
  foco/rolar. Teste frame atrasado após a primeira digitação, não apenas abertura em repouso.
- Guardar e sair só pode ser oferecido se todos os editores sujos registrarem gravação segura.
  Não converta aprovação/publicação/geração em save implícito. Espere sucesso de todos; na
  falha mantenha edição/diálogo sem replay automático. Modal de saída deve liberar a página
  para reautenticação na suspensão401 e retomar sem repetir requests. Teste Tab/Shift+Tab
  explicitamente: dialog nativo não comprova o wrap de foco desejado.
- Guardar narrativa preserva a visibilidade do servidor; percurso novo começa não publicado.
  Publicar/retirar de publicação é ação explícita confirmada, com payload mínimo e prontidão
  revalidada no backend. Nunca publique via Guardar e sair nem recalcule waypoints nessa saída.
  Rascunhos de idiomas/revisão continuam exigindo ações editoriais explícitas.
- Consulta falha não equivale a coleção vazia. Atualização em segundo plano não pode desmontar
  o editor nem substituir alterações locais. Cubra erro inicial, retry e refetch durante edição.
- HTTP 401 suspende a sessão preservando editores nesta aba; retomada exige a mesma identidade
  ativa verificada no backend. Renove credenciais sem mudar o escopo/cache dos rascunhos; nunca
  repita mutações automaticamente. HTTP 403 é falta de permissão, não expiração nem mock.
  Não coloque senhas/rascunhos no módulo de sessão; reload exige recuperação editorial própria.
- Recuperação editorial local usa namespace/versionamento, identidade ativa, entidade/item/idioma
  e whitelist de campos, nunca objetos de API inteiros ou formulários de credenciais. Ofereça
  restauração explícita e compare a base; cópia local não significa gravação/publicação.
  Descarte confirmado e logout removem cópias desta conta; se a limpeza falhar, avise. TTL
  invalida a recuperação (não garante exclusão física sem novo acesso); não é proteção contra
  acesso físico/XSS nem concorrência remota. Amplie aos domínios com testes próprios.
- Recuperar metadados de percurso restaura somente título/descrição, nunca aprovação ou revisor.
  Aprovação exige o clique explícito de revisão; a existência de uma cópia local não resolve
  prontidão de publicação. Teste reload e zero requests antes dessa ação, além do caminho feliz.
- Tipo de ponto inativo não pode ser default de criação. Preserve e identifique relações
  existentes/inativas ou indisponíveis, sem limpar/repor em effects e apagar outros campos.
- Autor/ponto atual ausente nas opções de um texto deve continuar selecionado e ser identificado
  como indisponível. Lista parcial/vazia não autoriza apagar a associação nem criar edição-base
  durante revisão de uma tradução; teste navegação e reload sem alteração humana dos metadados.
- Link de registro só habilita campos e gravação depois de instalar o rascunho selecionado.
  Em testes de hash/history, espere o registro de destino antes de digitar: URL alterada não
  comprova que a tela de origem já deixou de aceitar interação.
- Hidratação usada para habilitar campos/recuperação precisa provocar renderização: mudar
  somente uma ref em effect pode deixar versão vazia bloqueada. Cubra a primeira abertura
  sem conteúdo, identidade de percurso/etapa e restauração antes de aceitar edição.
- Abas de idioma devem associar aba/painel, manter um único alvo no Tab e suportar
  setas/Home/End sem remontar rascunhos. Gravações devem bloquear edição concorrente até a
  resposta; teste também falha de gravação e retenção do texto digitado.
- Bloqueio global de operação deve ser consultado por submits e ações de editores aninhados,
  não somente pela navegação. Teste pai→tradução e tradução→pai contando requests: uma operação
  pendente não autoriza outro botão a gravar/gerar/apagar em paralelo.
- Painel só declara aria-modal quando bloqueia de fato o exterior: no celular, conter Tab e
  tornar irmãos inert; no desktop, preservar navegação. Escape consulta o mesmo guard do botão
  fechar. Restaurar foco ao invocador ou à busca, sem remontar o painel a cada alteração.
- Waypoints são gravados pelo recálculo, não pelo botão de guardar narrativa. Inclua-os no
  indicador de alterações e na recuperação local, com versão e isolamento por administrador.
- Recuperação de narrativa guarda metadados editáveis, IDs/ordem/conteúdo PT e waypoints,
  nunca publicação, objetos de texto, revisão ou mídia. Enriquecer do servidor ao restaurar.
  Save parcial não apaga waypoints por recalcular; descarte/logout também limpam o legado
  desta conta. Cópia antiga sem data/base exige aviso durável até a escolha, não histórico
  fabricado; migrar somente após validação e preservar fonte quando storage falhar.
- Remover etapa é diferente de selecioná-la: interrompa a propagação do clique e consulte o
  bloqueio de operações. Remover a ponte selecionada com EN sujo ou cópia por restaurar exige
  confirmação; cancelar conserva etapa/cópia. Remover outra etapa não descarta o EN selecionado.
  A remoção é local até guardar a narrativa, não uma gravação ou aprovação automática.
- Alterar narrativa não deve recriar etapas retidas nem apagar tradução/revisão/áudio manual.
  Envie IDs persistidos, nunca IDs local-; valide pertencimento, duplicação e identidade antes
  de alterar o banco. No modo preserve, ausência de ID significa etapa nova e exclusão é por
  omissão. Clients antigos ambíguos devem falhar com segurança, não escolher uma ponte ao acaso.
  Reordenação exige posições temporárias livres antes do flush para não violar unicidade.
- Traduções de metadados e pontes têm gravação e aprovação explícitas. Uma resposta HTTP 200
  de geração de áudio também exige verificar o estado do job; áudio antigo não prova sucesso.
- Upload manual também é operação pendente: bloqueie navegação, troca de etapa e outros envios
  até resposta. Capture registro/etapa/idioma antes do envio, confirme a substituição com escopo,
  preserve áudio anterior na falha e permita selecionar o mesmo ficheiro novamente. Testes de
  geração não cobrem upload; use ficheiros sintéticos, sem provider pago ou conteúdo real.
- Falha ao iniciar WebGL não pode derrubar o admin: preserve coordenadas, GPS e edição
  narrativa com uma alternativa clara. Teste o fallback sem confundi-lo com um mapa validado.
- Na recuperação de legado, compare também registro do router, configuração, dependências,
  modelos, todos os caminhos de criação/importação e CSS responsivo. Migração existente não
  comprova que a funcionalidade esteja acessível. PDF/XLSX devem usar o mesmo snapshot/códigos.

## Pipeline editorial e áudio

- Reimportar conteúdo idêntico preserva revisão/proveniência de traduções e biografias,
  mesmo após revisão humana mudar a origem para manual. Planner e confirmação precisam
  concordar; conteúdo realmente alterado volta a pending sem reutilizar revisão antiga.
- Geração individual valida aprovação antes de criar job ou consultar voz/provider.
  HTTP200 com job falho não é autorização editorial. Preserve no-op de áudio manual e
  mantenha validação no worker para jobs antigos e mudanças concorrentes de conteúdo.
- Tradução, aprovação editorial e geração de áudio são etapas separadas.
- Nunca aprove traduções automaticamente. Gere áudio traduzido apenas para traduções já
  aprovadas.
- Defaults, payloads e workers de lote devem respeitar a mesma regra: rejeitar pedido de
  aprovação automática e ignorar flags antigas no worker. Não atribuir revisão humana a quem
  apenas pediu geração; não reescrever aprovações históricas para esconder essa divergência.
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
