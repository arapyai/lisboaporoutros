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
| Salvar, aprovar, gerar e publicar são ações distintas | Contratos atuais preservados; auditoria de todas as ações/jornada ainda pendente |
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
| Foco inicial/restaurado, Escape, teclado e tabs acessíveis | Parcial; drawers/tabs ainda exigem revisão funcional |
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
