# Plano incremental de refatoração do administrativo

## Objetivo e limites

Permitir que um administrador complete uma tarefa editorial sem perder trabalho, sem confundir gravação com publicação e sem precisar conhecer a estrutura do banco. A refatoração deve preservar contratos, IDs, dados, revisões humanas e regras de áudio existentes.

Este documento preserva o plano incremental e registra a primeira etapa aplicada abaixo. As evidências do planejamento usam o código derivado de `production` em 30/09/2026, antes das correções. Não houve medição acompanhada com administradores nem alteração de dados reais.

Use a stack atual: React 19, Vite, TanStack Query, cliente e tipos compartilhados e MapLibre. Não há razão demonstrada para substituir framework, estado remoto ou biblioteca de mapa. Bibliotecas novas, mudança de identidade visual, RBAC, SSO e remodelagem do banco são decisões separadas, sujeitas a justificativa e aprovação.

## Evidências do código antes da primeira etapa

- `admin/src/main.tsx`: combina autenticação, shell, navegação por `useState` e um editor genérico; mudar seção desmonta o editor. Sem endereço persistente por item, voltar ou compartilhar contexto exige reconstruir a seleção.
- `admin/src/routes/RouteEditor.tsx`: concentra lista, edição narrativa, pontes, waypoints, tradução, recálculo, prévia e prontidão. `dirty` originalmente depende do fingerprint do `RouteDraft`, enquanto `legWaypoints` fica separado. Effects de sincronização podem repor valores quando o cache é atualizado.
- `admin/src/points/PointTranslationsEditor.tsx`: originalmente mantém uma tradução ativa em estados soltos, repostos ao trocar idioma; precisa de rascunhos por entidade e idioma.
- `admin/src/textVersionDrafts.ts`: já contém regra útil para não substituir tradução local suja por refetch. Deve ser generalizada com cuidado, não descartada.
- `admin/src/texts/TextsPanel.tsx`: concentra sete fontes remotas, filtros, seleção, fila de revisão e diferentes drawers. A composição é especializada e tem regras editoriais que um CRUD universal não deve ocultar.
- `admin/src/adminCache.ts`, `CsvPanel.tsx` e `BatchJobTray.tsx`: atualização/invalidação do cache espalhada entre telas; jobs fazem polling de lista a cada 1,5 segundo, inclusive com resposta contendo histórico. Otimização exige primeiro medir, mas já convém centralizar contratos e invalidadores.
- `admin/src/users/UsersPanel.tsx`: referência de separação entre composição visual e regras puras em `userModel.ts`, com confirmação explícita por email e segurança mantida no backend.
- `admin/src/styles.css`: possui boas regras mobile, mas tabelas com largura mínima de 760/980px e editor lateral de dois painéis. A composição intermediária entre 821–1280px precisa de teste próprio, não apenas celular/desktop.
- `e2e/admin-route.spec.ts`: a fixture retorna prontidão sempre positiva. Testar publicação desse modo não garante que a pessoa consiga resolver as pendências reais.
- `docs/lisboa_spec_geral.md`: geração, aprovação e áudio são etapas separadas; tradução automática nunca é aprovada automaticamente; importação preserva origem; áudio manual não pode ser substituído por lote automático.

## Prioridade zero: corrigir confiança antes de refatorar

As correções autorizadas agora devem continuar pequenas, com issues e regressões específicas:

1. Recuperar o Mapa de revisão sem recuperar indiscriminadamente uma branch legada.
2. Dar caminho completo para editar/aprovar metadados traduzidos de percursos e resolver bloqueios de publicação.
3. Incluir waypoints no estado alterado e na recuperação local; proteger traduções por idioma e edições de autores contra navegação destrutiva.
4. Mostrar erros de consultas/mutações, mantendo rascunhos e oferecendo nova tentativa; nunca converter HTTP 500 em lista vazia.
5. Separar credencial incorreta de serviço indisponível. Recuperação de senha por email deve ser uma entrega própria com revisão de segurança e configuração do envio, não um botão decorativo.

