# Administrativo: correções e primeira etapa de UX

Base: `production`, revisão `9dbde3c`. Branch de implementação:
`codex/fix/admin-workflow-regressions`. Nenhum dado real foi alterado durante QA.

## Problemas, correções e lacunas de testes

| Issue | Correção | Por que escapava da cobertura |
| --- | --- | --- |
| #100 | Guard de rascunhos na navegação, item, histórico e logout; bloquear saída durante gravação | Testes de edição não intercalavam navegação/descarte |
| #101 | Erro inicial/retry e erro de atualização separados de lista vazia; preservar editor montado | Listagem de textos não tinha cenário de GET falho |
| #102 | Rascunho de ponto por idioma, preservar após erro e bloquear mutações sobrepostas | Teste unitário existente era do editor de textos, não de pontos |
| #103 | Editor EN de título/descrição, aprovação explícita e atualização das pendências | Fixture de publicação retornava prontidão sempre positiva |
| #104 | Exibir falhas HTTP e job de áudio falho em HTTP 200, sem trocar áudio anterior | Fluxo feliz não cobria erro de ponte/resultado operacional |
| #105 | Waypoints alterados, guard, recuperação local versionada por administrador, limpar após recálculo confirmado | Waypoint não fazia parte do fingerprint da narrativa e não havia teste de navegação/reload |
| #106 | Restaurar router, serviço, modelos, configuração, criação/importações e módulo responsivo de revisão | Migrações/códigos existiam, mas não havia teste da capacidade completa acessível no admin |
| #108 | Capturar falha de WebGL e manter GPS/coordenadas/narrativa; waypoint manual como alternativa | Matriz Firefox/WebKit do admin cobria apenas autenticação |

Não foi feita integração indiscriminada de branches legadas. A cadeia Alembic continua
com uma única head `20260930_000023`, sem migration nova e sem downgrade/stamp.
As colunas e a tabela dos códigos já pertenciam às migrations existentes.

## Verificações locais

- Backend: 186 testes, 85,93% de cobertura; Ruff e formatação aprovados.
- Admin: 28 testes unitários; shared: 7 testes. Build do admin inclui TypeScript.
  O admin não possui configuração/script de ESLint próprio nesta entrega.
- E2E de admin em Chromium e Firefox: 36 casos aprovados, com falhas de serviço,
  idioma, guardar, bloqueio durante request, navegação/histórico, recuperação após reload,
  refetch durante edição, prontidão EN, GPS simulado e importação/exportação.
- Lint e build da PWA aprovados após a extensão dos tipos compartilhados.
- Layout: 375×812 para mapa de revisão; 390/1366 para recuperação de senha; editor de
  percurso em larguras 360, 390, 768, 820, 821, 822, 1279, 1280, 1281, 1366 e 1440
  (altura 844 no mobile/tablet e 768 no desktop). Sem overflow da página.
  A regressão do mapa verifica também largura utilizável e empilhamento dos painéis.
- Chrome conectado: inspeção visual a 390×844 e 1366×768, com API local sintética
  em porta separada e sem escrita. A prévia esquemática não é o mapa cartográfico impresso.
- PDF: geração e renderização de A4 principal e apêndice de ponto fora da área.
  Base cartográfica substituída por double; os testes conferem códigos, dimensões,
  setores, exclusões, ZIP e correspondência com XLSX.

O Firefox local não consegue criar WebGL2: os fluxos de mapa passaram usando a alternativa
de coordenadas. Isso valida a degradação funcional, não renderização acelerada nessa máquina.
O WebKit disponível localmente falha antes de criar a página com
`Page.overrideSetting: Unknown setting: PushAPIEnabled` (incompatibilidade do runtime).
A CI instala o navegador alinhado à versão de Playwright e mantém esses mesmos casos em WebKit.

## Limitações e gate de release

- Não validados neste ambiente: Safari/iOS e Chrome/Android físicos, sensores de GPS,
  teclados/uploads/áudio reais, MapTiler ao vivo e exportação de 16 folhas A0 sob carga.
- Exportação cartográfica exige `MAPTILER_API_KEY` no backend. A consulta read-only da
  configuração do serviço de produção confirmou que a chave não está preenchida.
  Nenhum secret foi alterado; reutilizar a chave existente do frontend requer autorização.
- Não houve merge, deploy nem smoke desta revisão em produção nesta etapa.
- Alerta de bundle do Vite no admin permanece; otimização e concorrência entre administradores
  estão fora da estabilização atual.
- Plano completo, fases restantes e hipóteses a validar com administradores:
  `admin-ux-refactoring-plan.md`. Links por item/idioma/filtro e painel agregado de pendências
  ainda não foram implementados.
- Monitoramento/alertas externos foram deixados para o usuário, conforme solicitado.

Após revisão/CI e autorização de merge/deploy, publicar os três serviços na mesma revisão
de `production`; conferir migrations, health, HTTP e jornada no domínio canônico.
