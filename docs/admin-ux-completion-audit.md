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
| Falha ao salvar preserva trabalho, sem sucesso prematuro | Cobertura parcial; inventário por domínio e erros 401/403/409/422/5xx pendentes |
| Rascunhos por entidade/idioma não são substituídos por refetch | Textos/pontos/waypoints têm proteções; matriz completa e controlador comum pendentes |
| Recuperação local versionada, identidade, storage indisponível e logout | Waypoints têm recuperação; política e cobertura dos demais editores pendentes |
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
