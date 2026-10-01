# Consultas das listagens administrativas

Diagnóstico no serviço de produção em `272f36d`, sem mutações ou cópia de dados.
São tempos internos de consulta/serialização, não tempos completos do navegador.

| Listagem | Registros | Queries SQL | Tempo medido |
| --- | ---: | ---: | ---: |
| Textos | 142 | 122 | 20,573 s |
| Percursos | 2 | 18 | 5,061 s |
| Autores | 27 | 1 | 0,285 s |
| Pontos | 158 | 3 | 0,581 s |
| Idiomas | 6 | 1 | 0,284 s |
| Traduções | 710 | 1 | 0,432 s |
| Áudio | 146 | 1 | 0,287 s |
| Vozes | 0 | 1 | 0,284 s |
| Usuários | 4 | 1 | 0,284 s |
| Tipos de ponto | 3 | 1 | 0,285 s |
| Dicionários de pronúncia | 0 | 1 | 0,284 s |
| Lotes ativos | 0 | 4 | 2,754 s |

## Causa e solução

`serialize_text` usa `serialize_point`, que acessa tipo e traduções do ponto.
O endpoint carregava o ponto, mas não essas relações: cada ponto distinto provocava
consultas adicionais. A listagem de percursos reutiliza o mesmo serializer aninhado.
Ambos passam a carregar tipo e traduções dos pontos em lote com `selectinload`.
Sem alteração de JSON, ordenação, autenticação, aprovações ou schema.

Comparação read-only da consulta de textos com essas relações: 7 queries e 1,170 s
(outra execução: 1,892 s). Não é garantia de latência sob carga.

## Cobertura e limites

Novos testes usam sessões frescas e 1/16 pontos distintos. Conferem conteúdo e relações,
com teto de 7 queries para textos e 13 para percursos nesse tamanho de amostra.
O carregamento em lote pode usar mais queries ao ultrapassar o tamanho de lote do ORM;
o objetivo é evitar uma query por registro, não impor um teto universal.

O teste funcional antigo verificava JSON com poucos dados, sem contar queries.
Em SQLite local, consultas pequenas são rápidas e o cache da sessão mascara a regressão.

Não foi reproduzido N+1 nas outras listagens medidas, mas amostras vazias não comprovam
escala. Lotes consultam pendências por lote e podem repetir a consulta de revisão durante
serialização; merece teste próprio com vários lotes concluídos e itens pendentes.
Endpoints de importação, mutações e provedores externos não foram executados neste audit.
Não foram testadas concorrência/carga nem a jornada autenticada completa no navegador.
