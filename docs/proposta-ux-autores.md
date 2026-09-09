# Autores: proposta de experiência

Data: 9 de setembro de 2026. Proposta aprovada e implementada na página Autores: busca, catálogo resumido, perfil de leitura e ligação aos lugares. O acesso contextual à biografia pelo ponto do mapa foi preservado. Ver [validação da implementação](qa-autores-remodelagem.md).

## Diagnóstico e papel de “Default voice”

A faixa não é um menu: exibe um identificador da voz marcada como padrão no cadastro de narração. Não permite escolher voz ou ouvir uma amostra. O endpoint pode escolher uma das vozes padrão; portanto a faixa tampouco identifica necessariamente a voz do áudio que o visitante está a ouvir. Quando não há uma voz padrão, aparece “–”.

Na página Autores, essa informação disputa espaço com a descoberta literária e sugere uma função inexistente. Proposta: retirar a faixa; mostrar “Narração: [nome]” no leitor de áudio somente quando o dado corresponder à gravação. A configuração de voz permanece no admin. Não criar seletor de voz que não produza uma mudança real no áudio.

Hoje a página apresenta 26 cadastros com biografias completas em sequência. A leitura funciona, mas falta busca, uma visão resumida do catálogo e ligação entre o interesse no autor e a exploração dos lugares. Os 26 cadastros não equivalem necessariamente a 26 pessoas: há heterónimos e variantes de nome. Não fundir identidades silenciosamente como parte do desenho de interface.

## Evidência e limites

Esta é uma síntese de pesquisa publicada e inspeção do produto. Não foram realizadas entrevistas, testes com visitantes ou análise de métricas do projeto. As prioridades abaixo são hipóteses de produto a validar.

