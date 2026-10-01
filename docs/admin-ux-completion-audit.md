# Auditoria de conclusão da reforma UX

Objetivo: finalizar a reforma da UX com testes e deploy verificados. Este documento não reduz
o objetivo às mudanças já aplicadas. Uma linha pendente não pode ser considerada concluída
porque um build ou uma suíte não relacionada passou.

Fonte dos critérios: `admin-ux-refactoring-plan.md`, `AGENTS.md` e autorização do usuário para
concluir/testar/publicar. Revisão inicial em 01/10/2026 (UTC). Atualizar evidências por commit/PR.

## Critérios funcionais

| Critério | Estado atual / evidência necessária |
| --- | --- |
| Recuperação seletiva do mapa e exportação editorial | Implementados anteriormente; revalidar regressões e smoke publicado na revisão final |
| URL por seção/item/idioma/filtro | Implementados em Textos/autores/pontos/tipos/percursos; testes de contexto passam em Chromium/Firefox. Novo CI ainda necessário |
| Menu, item, histórico, fechamento e logout respeitam rascunhos | Guards e E2E existentes; ampliar jornada com salvar/sair e recuperação de autenticação |
| Salvar, aprovar, gerar e publicar são ações distintas | Aprovação automática removida de Textos/API/worker (issue #121); regressões cobrem flag legada, 422 sem jobs, revisão humana antes do áudio e preservação do conteúdo revisto. CI/release desta correção ainda necessários; inventário dos demais caminhos pendente |
| Estados carregando/vazio/filtro/erro inicial/refetch consistentes | Textos cobertos; autores/pontos em implementação. Inventário dos demais painéis pendente |
| Falha ao salvar preserva trabalho, sem sucesso prematuro | 401 com retomada da mesma identidade/PT/EN e 403 sem logout cobertos nesta aba; inventário por domínio e matriz completa 409/422/5xx ainda pendentes |
| Rascunhos por entidade/idioma não são substituídos por refetch | Textos/pontos/waypoints têm proteções; matriz completa e controlador comum pendentes |
| Recuperação local versionada, identidade, storage indisponível e logout | Campos principais de autores/pontos/tipos, texto-base e traduções de textos têm contrato versionado comum, restauração explícita, aviso de base alterada e limpeza desta conta. Waypoints têm contrato anterior; idiomas de pontos, narrativa/pontes e demais editores ainda precisam de migração e cobertura |
| Bloqueios editoriais abrem ações resolutivas | Metadados EN têm caminho; painel agregado de pendências e todos os bloqueios pendentes |
| Jornada real CSV → revisão → áudio → percurso PT/EN → publicação | Mocks não bastam; fixture/backend isolado e teste contratual completos pendentes |
| Lotes: preview, escopo, parcial, histórico, falhas e revisão exata | Capacidades existentes; auditoria da jornada e contexto/estado persistente pendentes |
| Áudio manual protegido; geração não aprova tradução | Regressões existentes; incluir na jornada contratual final |
| Shell/auth e domínios separados com contratos de cache/draft | Boot/auth/shell/ResourcePanel extraídos; restante da divisão funcional e controlador comum pendentes |
| Consulta não faz N+1 e operações pagas não duplicam | Fix/backend/query budgets anteriores; conferir escopo após novas mudanças |
| Escala/concorrência | Fase condicionada do plano: exigir evidência e decisão própria antes de alterações contratuais; não declarar ausência de conflitos garantida por guard local |

## Validação/release

| Critério | Estado atual / evidência necessária |
| --- | --- |
| Matriz renderizada mobile/tablet/laptop, bordas e 200% de zoom | Textos com limites/bordas no E2E; demais painéis, zoom e baixa altura pendentes |
| Foco inicial/restaurado, Escape, teclado e tabs acessíveis | Abas de Textos/pontos e drawers de Textos/lote/pacote têm cobertura de teclado. Mobile contém foco e torna o exterior inert; desktop mantém navegação. Retorno ao invocador/busca e Escape com cancelamento testados. Demais overlays e leitores de tela pendentes |
| Campos/listas substituem mapa quando WebGL falha | Fallback implementado; manter regressão e não chamar fallback de mapa validado |
| Chromium/Firefox/WebKit na revisão final | #117 original teve CI verde; novos commits exigem novo CI e inspeção do escopo |
| Safari/iOS e Chrome/Android reais (teclado/GPS/upload/áudio) | Não disponíveis nesta sessão; emulação/WebKit Linux não comprovam este critério |
| Unitários, lint/typecheck/build, suite backend se alterado | Verificações por fatia; gate final deve corresponder ao commit publicado |
| PR revisado e production canônica | #117 ainda draft; sem merge desta reforma neste checkpoint |
| Railway API/PWA/admin na mesma revisão production | Verificar configuração, commit e estado antes/depois do deploy final |
| Banco/migration/health/domínios e fluxo real publicado | Verificar release final sem alterar conteúdo real; SUCCESS da Railway não é suficiente |
| Monitoramento externo | Usuário adiou configuração de alertas externos; respeitar exceção e não cadastrar sem nova direção |

## Regra de conclusão

Concluir somente depois de inspecionar a implementação, testes de cada jornada e estado publicado.
Registrar limitações como limitações, nunca como itens concluídos. Os resultados da primeira
fatia não provam a reforma inteira. Enquanto houver critério obrigatório sem evidência, manter
a meta ativa; autorização ou ajuda externa necessária deve ser solicitada sem esconder o restante.

## Continuação: idiomas e gravações

- Abas compartilham o mesmo componente de teclado e semântica acessível, mantendo os
  rascunhos por idioma. A troca não remonta os campos e não intercepta Tab ou setas verticais.
- Durante gravação de versão, os campos ficam bloqueados até a resposta do servidor. Gravar
  o texto principal bloqueia também metadados, idiomas e exclusão. A falha 503 mantém o texto
  digitado; operações simultâneas de gravação/exclusão consultam o guard global.
- Validação local: 76 E2E Chromium/Firefox, 31 unitários admin, 7 compartilhados e
  build/typecheck. Inspeção Chrome móvel emulado 390×844 de criação de texto, sem overflow.
  Sem mudanças de backend ou banco; não houve deploy nesta etapa.
- WebKit da nova revisão precisa passar no CI. Dispositivos reais, leitores de tela e
  navegação modal dos drawers não foram validados por esta fatia.

## Continuação: ciclo de foco dos drawers

- `EditorDrawer` compartilhado por texto, lote e pacote de áudio: foco no título, Escape
  guardado e retorno ao invocador. Link direto sem invocador retorna à busca.
- Até 820 px, role dialog/aria-modal, exterior inert e Tab/Shift+Tab contidos. Acima,
  o exterior permanece disponível. Mudanças 819/820/821 preservam rascunho e restauram inert.
- Lote e pacote registram operações pendentes no guard e bloqueiam campos até resposta.
  Nenhum serviço pago foi disparado: testes usam respostas locais isoladas.
- 92 E2E Chromium/Firefox passaram, incluindo 390/821/1366 e falhas/cancelamento. 31 unitários
  admin, 7 compartilhados e build/typecheck passaram. Chrome emulado 390×844 com screenshot,
  foco, inert, ausência de overflow e console sem erros/avisos. WebKit atualizado fica no CI;
  leitores de tela e aparelhos físicos não testados. Sem merge/deploy nesta etapa.
- CI 36800147612 terminou verde para o commit anterior `1e951f8`, incluindo WebKit; não usar
  esse resultado como prova desta nova implementação de drawers.
- Achado editorial separado: issue #121 documenta defaults e worker de aprovação automática,
  incluindo teste existente que protege o comportamento divergente. Corrigir antes do release.

## Continuação: revisão humana obrigatória no lote (#121)

- Três testes novos falharam no comportamento anterior: default automático e aceitação de
  `true`. A suíte anterior afirmava aprovação automática e atribuía o pedido de geração como
  revisão humana, contradizendo a especificação e AGENTS.md.
- Interface remove a opção e explica revisão antes do áudio. API aceita somente false/omissão,
  rejeita true com 422 sem criar lote/jobs. Worker não utiliza a flag antiga, não altera revisor
  nem data e não enfileira áudio automaticamente após tradução.
- Backend cobre tradução nova, lote legado true, conteúdo pendente/rejeitado preexistente,
  preservação de tradução já revista e áudio bloqueado por 409 até aprovação humana explícita.
  Depois da aprovação, o disparo explícito mantém a voz solicitada.
- Migration `20261001_000024` muda apenas o default; não muda linhas históricas nem apaga a
  coluna. Testes de upgrade/downgrade SQLite e DDL PostgreSQL verificam preservação. Uma única
  head confirmada; migration ainda não aplicada em produção nem testada em PostgreSQL vivo.
- 197 testes backend, cobertura 85,89%; lint/format; 92 E2E Chromium/Firefox; 31 unitários admin,
  7 compartilhados; build/typecheck e diff check. Chrome emulado 390×844: política visível,
  sem opção automática, sem overflow e console sem erros/avisos. Nenhum provider pago chamado.
- CI 36800921810 ficou verde para `30a3ab4`, incluindo WebKit dos drawers. A nova alteração
  editorial depende do seu próprio CI. Sem merge/deploy desta etapa; aprovações históricas
  não foram revogadas nem reescritas. A jornada integral e demais critérios continuam pendentes.

## Continuação: sessão expirada, permissão e inicialização (#122–124)

- HTTP 401 preserva os editores montados, oculta/bloqueia a interface antiga e abre login com
  aviso de preservação nesta aba. A identidade ativa é verificada no backend antes da retomada;
  conta diferente é recusada. Escopo aleatório permanece estável, JWT atual fica em memória.
  Credencial inválida/stale bloqueia dispatch; nenhum POST/PUT é repetido automaticamente.
- HTTP 403 não encerra a sessão nem usa mocks. Recursos e texto-base mostram falta de permissão;
  a padronização dos demais feedbacks e a matriz completa por domínio continuam pendentes.
- Nesta fatia, retomada funciona com storage bloqueado; senhas e rascunhos não eram persistidos. Descarte
  explícito consulta o guard. Drawers móveis liberam foco/inert para o login e retomam seu ciclo
  de foco depois da autenticação. Não é recuperação após reload/crash nem proteção contra
  conflitos externos. Respostas concorrentes antigas ainda exigem matriz própria.
- Inicialização de registro bloqueia campos/submit até instalar o item selecionado. Uma falha
  intermitente do teste foi isolada: hash-only navigation ainda permitia digitar na tela anterior.
  O teste agora espera o registro de destino; teste separado usa documento novo e consulta lenta.
  Ambos passaram em cinco repetições Firefox (10 execuções), sem retries artificiais.
- 102 E2E Chromium/Firefox, 33 unitários admin, 9 shared, builds/typecheck admin/PWA e diff check
  passaram. O teste de idiomas agora confirma aba selecionada e conteúdo após cada edição;
  passou também em dez repetições Firefox. Sem lint próprio do admin; bundle Dashboard segue
  com aviso de tamanho, não tratado como redução de latência medida. Inspeção Chrome
  com toque emulado 390×844: login de retomada legível, foco no e-mail, sem overflow, draft
  preservado após login e console sem erros/avisos. Nenhum dado ou provider real alterado.
- CI 36801687024 passou para `3beddd4`, incluindo WebKit da correção editorial. Não é evidência
  desta nova recuperação de sessão. Novo CI/WebKit e gate de release ainda necessários;
  aparelhos físicos e leitores de tela não testados. Sem merge/deploy nesta continuação.

## Continuação: recuperação editorial local (#125) e tipos inativos (#126)

- `localDraftStore`/`useLocalDraft` separam ciclo de vida do domínio. A primeira migração cobre
  somente campos principais de autores, pontos e tipos de ponto. Chave inclui versão, identidade
  ativa verificada, entidade, registro e idioma PT. Schema valida campos editáveis antes de
  persistir/restaurar; não inclui credenciais, usuários, objetos de API inteiros ou jobs.
- Restauração nunca automática nem gravação no servidor. Antes da escolha, campos/submit ficam
  bloqueados e a base do servidor permanece visível. Base de campos diferente oferece aviso e
  "Restaurar mesmo assim"; não há merge remoto nem proteção transacional de concorrência.
  Depois da decisão, foco volta ao campo; status distingue cópia local de conteúdo guardado.
- Salvar, excluir item atual, descarte confirmado e logout removem a cópia desta conta.
  Cancelamento mantém a cópia. Falha de limpeza no logout é avisada na tela de login; quota,
  storage bloqueado, payload inválido/corrompido/legado e identidade divergente são tratados.
  Outras contas não recebem a oferta na UI e suas cópias não são apagadas pelo logout atual.
- Limite de 256 mil caracteres e validade de sete dias desde a última edição persistida.
  Ao acessar a chave, cópias expiradas são recusadas e removidas; não há promessa de apagamento físico
  sem reabrir o site. Conteúdo não é criptografado: isolamento de UI não protege acesso físico,
  DevTools ou XSS. Não usar esse mecanismo para senhas ou informação secreta.
- Regressores revelaram default literário inativo + limpeza de seleção causando ciclo de
  updates que apagava outros campos. Default agora exige ativo; associação inativa/indisponível
  continua visível até escolha explícita. Fixture corrige is_active omitido; cenário realmente
  inativo fica separado e verifica ausência do loop e edição após restauração.
- CI 36806963177 passou para `d416845`, incluindo WebKit, backend e frontend. Não prova esta
  nova persistência. 124 E2E Chromium/Firefox passaram; após endurecimento do envelope para
  rejeitar campos extras, 39 unitários admin e 12 E2E críticos foram repetidos e passaram.
  9 shared, build/typecheck admin e diff check passaram. Sem backend/migration novos nesta fatia.
- Inspeção Chrome emulado 390×844 em documento novo: oferta legível, campos/submit bloqueados
  até escolha, restauração explícita mantém conteúdo e foca o campo, sem overflow/overlay e
  console sem erros/avisos. O estado preservado por hot reload não substitui esse teste.
  E2E de autores cobre 390/1366, base remota alterada, conta distinta, cancelamento, limpeza e
  falha/quota; pontos/tipos cobrem reload e associação inativa. Sem disparos/dados reais.
  Novo CI/WebKit, dispositivos reais, leitores de tela, outros domínios, contrato final/backend
  isolado e release continuam pendentes. Não concluir reforma ou publicar a partir desta fatia.

## Continuação: texto-base e criação recuperável (#125)

- Texto-base e metadados passam a usar o contrato comum versionado, isolado por conta/item.
  Somente sete campos editáveis são permitidos. Oferta de recuperação bloqueia edição/gravação
  até restaurar ou descartar, sem POST/PUT automático. Após a escolha, foco volta ao formulário.
- `#/texts/new` abre criação diretamente e permanece recuperável após recarregar.
  Formulário novo vazio diz "Não guardado", não "Guardado". Fechamento/navegação usam o guard;
  gravação/exclusão bem-sucedidas removem a cópia base. Traduções continuam em memória nesta
  etapa: não prometer recuperação EN/FR após reload nem fechar a migração completa do domínio.
- CI 36808803142 passou para `4dc9f9e`, incluindo WebKit, antes desta nova fatia.
  132 E2E Chromium/Firefox, 40 unitários admin e build/typecheck passaram para a implementação
  de texto-base. Cenários de recuperação cobrem criação/edição em 390×844 e 1366×844;
  regressões existentes cobrem tabs, filtros, contexto, 401, 403 e falha de gravação.
- Chrome com toque emulado 390×844: nova criação/recuperação explícita, oferta legível,
  campos bloqueados até escolha, conteúdo restaurado, foco em Ponto, sem overflow/overlay
  nem erros/avisos no console. Dados locais sintéticos; nenhuma mutação de produção/provider.
- Aviso conhecido de tamanho do bundle continua. Sem lint próprio do admin. WebKit desta
  fatia depende do novo CI; Safari/iOS e Android físicos, leitores de tela e 200% de zoom
  não validados. Sem migration nova, merge ou deploy nesta etapa; objetivo integral continua aberto.

## Continuação: traduções recuperáveis e associações indisponíveis (#125, #127)

- Traduções de textos usam snapshot próprio de três campos (conteúdo, fonética, estado proposto),
  separado por identidade/texto/idioma. Baseline capturada na primeira edição ou na recuperação
  permanece independente do refetch. Versões limpas seguem o servidor, inclusive remoções remotas;
  nenhuma cópia fantasma nasce de uma versão limpa desatualizada.
- Restaurar mantém conteúdo em edição, sem guardar/rever/gerar automaticamente. PT/metadados
  e EN/FR têm ofertas identificadas e escolhas separadas; tradução fica bloqueada enquanto
  aguarda recuperação do texto-base. Foco retorna ao textarea após escolha da versão.
  Retornar a idioma já editado nesta aba mantém memória, sem oferecer nova recuperação.
- Guardar texto-base mantém cópias EN/FR; guardar/rever/gerar/remover versão limpa somente
  o idioma afetado. Descarte confirmado da edição limpa os idiomas do mesmo texto, não outra
  conta/registro. Exclusão do texto remove suas cópias de versões, com aviso se a limpeza falhar.
  Logout continua limpando o namespace desta conta. Quota não quebra edição nem promete cópia.
- Geração pede confirmação antes de substituir edição local. Estado local não é apresentado
  como publicação confirmada. Proteção concorrente remota, inventário dos demais caminhos
  editoriais e confirmação de substituição de versão aprovada ainda precisam de revisão.
- Teste de reload por idioma revelou apagamento automático de autor/ponto ausente nas opções:
  #127 registra causa, proposta e regressão. Associação atual permanece selecionada e identificada
  como indisponível; abrir tradução não altera metadados. Aprendizado incluído em AGENTS.md.
- 144 E2E Chromium/Firefox, 44 unitários admin, build/typecheck e diff check passaram. Novos
  cenários: 390×844/1366×844 para EN/FR/reload/salvar PT e versão; base remota alterada,
  cancelamento/aceite de descarte, confirmação de geração, quota, exclusão e ofertas simultâneas.
  401 valida cópia editorial separada da sessão/credenciais e preservação da EN ao guardar PT.
- Chrome com toque emulado 390×844: oferta identificada/legível com rolagem interna e ações
  alcançáveis, bloqueio até escolha, restauração/foco no textarea, sem overflow/overlay/console
  errors ou warnings. Dados locais sintéticos, sem provider ou mutação de produção.
- CI 36809808792 passou para `0b40a6f`, incluindo e2e/WebKit. Esta nova fatia precisa do próprio
  CI. Bundle grande e ausência de lint específico admin continuam. Aparelhos reais/leitores
  de tela/zoom e jornada integral/backend isolado, demais domínios e release ainda pendentes.
  Sem migration, merge ou deploy nesta continuação; não declarar a reforma concluída.