Esses consertos não dependem de uma nova organização visual. Não ampliar a entrega imediata para um redesign total.

## Jornada desejada e organização da informação

Hipótese inicial a validar com administradores: as tarefas mais recorrentes são localizar conteúdo, corrigir/revisar, preparar idiomas e áudio e verificar publicação. A navegação deve privilegiar essas tarefas, preservando acesso explícito às entidades.

| Área | Conteúdo | Tarefa principal |
| --- | --- | --- |
| Pendências | Revisões, bloqueios de percursos, falhas de lotes, rascunhos locais | Saber o que fazer agora e abrir o item exato |
| Conteúdo | Pontos, textos, autores | Encontrar e editar conteúdo; ver relações sem sair do contexto |
| Percursos | Lista e editor narrativo | Montar, validar, pré-visualizar e publicar |
| Mapa de revisão | Revisão geográfica e editorial | Localizar erros espaciais e abrir a edição correspondente |
| Importação e lotes | CSV, progresso, histórico e falhas | Preview, confirmar escopo e acompanhar resultado |
| Configuração | Tipos de ponto, pronúncias, usuários; idiomas/vozes apenas onde houver UI/contrato implementados | Administração menos frequente |

Não criar um dashboard ornamental. A tela inicial pode começar como lista de pendências em componentes existentes, sem endpoint agregado novo. Não inventar campos faltantes ou indicadores de completude a partir de ausência de resposta.

Cada tela de item deve mostrar identidade, relações, estado por idioma, última gravação conhecida, proveniência disponível e ações relevantes. Mostrar somente auditoria realmente registrada; conteúdo antigo não tem histórico retroativo fabricado.

Endereços por seção/item/idioma/filtro, por exemplo hash routes `/texts/{id}?lang=en` em uma primeira versão compatível com Vite. URL nunca contém token, senha ou corpo de rascunho. O guard deve tratar menu, troca de item, histórico do navegador, fechamento de drawer e sair; `beforeunload` é uma proteção adicional, não a única.

## Contrato uniforme dos editores

### Gravação e rascunhos

- Estados explícitos: sem alterações, alterações locais, a guardar, guardado no servidor, falha ao guardar, conflito. Texto e ícone, não só cor.
- Separar **Guardar** de **Aprovar**, **Gerar** e **Publicar**. Não chamar rascunho local de “Guardado”. Não usar autosave remoto para aprovação/publicação.
- Rascunho identificado por usuário/entidade/ID/idioma/versão de esquema; waypoint, pontes e metadados contam no mesmo contrato de alterações, ainda que sejam gravados por endpoints distintos.
- Nunca substituir um draft sujo com refetch, troca de idioma ou resultado de outra mutação. Atualizar a referência remota separadamente; sinalizar alterações remotas quando detectáveis.
- Persistência local com tratamento de storage indisponível/quota. Excluir senhas e tokens dos rascunhos. Informar que recuperação local é naquele navegador e não colaborativa.
- Ao sair: **Continuar a editar**, **Guardar e sair** quando aplicável e **Descartar alterações**. Só executar a navegação após sucesso de gravação; não disparar request destrutivo no botão de cancelar.
- Na volta, comparar versão/base remota e oferecer restauração; não aplicar rascunho antigo silenciosamente. Logout explícito e máquinas compartilhadas exigem política de limpeza ou opção de apagar rascunhos; reautenticação recupera apenas rascunhos da mesma identidade.
- Não prometer prevenção de sobrescrita entre administradores apenas com guard local. Escrita concorrente precisa de versão/ETag/`updated_at` verificado no backend; avaliar isso numa fase própria.

### Estados de consulta e erros

- Componente comum para carregamento, sucesso vazio, filtro sem resultado, falha inicial e dados antigos com falha de atualização.
- Erro junto da ação afetada, descrição em linguagem editorial, sem expor stacktrace/secrets, com retry seguro e rascunho preservado.
- HTTP 401: pedir reautenticação e preservar trabalho da identidade; 403: acesso não permitido, sem confundir automaticamente com senha expirada; 409: conflito ou bloqueio editorial explicado; 422: vincular erro a campo; 5xx/rede: indisponibilidade.
- Uma tentativa de salvar não deve aparecer como sucesso antes da confirmação do backend. Bloquear clique duplicado durante a mutação; retry de lote/cobrança só quando o contrato assegurar idempotência ou permitir conferir o job existente.