- **Exibir primeiro o necessário:** o princípio de divulgação progressiva favorece uma lista resumida com acesso explícito à leitura completa. Minha aplicação aqui é separar descoberta de leitura, mantendo “Ler biografia” visível. [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
- **Reconhecer em vez de memorizar:** mostrar nome, contexto e relação com o ponto permite ao visitante explorar sem decorar o autor e procurá-lo noutra aba. [NN/g, Recognition and Recall](https://www.nngroup.com/articles/recognition-and-recall/).
- **Toque confortável:** adotar 44×44 CSS px como meta de produto para ações principais. WCAG 2.2 AA define 24×24, com exceções; 44×44 corresponde ao critério ampliado, não ao mínimo AA. [W3C, Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced).
- **Retorno e foco previsíveis:** em uma biografia sobreposta ao mapa, conter o foco, permitir Escape e devolver o foco ao acionador. Manter o controle de retorno visível durante a leitura. [W3C, Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum).

## Histórias prioritárias

| Prioridade | História | Comportamento esperado | Critério de sucesso |
| --- | --- | --- | --- |
| P0 | Estou num ponto e quero saber quem escreveu o trecho. | Ação “Ler biografia do autor” junto ao nome; abre o autor do texto selecionado. | Um acionamento; nunca abrir outro autor de um ponto compartilhado. |
| P0 | Quero voltar à visita depois de ler. | “Voltar ao ponto” fecha a biografia e preserva ponto, trecho, filtros e posição do mapa. | Retorno sem refazer seleção; foco volta ao acionador. |
| P1 | Procuro um autor que já conheço. | Busca por nome, aceitando acentos e variantes editoriais conhecidas. | Encontrar “Eça” buscando “eca”; limpar a busca facilmente. |
| P1 | Não conheço os autores e quero descobrir alguém. | Lista alfabética com nome, datas disponíveis, resumo curto e número de lugares. | Entender cada opção sem percorrer dezenas de parágrafos completos. |
| P1 | Gostei de um autor e quero explorar sua Lisboa. | No perfil, ação “Ver lugares no mapa” e lista de lugares relacionados. | Abrir o mapa filtrado pelo ID correto; tratar explicitamente quem não tem lugares. |
| P2 | Estou a planear um passeio no computador. | Lista e perfil lado a lado, com lugares e percursos relacionados quando cadastrados. | Alternar autores preservando pesquisa e posição na lista. |
| P0 transversal | Uso teclado, leitor de tela ou conexão instável. | Controles semânticos, foco visível, leitura linear e estados de erro recuperáveis. | Abrir, ler, fechar e tentar novamente sem depender de gesto ou de áudio. |

## Proposta para celular

1. Cabeçalho “Autores” e contagem de resultados; sem indicadores técnicos de voz.
2. Busca “Procurar autor” imediatamente abaixo, com limpar e estado sem resultados.
3. Lista de uma coluna, com divisórias leves: nome, datas quando conhecidas, duas linhas de contexto e quantidade de lugares. Retrato pequeno somente se houver imagem editorial; a ausência não deve gerar um bloco vazio dominante.
4. Ao selecionar, perfil de leitura com título, nome/heterónimo claramente identificado, biografia integral, idioma do conteúdo e ação “Ver lugares no mapa”. Textos longos pertencem a essa vista, sem corte da informação.
5. Quando o perfil vier do mapa, usar uma camada de tela inteira com “Voltar ao ponto” sempre acessível. O mapa permanece montado por baixo. Não exigir gesto de arrastar para fechar.

Esquema funcional proposto:

```text
AUTORES · 26 cadastros
[ Procurar autor                 ]

Eça de Queirós
1845–1900 · [quantidade real] lugares
[resumo editorial em duas linhas]
Ler biografia
─────────────────────────────────
Fernando Pessoa [Alberto Caeiro]
[contexto editorial verificado]
Ler biografia

Mapa  ·  Percursos  ·  Autores
```

O resumo de lista deve vir de um campo editorial ou de truncamento visual claramente limitado à prévia. Não sintetizar afirmações biográficas automaticamente. Não inventar fotografias, datas, distâncias, disponibilidade offline ou relações com percursos.

## Adaptação para desktop

A partir de espaço suficiente (hipótese inicial: 1024 px), uma coluna de navegação de cerca de 300–360 px com busca e lista, e uma área principal flexível de leitura. Texto limitado a aproximadamente 60–70 caracteres por linha; evitar espalhar parágrafos por toda a largura. Em tablet, manter a navegação sequencial quando duas colunas comprimirem o conteúdo.

Na entrada a partir do mapa, uma janela de leitura com largura máxima de 640 px mantém a localização visível ao fundo. O controle de retorno e Escape fecham a janela; a interação com o mapa fica indisponível enquanto a janela está aberta. O comportamento é diferente da futura página de catálogo em duas colunas porque a tarefa é contextual e breve.

## Estados, conteúdo e acessibilidade

- Carregando: nome/contexto e mensagem de progresso; não apagar o mapa.
- Erro: mensagem curta, “Tentar novamente” e retorno sempre disponível.
- Biografia ausente: informar indisponibilidade; não atribuir a biografia de outro autor.
- Vários textos no ponto: respeitar o texto selecionado e sua relação `author_id`.
- Heterónimos: manter a identidade editorial existente; esclarecer sua relação com Pessoa no conteúdo, sem fundir registros automaticamente.
- Idioma: indicar quando a biografia está em português; não apresentar um original como tradução. Uma futura versão pode consumir traduções aprovadas.
- Teclado: foco inicial dentro da camada, Escape, foco contido e restauração ao voltar.
- Mobile: retorno com alvo de pelo menos 44 px, altura dinâmica e margens para áreas seguras; validar teclado virtual na futura busca.
- Preferir URLs estáveis e histórico navegável para os perfis na remodelagem completa. A primeira implementação contextual usa diálogo local e retorno explícito; não oferece ainda compartilhamento de perfil nem integração do botão Voltar do navegador.

## Validação da proposta

Realizar uma rodada exploratória com 5–8 pessoas, incluindo visitantes sem familiaridade com literatura portuguesa, leitores locais e pessoas que usam recursos de acessibilidade. Isso identifica problemas, mas não produz estimativas estatísticas representativas.

Tarefas: encontrar um autor pelo nome; descobrir um autor; abrir a biografia do segundo autor de um ponto compartilhado; voltar ao mesmo trecho; explorar os lugares de um autor; recuperar de falha de conexão.

Medir sucesso sem ajuda, erros de atribuição, passos de retorno, tempo até encontrar o autor e abandono da leitura. A meta inegociável é zero troca indevida de autor e zero perda do ponto ao voltar. Tempos e metas quantitativas de descoberta devem ser definidos após a linha de base, não inventados como resultados de pesquisa.

Matriz sugerida: Chromium em 360×800, 390×844, 768×1024, 1366×768 e 1440×900; Firefox/WebKit em celular e desktop; Safari/iOS e Chrome/Android reais antes de lançamento amplo. Incluir nomes longos, texto ampliado, biografia longa, campos ausentes, erro/repetição e navegação por teclado.

## Primeira entrega, antes da aprovação da remodelagem

- Proposta: este documento, incluindo a retirada de Default voice, busca, catálogo resumido e ligação autor → lugares.
- Implementação: acesso ponto/texto → biografia → mesmo ponto, com seleção por ID, diálogo adaptado a celular/desktop e estados de carregamento, ausência e erro.
- Fora desta implementação: remodelagem integral da aba Autores, tradução das biografias, novos retratos, fusão de cadastros e mudanças de narração.
