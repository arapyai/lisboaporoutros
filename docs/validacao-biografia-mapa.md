# Verificação do acesso à biografia pelo mapa

9 de setembro de 2026. Base: 1556db5, preservando a correção já publicada da lista de autores.

## Evidências

- TypeScript/Vite: build aprovado.
- Testes unitários: 22 aprovados, incluindo cinco cenários novos de resolução do autor por texto, ID explícito, metadados inconsistentes e atribuição ausente.
- Chrome conectado, com API development real, sem mocks de conteúdo: ponto Chiado → Alberto Pimentel → biografia → retorno ao ponto.
- Seleção de outro texto no mesmo ponto: marcador “Chiado - Gomes Leal” → nome Gomes Leal no detalhe → biografia de Gomes Leal. Não utilizou o primeiro autor do ponto.
- Escape fechou o diálogo e devolveu o foco ao botão “Ler biografia do autor”. Botão “Voltar ao ponto” também funcionou; ponto e seleção continuaram montados.
- HTTP 503 simulado apenas para a consulta de biografia no navegador: exibiu mensagem de erro e tentativa novamente. Restaurada a rede real, a tentativa carregou a biografia corretamente.
- Capturas inline inspecionadas no Chrome: celular 390×844 com leitura em tela inteira e desktop 1440×900 com janela de 640 px. Conferidos nome, texto, cores existentes, tipografia, espaçamento e retorno visível.
- Medidas DOM: 360×800, 390×844, 600×800, 601×800, 768×1024, 1366×768 e 1440×900. Sem overflow horizontal no diálogo; retorno visível e alvo de 44 px. A mudança de apresentação em 600/601 px foi conferida.

## Limites

- Firefox e WebKit não estão instalados no ambiente; não foram baixados novos navegadores. Safari/iOS e Chrome/Android reais não testados. Chrome com viewport reduzido não comprova dispositivo móvel real.
- O lint permanece bloqueado pela configuração ESLint 9 ausente nessa base; não foi alterada como parte desta tarefa.
- Ausência de biografia é tratada no componente, mas não foi simulada visualmente nesta rodada. Traduções de biografia não foram implementadas: o conteúdo original em português é identificado explicitamente.
- O retorno contextual usa diálogo; o botão Voltar do navegador e URLs compartilháveis ficam para a remodelagem proposta.
- A busca e a remodelagem integral da página Autores não foram implementadas. Ver `proposta-ux-autores.md`.