### Tradução, áudio e publicação

- Coluna por idioma com estados de tradução e áudio separados. Revisão mostra original e tradução lado a lado no desktop e alternância com contexto no mobile.
- Próxima pendência abre o campo/idioma correto, não apenas a entidade. “Traduzir metadados do percurso” deve levar ao editor desses metadados; “gerar áudio” só aparece como ação habilitada após aprovação.
- Geração automática explica origem e mantém `pending`. Aprovação é gesto humano separado. Substituição de conteúdo aprovado informa consequência e dependências, sem inventar invalidadores automáticos não contratados.
- Mostrar áudio manual ou automático, voz/proveniência disponíveis, play, substituir e remover. Lote preserva manual; substituição manual exige escopo claro.
- Publicação apresenta checklist vindo do backend, com motivo acionável por bloqueio e prévia por idioma. Nunca inventar prontidão no cliente nem usar cache como autoridade definitiva.

### Importação e trabalhos em lote

- Quatro etapas legíveis: arquivo/modelo → preview → confirmação de escopo → resultado/progresso.
- Preview diferencia criar, atualizar, preservar, ignorar e inválido. Confirmar só envia após explicação do escopo; histórico inclui resultado parcial e acesso aos itens com falha.
- Job não desaparece ao trocar seção ou fechar bandeja; fechar aviso não cancela processamento. Tela de histórico permite revisitar trabalho encerrado, se o backend o fornecer.
- Aproveitar batches existentes. Ajustar polling conforme estado e visibilidade, sem criar SSE ou novo canal antes de verificar suporte e benefício. Trocar de seção não duplica workers nem disparos pagos.

## Mobile e acessibilidade

Desktop: lista e editor lateral quando a largura útil comportar ambos. Tablet/laptop estreito: abrir item em painel único ou drawer, sem impor dois painéis mínimos somados. Mobile: tarefa única por tela, botão voltar com proteção de rascunho, ação primária alcançável e resumo da seleção em lote.

- Mínimo de projeto a testar: 360px; desktop de baixa altura também conta. Barra de ações não pode cobrir campo com teclado aberto nem a bandeja de lote.
- Tabelas densas: preferir resumo/cartões ou colunas essenciais; quando rolagem horizontal for necessária, limitar ao contêiner e manter ações encontráveis.
- Drawer/modal tem nome acessível, foco inicial/restaurado, navegação por teclado e Escape conforme risco. Erros usam anúncio acessível sem movimentar foco inesperadamente.
- Tabs possuem semântica, controles de teclado e painel associado. Todo mapa tem alternativa por campos/lista; drag-and-drop mantém botões mover para cima/baixo.
- Verificar contraste, texto ampliado, texto longo e zoom 200%, alvos de toque projetados para 44px, labels, feedback não dependente de cor e estado desabilitado com justificativa.
- GPS e teclado virtual precisam de validação em Safari/iOS e Chrome/Android reais. WebKit Linux não equivale a iPhone.

## Decomposição técnica incremental

