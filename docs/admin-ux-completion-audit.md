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
| Salvar, aprovar, gerar e publicar são ações distintas | Aprovação automática removida de Textos/API/worker (#121); publicação de percursos separada do save com confirmação e prontidão revalidada (#138). Regressões cobrem revisão humana e preservação de mídia/conteúdo. CI/release e inventário dos demais caminhos pendentes |
| Estados carregando/vazio/filtro/erro inicial/refetch consistentes | Textos cobertos; autores/pontos em implementação. Inventário dos demais painéis pendente |
| Falha ao salvar preserva trabalho, sem sucesso prematuro | 401 com retomada da mesma identidade/PT/EN e 403 sem logout cobertos nesta aba; inventário por domínio e matriz completa 409/422/5xx ainda pendentes |
| Rascunhos por entidade/idioma não são substituídos por refetch | Textos/pontos/waypoints têm proteções; matriz completa e controlador comum pendentes |
| Recuperação local versionada, identidade, storage indisponível e logout | Campos principais de autores/pontos/tipos, texto-base, traduções de textos/pontos, metadados EN, pontes EN e narrativa/waypoints de percursos têm contrato versionado comum, restauração explícita, aviso de base alterada e limpeza desta conta. Identidade preservada pela API (#133); demais editores e matriz integral de transições ainda precisam de trabalho |
| Bloqueios editoriais abrem ações resolutivas | Painel agregado e destinos por item/idioma/etapa implementados (#140); inventário integral dos bloqueios e jornada real ainda necessários |
| Jornada real CSV → revisão → áudio → percurso PT/EN → publicação | Mocks não bastam; fixture/backend isolado e teste contratual completos pendentes |
| Lotes: preview, escopo, parcial, histórico, falhas e revisão exata | Capacidades existentes; auditoria da jornada e contexto/estado persistente pendentes |
| Áudio manual protegido; geração não aprova tradução | Regressões existentes; incluir na jornada contratual final |
| Shell/auth e domínios separados com contratos de cache/draft | Boot/auth/shell e lifecycle comum; AuthorsPanel/PointsPanel/PointTypesPanel agora compõem domínios sem caminhos mortos de textos (#142). Divisão de textos/percursos e controlador comum restante pendentes |
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

## Continuação: traduções de pontos e bloqueio entre operações (#128, #129)

- Título/descrição/estado proposto usam snapshot validado por conta/ponto/idioma; baseline
  capturada na primeira edição/restauração não é atualizada por refetch. Oferece recuperação
  explícita, compara base remota e devolve foco ao título, sem request de gravação/revisão.
  Estados distinguem versão guardada, ainda não guardada e alterações locais. Campo deixou
  de dizer "Publicação" para não confundir proposta local com estado confirmado.
- Guardar ponto-base preserva EN/FR; guardar/gerar/remover versão limpa apenas seu idioma.
  Descarte confirmado remove os idiomas da edição; apagar ponto remove suas cópias base e
  de traduções, preservando outras contas/itens e avisando falha de limpeza. Quota mantém
  edição sem prometer recuperação. Rascunho em memória prevalece ao retornar a idioma já editado.
- Falha de consulta não vira coleção vazia editável; retry explícito, dados antigos identificados
  e mensagem de ação com draft preservado. 401 suspende sessão, 403 usa falta de permissão.
  Remount por ponto evita persistir campos do item anterior sob o ID novo durante navegação.
- #129: submit principal e ações/abas de tradução consultam guard de busy antes de iniciar
  segunda operação. Testes verificam ambos os sentidos e zero requests concorrentes;
  não é controle transacional contra outro administrador ou resposta externa concorrente.
- 154 E2E Chromium/Firefox passaram na suíte completa; após acrescentar dois regressores,
  quatro execuções adicionais passaram (bloqueio ponto→tradução e 401 sem replay automático).
  Após manter estilo visual de falha no feedback, seis regressores críticos foram repetidos e passaram.
  45 unitários admin, build/typecheck e diff check verdes. Novos cenários EN/FR e save base
  em 390×844/1366×844; remoto alterado, cancelamento/descarte, quota, exclusão, foco e geração.
  Teste de textarea usa nome acessível/role: texto do controle não deve contaminar lookup do label.
- Chrome com toque emulado 390×844: screenshot da oferta legível/ações alcançáveis, restauração
  e foco no input, sem overflow/overlay/erros de app. Houve um aviso do Chrome sobre fallback
  WebGL em software do ambiente; não habilitado flag de menor segurança nem alegado GPU real.
  Nenhum GPS real, provider de geração ou dado de produção alterado.
- CI 36811103239 passou para `04b2ac3`, incluindo WebKit, antes desta fatia. Novo CI requerido.
  Demais domínios, concorrência remota, save-and-exit, pendências, jornada integral/backend
  isolado e release continuam pendentes. Lint próprio admin, bundle/zoom/leitores/aparelhos reais
  ainda não concluídos. Sem migration, merge ou deploy; objetivo integral continua aberto.

## Continuação: metadados EN de percursos (#130)

- Dois regressores falharam no código anterior por ausência de cópia local (390/1366 px).
  Teste anterior verificava somente revisão bem-sucedida/readiness, não recuperação após reload.
  Snapshot mínimo contém título/descrição, sem estado aprovado/revisor; identidade/percurso/EN
  isolados, baseline independente do refetch e comparação remota. Oferta bloqueia campos até
  escolha, restauração devolve foco e não grava/aprova. Revisão exige clique explícito existente.
- Sucesso remove a cópia; descarte confirmado limpa somente esta conta/registro. Cancelamento,
  falha 503 e falta de permissão preservam edição. Quota avisa sem prometer recuperação;
  consulta inicial falha bloqueia revisão e oferece retry; refetch falho identifica dados antigos.
  Handler 401 integrado ao contrato de suspensão; regressão específica de retomada destes
  metadados ainda não executada (outros domínios têm cobertura própria).
- Ações de percurso/metadados/recálculo/ponte consultam guard global. Teste filho→pai conta zero
  segunda request; pai→filho confirma fieldset já bloqueado até resposta. Não é exclusão mútua
  remota. Narrativa/waypoints continuam com contrato anterior e pontes ainda não recuperam EN.
- 172 E2E completos Chromium/Firefox passaram, 46 unitários admin, 9 shared e build/typecheck;
  diff check verde. Recuperação em 390×844/1366×844, base alterada, 403, quota, retry, cancelamento,
  descarte por conta e operação aninhada. Teste inicial do bloqueio reverso foi corrigido para
  observar controles desabilitados, não tentar clicar em botão já protegido pelo fieldset.
- Chrome DevTools com toque emulado 390×844: screenshot legível, ações alcançáveis, restauração
  explícita/foco no título, sem overflow/overlay/erros da aplicação. Um aviso de fallback WebGL
  em software do Chrome; sem alterar flags de segurança. Dados sintéticos e nenhuma mutação
  de produção/provider. Sem prova de GPU, sensor ou dispositivo real.
- CI 36813492098 passou para c3c86fd incluindo e2e; este novo head requer CI próprio. Bundle
  grande/ausência de lint próprio, WebKit desta fatia, aparelhos físicos/leitores/zoom e jornada
  contratual integral permanecem pendentes. Sem backend/migration, merge ou deploy nesta etapa.

## Continuação: upload manual de áudio de ponte (#131)

- Dois testes falharam antes da correção (390/1366): upload pendente deixava controles ativos.
  Função async não participava de busy/guard; testes antigos cobriam geração, não upload.
  Agora mutação captura percurso/segmento/idioma, bloqueia edição/navegação/troca de etapa e
  pede confirmação de substituição do áudio existente com idioma/ponte explícitos.
- Envio não aparece como Guardado: status global e feedback junto ao seletor indicam operação
  em andamento. Falha preserva áudio anterior e oferece escolher o ficheiro novamente; seletor
  é limpo para permitir mesmo arquivo. Sucesso marca manual protegido e atualiza a prévia
  do segmento-alvo. Não persiste o File, não repete upload após reautenticação.
- 178 E2E completos Chromium/Firefox passaram; após feedback local/ajuste de status,
  12 críticos foram repetidos, depois seis de upload após ajuste de narrowing TypeScript.
  46 unitários admin e build/typecheck/diff check passaram. Recuperação de metadados anterior
  teve CI 36815539131 verde; novo commit requer seu próprio CI/WebKit.
- Cancelamento envia zero requests; upload pendente bloqueia navegação e outros controles;
  falha mantém áudio anterior; mesma fixture após falha gera nova request somente por seleção
  humana e sucesso atualiza URL de prévia/manual. Arquivos sintéticos e respostas isoladas,
  sem provider, gravação real, comprovação de codec, file picker nativo ou sensor.
- Chrome com toque emulado 390×844: screenshot do aviso local legível, controles bloqueados,
  sem overflow/overlay. Documento novo confirmou falha local e desbloqueio; HMR/mocks não
  substituem essa inspeção. Um aviso do ambiente de fallback WebGL em software, sem erros de
  app ou alteração de flags de segurança. Confirmação cancelável coberta no E2E, não no picker real.
- Ainda pendentes: rascunhos EN das pontes, migração de narrativa/waypoints, revisão dos
  fingerprints que incluem estado remoto de áudio/tradução, matriz específica upload 401/403,
  estados 409/422, restante da jornada integral, dispositivos físicos e release final.
  Sem backend/migration, merge ou deploy. Esta fatia não conclui a reforma inteira.

## Continuação: recuperação de pontes EN (#132) e identidade das etapas (#133)

- Dois regressores falharam antes da implementação por ausência de cópia EN em 390/1366 px.
  Contrato comum guarda somente conteúdo (sem aprovação/revisor/áudio/token), isolado por
  conta/percurso/etapa/EN, com base anterior separada da referência remota. Restauração explícita
  bloqueia edição/revisão até escolha, compara base e devolve foco, sem request/approval.
- Revisão bem-sucedida limpa cópia da etapa; quota avisa sem prometer recuperação. Trocar de
  etapa ou navegar consulta guard; cancelamento mantém conteúdo e aceite limpa a etapa desta
  conta, não outra conta. Etapa nova precisa ser guardada na narrativa para ter ID persistido;
  a UI explica esse pré-requisito e não aceita EN que ficaria associada a um ID temporário.
- Guardar título/metadados PT mantém EN e sua cópia quando as etapas permanecem iguais.
  Teste unitário confirma que o fingerprint atual já exclui tradução/áudio remoto — não houve
  mudança de modelo para corrigir um problema inexistente. Recuperação não garante conservação
  de identidade quando o backend recria etapas: #133 precisa de reprodução contratual e fix.
- Primeiro teste de habilitação revelou que alterar ref após hidratar conteúdo vazio não
  causa renderização. Marcador em estado por percurso/etapa corrige versão inicialmente vazia;
  regressões passam sem esperar edição humana ou outra resposta para habilitar o campo.
- 186 E2E completos Chromium/Firefox, 48 unitários admin, build/typecheck e diff check verdes.
  Recuperação em 390×844/1366×844, guardar metadados PT preservando EN, base alterada, foco,
  zero writes antes da revisão, descarte cancelado/aceito e isolamento/quota. Regressões de áudio,
  contexto e refresh também passam. Base remota/refetch com EN suja, 401/403 específicos desta
  ponte, remoção de etapa com rascunho e restantes transições precisam de ampliação própria.
- Chrome 390×844 com toque emulado, documento novo/snapshot/screenshot: oferta legível,
  ações alcançáveis, restauração e foco no textarea, sem overflow/overlay/erro de app. Um aviso
  de fallback WebGL em software do ambiente; sem flags de menor segurança, provider ou dado real.
- CI 36816470430 passou para ae29a06 incluindo e2e; este novo head exige CI próprio. Sem backend
  alterado nesta fatia. Inspeção de update_route/relationships mostra exclusão e recriação de
  todas as etapas quando a sequência muda, com cascade delete-orphan de mídia/traduções.
  #133 registra risco/proposta/testes necessários; não publicar antes de resolver esse contrato.
  Narrativa/waypoints comuns, save-and-exit, pendências, jornada integral, aparelhos reais e
  demais critérios seguem pendentes. Sem migration, merge ou deploy; objetivo integral aberto.

## Continuação: identidade persistida das etapas (#133)

- Dois testes do backend reproduziram recriação da etapa e aceitação silenciosa de ID de
  outro percurso. Suite anterior não verificava conservação da etapa depois de edição/reorder;
  testes de tradução/áudio isolados não detectavam o delete-orphan de uma gravação narrativa.
- API aceita id UUID opcional por etapa, valida duplicados/pertencimento/kind/text antes de
  mudar metadados, preserva etapas retidas e remove somente as omitidas. Posições temporárias
  livres evitam colisão de unicidade durante reorder; caminhada muda para stale quando necessário.
  Mídia/tradução/revisor existentes não são reescritos nem aprovados de novo.
- Editor envia IDs persistidos e segment_identity_mode=preserve; local-* nunca é enviado.
  No modo explícito, etapa sem ID é nova mesmo se o conteúdo coincidir, permitindo substituir
  a sequência inteira. Fingerprint não conta atribuição de ID pelo servidor como edição.
  Clients antigos conservam sequência igual e matching exato não ambíguo; pedidos que perderiam
  mídia/revisão sem identidade retornam 409. Não é ETag nem prevenção de concorrência remota.
- 202 testes backend completos, cobertura 86,08%, lint/format verdes. Após usar posições livres
  sem subtrair do menor inteiro solicitado, nove regressores de identidade/caminhada repetidos.
  Cobertura: edição PT + inserção/reorder retém ID/revisão/manual; ID externo não muda título;
  duplicados rejeitados; reorder de pontes iguais/exclusão seletiva; legado inseguro 409;
  substituição total explícita funciona. Sem provider ou arquivos reais.
- 186 E2E Chromium/Firefox e 49 unitários admin verdes. Após modo explícito/assert de IDs,
  cinco E2E de criação/reorder/publicação e recuperação EN foram repetidos em 390/1366.
  Build/typecheck/diff check verdes; uma head 20261001_000024, sem migration nova.
  Esta alteração é de contrato/serialização, sem redesign ou nova evidência de dispositivo real.
- CI 36817635059 passou para df84306; novo head exige CI próprio. Backend testado em SQLite,
  PostgreSQL vivo e os demais casos de rollback/publicação/legado precisam de matriz ampliada
  antes de release. Conteúdo já perdido historicamente não foi recuperado nem fabricado.
  Demais itens da reforma, incluindo proteção de remoção com draft, narrativa/waypoints comuns,
  save-and-exit, pendências, jornada integral e dispositivos/release seguem abertos. Sem deploy.

## Continuação: remoção de etapa com EN local (#134)

- Três regressores falharam antes do fix: remoção da ponte selecionada apagava a etapa sem
  permitir cancelamento (390/1366 px); remoção de outra etapa propagava o clique ao cartão e
  disparava seleção/aviso indevido. Testes anteriores cobriam troca de etapa, não Remover.
- Handler específico consulta busy global sem descartar os outros editores, interrompe a
  propagação do clique e confirma somente a remoção da ponte selecionada com EN sujo/cópia
  por restaurar. Cancelamento conserva etapa/EN/cópia; aceite limpa apenas a cópia atual,
  preserva outras contas e seleciona uma etapa restante. Remover outra etapa mantém o EN ativo.
  Remoção continua local até Guardar percurso; não grava, aprova ou publica automaticamente.
- Dez E2E direcionados e 194 E2E completos Chromium/Firefox passaram; 49 unitários admin,
  nove compartilhados, build/typecheck e diff check verdes. Novos casos em 390×844/1366×844
  cobrem cancelamento/aceite, zero writes, cópia por restaurar e isolamento. Sem backend alterado.
- Chrome DevTools local com toque emulado 390×844, DOM/interação/screenshot: cancelamento
  mantém etapa e textarea EN; oferta/campos legíveis e sem overflow/overlay. Console sem erro
  de aplicação; um aviso de fallback WebGL em software já presente no ambiente. Nenhum
  provider, sensor real ou conteúdo publicado usado. Skill de validação orientou a matriz;
  regra React manteve confirmação/limpeza no evento, sem effects novos.
- WebKit da nova revisão precisa do CI; Safari/iOS/Android reais, leitores de tela e zoom
  continuam não validados por esta fatia. Admin ainda não tem comando próprio de lint;
  build mantém aviso de chunk grande, pendência anterior de otimização. PostgreSQL/PostGIS,
  narrativa/waypoints comuns, salvar/sair, pendências, jornada integral e release seguem abertos.
  PR #117 ainda draft, sem merge/deploy. Esta correção não conclui a reforma inteira.

## Continuação: narrativa/waypoints no contrato comum (#135)

- Dois regressores de reload falharam no formato anterior (390/1366 px). Snapshot v2 guardava
  objetos de API, publicação/mídia/revisão e não participava da limpeza comum no logout.
  Teste anterior apenas aceitava o confirm imediato e verificava um waypoint restaurado.
- Novo snapshot guarda metadados PT editáveis, IDs/kind/text_id/conteúdo PT ordenados e
  coordenadas/posições dos waypoints; schema estrito, namespace/TTL/quota do contrato comum.
  Sem publicação, objetos de texto, áudio, revisão, credenciais ou identidade de revisores.
  Restauração explícita recompõe mídia/textos atuais por ID e mantém publicação do servidor.
  Oferta bloqueia campos/escritas até escolha, compara base remota e devolve foco ao título.
- Save da narrativa atualiza apenas sua base, conservando waypoint por recalcular; recálculo
  atualiza base de waypoints. Falha não promete recuperação se storage falhou. Guard/descarte
  limpam só conta/percurso atual; logout também limpa chaves v2 desta conta, sem capturar
  conta cujo nome compartilha prefixo. Fonte antiga também é limpa após save confirmado,
  para não reaparecer quando já existe uma cópia comum mais recente.
- Conversão sanitiza v2 sem recuperar publicação/mídia. Um marcador literal de origem
  `legacyBaselineUnknown` conserva o aviso até a escolha mesmo após novo reload: data é de
  conversão, não edição histórica; a base anterior era desconhecida. Fonte é removida após
  escrita válida; falha/quota/legado inválido preservam fonte e avisam, não restauram silenciosamente.
- 225 E2E passaram: admin Chromium/Firefox completos e site público Chromium, incluindo
  fixture compartilhada. 53 unitários admin, nove shared, build/typecheck e diff check verdes.
  Casos novos: 390×844/1366×844, reload/foco, base remota alterada sem write automático,
  cancelamento/descarte/isolamento, falha503, quota/conversão, legado com novo reload e save
  parcial. Ajustada fixture que omitia text_id fornecido pela API; schema não foi afrouxado.
  Primeira suíte ampliada teve dois failures por esperar aviso genérico em vez do aviso de
  conversão; expectativa corrigida e suíte inteira repetida. Sem mudança de backend/banco.
- Chrome DevTools local/toque390×844: oferta legível/screenshot, campos bloqueados, restauração
  da narrativa e foco no título, sem overflow/overlay/erro de app; aviso WebGL de software
  do ambiente. Skill de validação orientou matriz; regra React de storage mínimo orientou schema.
  Nenhum provider, sensor real ou dado publicado alterado. Build mantém chunk grande e
  admin ainda sem lint próprio: pendências conhecidas, não checks concluídos.
- CI 36820021172 passou para 9e975ff incluindo WebKit; esta nova revisão requer CI próprio.
  Save-and-exit, pendências, divisão funcional restante, jornada backend real/PostgreSQL,
  matriz de erros por domínio, zoom/leitores/aparelhos reais e release continuam pendentes.
  PR #117 segue draft; sem merge/deploy. Objetivo integral continua aberto.

## Continuação: base de Guardar e sair nos recursos (#136, parcial)

- Guard existente tinha somente confirm de cancelamento/descarte. Introduzido diálogo comum
  com Continuar a editar, Guardar e sair quando todas as edições sujas registram save seguro,
  e Descartar. Primeira integração: botão Limpar de autores/pontos/tipos; demais navegações
  continuam com o guard anterior e precisam ser migradas. Não declarar contrato integral pronto.
- Registry guarda callbacks em memória, não credenciais/storage. Callbacks de save são
  capturados antes da execução sequencial; saída só após sucesso, sem transação conjunta
  ou replay automático. Falha mantém diálogo/editor e permite escolha humana posterior.
  Traduções/cópias por restaurar não registram save implícito: não aprovar, gerar ou publicar
  pelo botão de saída. Descarta apenas callbacks da edição atual; contas alheias preservadas.
- Modal nativo bloqueia exterior; contenção Tab/Shift+Tab explícita foi necessária: quatro
  testes falharam no wrap nativo antes do fix. Escape cancela sem writes, devolve foco ao
  invocador e não fecha enquanto saving. Suspensão401 fecha modalidade para liberar login;
  mesma identidade retoma diálogo/erro/draft sem repetir request. Não grava na retomada.
- Doze E2E críticos passaram, depois 220 E2E completos admin Chromium/Firefox; 53 unitários
  admin, nove shared, build/typecheck/diff check verdes. Novos casos em 360×600/1366×600
  cobrem foco/wrap/bounds, cancelamento, espera do servidor, falha503,401, zero replay,
  tradução de ponto sem aprovação e descarte por conta. Depois acrescidos dois cenários de
  save de ponto/tipo: doze execuções adicionais (três repetições, dois navegadores) passaram.
  Primeiro lookup do tipo estava errado; corrigido para Nome em português. Teste passou a
  esperar o valor do registro de destino antes de digitar, conforme o contrato de hidratação.
- Chrome DevTools local/toque390×844: screenshot das três escolhas legível, campos externos
  fora da árvore acessível modal, falha503 simulada mantém editor/diálogo e URL; sem overflow,
  overlay ou erro/aviso de console. Nenhum provider, dispositivo/sensor real ou dado publicado
  alterado. Skill de validação orientou teclado/matriz; React manteve gravação no evento.
- CI 36821916669 passou para 083a277 incluindo WebKit; novo head requer CI próprio. Menu,
  item, histórico, logout, drawers e outros domínios ainda não usam este diálogo. Rename do
  botão Limpar e avisos específicos de validação também devem ser revistos na integração.
  Pendências agregadas, backend real/PostgreSQL, divisão restante, zoom/leitores/aparelhos
  reais e release seguem abertos. Admin sem lint próprio/chunk grande ainda pendentes.
  Sem backend/migration, merge ou deploy; #136 permanece aberto até ampliar o contrato.

## Continuação: navegação comum e preservação do histórico (#136 parcial, #137)

- Menu, seleção de registro por URL, histórico, logout, destinos de CSV/lotes e fechamento
  dos recursos usam um único pedido de saída. Textos também usa o diálogo no fechamento,
  criação e abertura de lote. Destino capturado não muda enquanto a escolha está aberta;
  ações e seleção só seguem depois do aceite. Limpar passa a chamar-se Fechar edição.
- Confirmado bug #137 em Chromium/Firefox: cancelar Voltar substituía a entrada anterior,
  e o segundo Voltar pulava de Autores para Pontos. Entradas internas agora têm posição;
  cancelamento retorna à entrada original, e aceite segue ao destino capturado. Cobre
  Avançar cancelado repetidamente, além de Voltar cancelado seguido de Guardar e sair.
- Host comum permanece na suspensão401 e libera login; logout limpa callback pendente.
  Drawer móvel cede modalidade/foco ao diálogo. Cancelar conserva campo e foco; fechamento
  real restaura invocador/busca depois do inert e remoção, sem tratar cleanup de StrictMode
  como saída. Testes revelaram disputa de foco e restauração prematura; corrigidas sem
  enfraquecer as expectativas de teclado. Confirms destrutivos/editoriais continuam explícitos.
- Save-and-exit continua somente para todos os editores com save seguro registrado:
  autores/pontos/tipos base. Textos/traduções/percursos/usuários ainda não ganham gravação
  implícita, aprovação, publicação ou geração. #136 permanece aberto para domínios e ações
  restantes, mensagens de validação e cobertura integral. beforeunload segue aviso nativo.
- Evidência final de suíte/build/QA e revisão consta no PR #117. Sem backend/migration,
  merge ou deploy nesta etapa. Pendências agregadas, divisão funcional restante, jornada
  real/PostgreSQL, zoom/leitores/aparelhos reais e release continuam na auditoria; admin
  sem lint próprio e chunk grande permanecem pendentes. CI anterior 36823661664 passou,
  inclusive WebKit, para 962a934; esta revisão requer checks próprios.
- 234 E2E completos Chromium/Firefox passaram; 24 execuções repetidas de foco mobile/
  desktop passaram após a correção. 53 unitários admin, nove shared e build/typecheck/diff
  check verdes. Matriz inclui 360×600, 390×844, 820/821/819×844 e 1366×600/844, com
  teclado, espera, cancelamento, histórico, falhas503/401 e ausência de aprovação implícita.
  Chrome local/toque390×844: três escolhas, erro preservado, URL intacta, sem overflow,
  overlay ou console error/warn. QA visual identificou erro claro sobre fundo claro; cor
  corrigida no diálogo e coberta por teste. Nenhum provider ou dado publicado alterado.
  Skills orientaram matriz/foco e ações somente no evento, sem replay em effects.
- Após o ajuste apenas de contraste, 14 E2E direcionados e build/diff check passaram;
  contraste medido do erro sobre o fundo: 6,29:1. Screenshot final mantém aviso legível.

## Continuação: gravação segura de textos/narrativa e publicação separada (#136 parcial, #138)

- Guardar e sair grava somente o texto-base ou a narrativa PT pelo endpoint editorial.
  Traduções por rever, cópias por restaurar e waypoints por recalcular não permitem save
  implícito. Save de percurso novo envia não publicado; percurso existente preserva a
  visibilidade carregada do servidor. Isso não é controle de concorrência entre admins.
- Confirmada ambiguidade #138: checkbox Publicar fazia parte de Guardar percurso e o E2E
  antigo legitimava esse acoplamento. Ação própria confirmada envia apenas is_published;
  backend exige autenticação, recusa campos extras e revalida idiomas/caminhada ao publicar.
  Retirar de publicação não exige prontidão. Nenhuma reescrita de segmentos/traduções/áudio.
  Dois testes de contrato falharam404 antes da implementação; agora há regressões de
  prontidão409, autenticação401, validação422, inexistência404 e preservação integral.
- Testes de saída cobrem criação/edição de texto em390×844/1366×844, resposta pendente,
  falha503, EN sujo sem aprovação e narrativa nova/existente publicada. Sessão401 retoma
  rascunho/diálogo sem replay; nova gravação só ocorre por ação explícita. Cancelar publicação
  envia zero requests; resposta409 preserva visibilidade e retry é explícito.
- Backend completo:205 testes, cobertura86,13%, lint/format verdes;54 unitários admin,
  nove shared e build/typecheck verdes.24 execuções repetidas de criação/publicado/401/
  waypoints passaram. Suite completa após o ajuste de foco abaixo:258 E2E Chromium/Firefox
  passaram, com casos antigos de drawers, sessões, idiomas, áudio, lotes e recuperação.
- Chrome local/toque emulado390×844: escolhas de saída e cartão de publicação legíveis,
  documento390px sem overflow; cancelar mantém edição. Sem erro de app; aviso WebGL de
  renderização por software do ambiente. Dados sintéticos, sem sensor/provider/conteúdo real.
  Skill de validação orientou a matriz; regras React mantêm mutações em ações explícitas.
- Sem migration nesta fatia, merge ou deploy. CI36825880431 passou para e6e21f4; o novo
  head exige CI/WebKit próprios. #136 fica aberto para demais editores e transições.
  PostgreSQL/PostGIS, jornada editorial real, aparelhos físicos/leitores/zoom, pendências
  agregadas, decomposição dos domínios e demais critérios integrais continuam necessários.

## Continuação: foco inicial não interrompe a primeira digitação (#139)

- A suite completa encontrou duas falhas Firefox360/1366: o requestAnimationFrame de
  abertura movia o foco ao título quando a pessoa já digitava no campo Nome. Trace mostrou
  fill seguido do valor original antes de fechar, permitindo saída sem diálogo.
- Inicialização agora verifica conexão e foco dentro do editor antes de mover/rolar.
  Regressor determinístico segura o frame inicial até depois da primeira digitação:
  falhou por perda de foco em Chromium e Firefox antes da correção, sem afrouxar assertions.
- Dezoito execuções repetidas passaram após a correção (regressor + saída/cancelamento em
  360×600/1366×600, três repetições em dois navegadores). Suite completa final:258 passaram.

## Continuação: pendências editoriais e ações desobstruídas (#140, #141)

- Área Pendências reúne traduções por rever, bloqueios de percursos por idioma, erros de
  itens de lotes e cópias locais válidas desta conta. Destinos abrem texto/ponto/etapa no
  idioma correto; consulta e abertura não gravam, aprovam, publicam ou geram conteúdo.
- Endpoint autenticado agregado reutiliza exatamente a prontidão da publicação. Teste
  compara o contrato com a consulta individual e limita a 11 queries com 1/16 percursos
  em sessões novas. Sem schema/migration ou chamadas a providers.
- Fontes independentes mostram carregamento, permissão403, erro503, retry e dados antigos
  após refetch falho. Storage bloqueado não significa ausência de cópias. Inventário local
  reutiliza validadores/TTL e não modifica nem remove entradas de qualquer conta.
- Suíte completa revelou bandeja flutuante cobrindo Abrir rascunho em Chromium/Firefox.
  Bandeja agora fica no fluxo da página; cliques normais preservados nos testes. Doze
  execuções repetidas em 360×600/1366×600 passaram após o ajuste.
- Verificação final:280 E2E Chromium/Firefox,58 unitários admin,nove shared,208 backend
  com cobertura86,18%, build/typecheck, lint/formatação backend e diff check. Admin não tem
  lint próprio; chunk Dashboard grande continua pendente. Imports .ts dos helpers puros
  usam allowImportingTsExtensions com noEmit, compatíveis com o runner Node e typecheck.
- QA Chrome local com dados sintéticos:390×844/toque e1366×768, destinos e idioma corretos,
  sem overflow; desktop com ações44px e console sem error/warn. Não valida sensor real,
  screen reader, zoom200%, Safari/iOS físico nem jornada com backend/PostGIS real.
- Sem merge/deploy nesta etapa. WebKit desta revisão depende do CI atualizado. Decomposição
  dos domínios, jornada editorial real, matriz integral e release permanecem necessários;
  painel não cobre falha global de lote sem item ou todos os tipos de tarefas futuras.

## Continuação: composição de autores/pontos/tipos (#142)

- Autores tem campos próprios; pontos é dono de queries de tipos/idiomas, filtros, default
  ativo, traduções e limpeza local; tipos tem composição explícita. ResourcePanel mantém
  somente lifecycle/lista/save/recuperação/guard das três entidades, sem legado de textos.
  Componentes dos campos e traduções têm tipos/keys estáveis, sem remount por digitação.
- Payloads, cache e namespaces preservados. Não é nova arquitetura de estado nem prova de
  redução de latência. Decomposição de Textos/RouteEditor e controlador restante pendentes.
- 59 unitários admin, nove shared e build/typecheck/diff check passaram. 280 regressões
  Chromium/Firefox passaram nas duas suítes completas; quatro novos testes inicialmente
  falharam por locator de select e assert que confundia tradução de ponto com a coleção
  de traduções de textos. Corrigidos com nome acessível e escopo exato de endpoint, mantendo
  contagem de uma consulta própria. Doze execuções finais (três repetições em360×600 e
  1366×600, Chromium/Firefox) passaram após esses ajustes somente do teste. A suíte com
  todos os284 casos em uma única execução fica para o CI do novo head; não declarar as
  duas execuções locais com falha no teste novo como suítes verdes.
- QA Chrome local390×844/toque: editar autor → tentar Pontos → cancelar conserva valor e
  URL. Desktop1366×768: abrir ponto e editar título conserva editor/valor, sem overflow.
  Screenshots em /tmp, dados sintéticos. Fixture visual de mapa corrigida (style JSON antes
  inválido); console final sem erro de app, aviso de software WebGL do ambiente. Mapa sem
  tiles sintéticos não comprova geocodificação/GPS/tiles reais. Troca para emulação mobile
  provocou reload/beforeunload; espera do tooling expirou, mas o diálogo foi aceito depois.
  Snapshot confirmou recuperação explícita; Restaurar trouxe o título editado em390×844,
  documento390px sem overflow. Isso é evidência de reload/recuperação, não resize sem reload.
- CI36831182254 passou para fb7cc1b, incluindo WebKit da etapa de pendências, não deste
  refactor. Sem backend/migration/merge/deploy; novo head exige checks próprios. Admin sem
  lint próprio/chunk grande, jornada real/PostGIS, zoom/leitores/aparelhos e release pendentes.