1. **Shell/auth/navigation**: extrair de `main.tsx`, mantendo o boot em um entrypoint. Sessão/contexto não transportam token em URL. Navegação passa por guard único.
2. **UI funcional comum**: `AsyncState`, `MutationFeedback`, `EditorFrame`, `SaveStatus`, `ConfirmAction`, `DraftNavigationGuard`, `LanguageTabs`. Introduzir só abstrações repetidas, com comportamento testável.
3. **Draft controller**: lógica pura para baseline, patches, dirty, merge remoto e serialização versionada; hook fino para React/storage/guard. O genérico organiza ciclo de vida, mas regras de autoria, pontes, áudio e publicação continuam nos domínios.
4. **Domínios**: extrair `AuthorsPanel` e `PointsPanel` do editor genérico; dividir percursos em lista, metadados/idiomas, segmentos, mapa/caminhada, prontidão e prévia. Em textos, separar consultas/modelo/lista/editor/fila/lotes. Evitar componentização só por número de linhas.
5. **API/cache**: fábrica de query keys e hooks por domínio; escopo de sessão explícito, limpeza no logout, invalidadores centralizados por mutação. Não reescrever todas as chaves em uma tacada nem manter dois caches de rascunho/remoto concorrentes.
6. **Performance**: buscar dados independentes em paralelo, habilitar consulta especializada quando necessária, evitar importar mapa/preview pesado no login. Medir bundle/render/rede antes de memoização generalizada. Paginação/consulta agregada é mudança contratual futura se volume justificar.
7. **CSS**: tokens para espaçamento, cores e estados; classes por componente/domínio gradualmente. Sem instalar um design system inteiro; preservar identidade e comportamentos até aceite visual.

## Fases, tamanho relativo e critérios de aceite

“Pequeno/médio/grande” descreve complexidade e risco, não prazo. Cada fatia termina em PR independente sobre `production`, com testes e revisão; sem merge ou deploy implícito pelo plano.

| Fase | Prioridade/tamanho | Resultado e critério de aceite |
| --- | --- | --- |
| 0. Estabilização autorizada | P0, médio | Bugs reproduzidos por testes antes/depois; nenhum rascunho perdido nas transições diagnosticadas; mapa e caminho de publicação recuperados; erros não parecem vazio |
| 1. Contratos comuns de edição | P1, médio | Primeiro autores e pontos, depois textos/percursos; mesma semântica de salvar/sair; storage bloqueado não quebra edição; refetch não apaga conteúdo local |
| 2. Shell e endereços | P1, médio | Entrar por URL abre item/idioma/filtro; voltar/avançar e trocar menu respeitam guard; nenhuma alteração de endpoints ou dados |
| 3. Pendências e jornadas | P1, grande | Cada bloqueio editorial conhecido abre uma ação resolutiva; completar um percurso PT/EN desde conteúdo pendente até preview/publicação em backend de teste real |
| 4. Editores e mobile | P2, grande | Extração por domínio sem mudança funcional indesejada; teclado/touch/listas/drawers usáveis na matriz; auditoria e proveniência apenas quando fornecidas |
| 5. Escala e colaboração | P2, médio/grande condicionado | Somente após medição: paginação, polling otimizado, controle de versão concorrente e eventuais endpoints agregados; manter validações no servidor |

Começar fase 1 por uma tela menor, não pelo editor de percursos inteiro. Estabelecer o contrato de draft/erro numa fatia e migrar uma jornada por vez. Não abrir simultaneamente refactor de backend, desenho visual, navegação e todos os formulários.

## Validação e proteção contra novo legado

- Inventário de capacidades: requisito → endpoint → tela → teste → revisão de origem. Incluir recursos recuperados de branches legadas sem marcar “implementado” só por endpoint existir.
- Unitários: serialize/dirty/merge de draft, versões e storage corrompido/indisponível; escopo por identidade/idioma; mapeamento de erro e invalidadores; waypoint e pontes; políticas editoriais.
- E2E de falha: 401/403/409/422/500/rede lenta; retry, navegação/histórico, logout, reload, refetch e língua enquanto edita; cancelar jamais envia mutação; duplo clique envia uma vez.
- E2E de jornada com backend isolado: CSV preview/confirmação/resultado parcial; aprovação humana; upload manual preservado; publicação inicialmente bloqueada e depois liberada ao resolver pendências reais. Mocks continuam úteis, mas não substituem este teste contratual.
- PR: Chromium nos tamanhos afetados; Firefox e WebKit no desktop/mobile principal. Matriz inicial 360×800, 390×844, 768×1024, 1366×768, 1440×900; bordas 820/821/822 e 1279/1280/1281 quando alterar esses breakpoints.
- Antes de release: Safari/iOS e Chrome/Android reais para teclado, foco, safe areas, GPS e upload/áudio; smoke publicado sem alterar conteúdo real. Evidência de console/rede e screenshots dos estados materialmente alterados.
- Builds/admin unitários existentes e CI seguem obrigatórios; incluir lint do admin com a configuração/padrão já existente no monorepo, sem instalar dependência às cegas. A cobertura de backend não demonstra cobertura das jornadas editoriais.

## Riscos e decisões pendentes

- Refetch/reset de effects durante extração: testes devem intercalar atualização de cache e digitação, não só cliques em sequência feliz.
- Rascunhos em navegador compartilhado: minimizar persistência, isolamento por identidade e política explícita de limpeza; não compartilhar draft automaticamente com outra conta.
- Legado: recuperar capacidades por comparação de contratos e testes, nunca merge indiscriminado de branch antiga.
- Ações pagas e lotes: usar doubles e ambiente isolado; não chamar tradução/ElevenLabs ou disparar email real durante QA sem autorização específica.
- Prontidão e conflito são regras de servidor; melhorias visuais não podem afrouxar gates nem controles de autorização.
- Roles diferenciadas podem ser úteis, mas não foram demonstradas como existentes; a primeira fase considera administradores atuais e não inventa permissão só em frontend.
- Necessário confirmar com a equipe: tarefas mais frequentes, idioma/tom da interface, tamanhos/dispositivos predominantes, política de rascunho em máquina compartilhada e suporte navegador. Sem isso, a IA de navegação é hipótese, não requisito aprovado.

## Como medir se melhorou

Antes da nova navegação, registrar em teste acompanhado com administradores: localizar uma tradução pendente; corrigir ponto e voltar sem perder edição; importar CSV com linha inválida; publicar percurso com bloqueio EN; recuperar job parcialmente falho.

Comparar sucesso sem assistência, retornos desnecessários, interpretações erradas de “guardado/publicado”, perda de trabalho e clareza do próximo passo. Objetivos de confiabilidade: zero perda nos cenários automatizados; 100% dos bloqueios conhecidos com caminho resolutivo; falhas nunca apresentadas como banco vazio. Não prometer percentuais de velocidade sem uma medição inicial.

## Primeira etapa aplicada em 30/09/2026

- Recuperação seletiva do Mapa de revisão, códigos permanentes e exportação PDF/XLSX.
- Guard compartilhado para navegação, histórico, troca de item e logout; proteção adicional
  para operações em andamento e formulários de usuários/pronúncias, sem persistir senhas.
- Rascunhos de traduções de pontos por idioma; waypoints com estado separado da narrativa,
  recuperação local versionada e isolada por administrador, mediante confirmação.
- Erros e retry de textos sem simular banco vazio; cache atualizado sem apagar edição local.
- Metadados EN de percursos com revisão explícita e acesso pelas pendências de publicação;
  falhas de tradução e áudio de pontes visíveis, incluindo job falho retornado em HTTP 200.
- Navegação agrupada em Conteúdo, Operação e Configuração; URL por seção, estado ativo
  acessível e menu horizontal compacto no celular.
- Fallback quando WebGL não inicia: preservar GPS/coordenadas e narrativa; permitir waypoint
  por coordenadas. O fallback não é evidência de mapa acelerado validado naquele navegador.

Esta etapa não conclui o plano inteiro: links por item/idioma/filtro, painel agregado de
pendências, política completa de rascunhos de todos os editores, extração completa do shell,
controle de concorrência e testes acompanhados/dispositivos reais continuam em fases posteriores.
Rascunhos antigos sem identidade não são importados automaticamente para a chave versionada.
Evidências e limitações desta entrega estão em `admin-workflow-validation.md`.

## Segunda fatia: contexto de Textos

- Endereço por texto/idioma e filtros editoriais (`#/texts/{id}?lang=en`); busca e filtros
  são derivados da URL. Não incluir credenciais, corpo de rascunho ou seleção de lote.
- Navegação central mantém o endereço completo aceito quando a saída pelo histórico é cancelada.
  Troca de idioma mantém os rascunhos locais; operações em andamento bloqueiam saída/troca.
- Link para item inexistente mostra erro e retorno à lista, sem abrir outro texto silenciosamente.
- Painel de texto limitado à largura móvel; rótulo acessível da tabela contido na rolagem.
  Em tablet/laptop estreito a edição ocupa um painel, sem somar duas larguras mínimas.
- Unitários: 29 testes do admin; build/typecheck; regressões Chromium e Firefox, incluindo
  360/390/1366 e limites 820/821/822 e 1279/1280/1281. Sem alterações no backend/dados.
- WebKit local falha antes de abrir a página (`PushAPIEnabled`): validação fica a cargo da
  suíte CI com navegador correspondente. Safari/iOS e Chrome/Android reais não foram testados.

Esta fatia não conclui a fase 2: endereços de pontos/autores/percursos e extração integral do shell
continuam pendentes. Merge/deploy requerem aprovação própria; a aplicação local não prova produção.

## Continuação: shell, autores, pontos e percursos

- `main.tsx` é somente o boot; autenticação/login e shell têm módulos próprios. O shell pesado
  é carregado depois da autenticação, com estado de carregamento e recuperação de falha de download.
  Build inicial de JavaScript passa de aproximadamente 1445 KB a 230 KB bruto; isso não é uma
  medição de latência em aparelhos reais. O chunk autenticado ainda é grande.
- Autores/pontos/tipos têm endereço por item, busca e filtros; pontos incluem idioma. Percursos
  conservam identidade, idioma de prévia e busca. Links inexistentes não editam outro item.
- Salvar os dados do ponto mantém o editor e os rascunhos das traduções; apagar exige confirmação,
  não envia request ao cancelar e mostra falha sem retirar o item da lista.
- Falha inicial de autores não aparece como zero registos editáveis; consulta/retry tem estado
  próprio. Relacionamentos só são consultados nas telas que os usam.
- Login funciona em memória se o navegador bloquear storage, com aviso explícito sobre reload.
- E2E Chromium/Firefox: 66 testes passando; 30 unitários admin e build/typecheck. WebKit deve
  passar novamente no CI desta revisão. Inspeção Chrome com toque emulado: editor de autor em
  390×844 sem overflow, contexto e foco corretos; isso não equivale a Android/iOS físico.

O objetivo de conclusão e deploy continua ativo. Auditoria integral e critérios ainda pendentes
estão em `admin-ux-completion-audit.md`; não declarar a reforma concluída somente por estes testes.

## Continuação: acessibilidade dos idiomas

- Abas de Textos e traduções dos pontos têm navegação por setas, Home/End e foco único
  na sequência de Tab, com identificação entre aba e conteúdo. Rascunhos sobrevivem à troca.
- Campos ficam bloqueados durante gravação; falha ao guardar o texto mantém o trabalho.
  Gravação e exclusão principais respeitam operações de tradução em andamento.
- 76 E2E Chromium/Firefox, 31 unitários admin, 7 compartilhados e build/typecheck passando.
  Chrome emulado 390×844 inspecionado; WebKit atualizado depende do CI. Nenhum deploy.
- Próximo passo de acessibilidade: abertura/fechamento dos drawers, Escape, restauração
  de foco e isolamento modal somente onde a interface realmente funciona como modal.

## Continuação: foco e fechamento dos painéis

- Textos/lotes/pacote usam `EditorDrawer`: foco inicial no título, Escape pelo guard e retorno
  ao invocador/busca. Até 820 px, isolamento real e Tab contido; desktop não bloqueia o menu.
- Lote/pacote não fecham nem alteram escopo durante operações pendentes; falhas mantêm o painel.
- 92 E2E Chromium/Firefox, 31 unitários admin, 7 compartilhados e build/typecheck passando.
  Inspeção Chrome emulado 390×844 sem overflow/erros. WebKit desta revisão depende do CI.
- A auditoria encontrou aprovação automática no lote/API/worker, divergente de AGENTS.md;
  issue #121 mantém o histórico. Esse contrato editorial será corrigido antes do deploy final.
