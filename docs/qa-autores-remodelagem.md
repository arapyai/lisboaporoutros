# Remodelagem de Autores — implementação e validação

9 de setembro de 2026. Implementação sobre o commit publicado `80435e1`, preservando os recursos de percursos e do mapa. Sem alteração de dados ou dependências.

## Comportamento

- Retirada da faixa informativa Default voice; não era um seletor de voz.
- Catálogo alfabético com os 26 cadastros, prévia da biografia, datas disponíveis e contagem de lugares. Busca ignora acentos, pontuação e nomes intermediários.
- No celular, lista e leitura ocupam a tela em etapas. No desktop, catálogo de 340 px ao lado do perfil, com rolagem independente.
- Perfis com URL compartilhável `#/authors/:id`, pesquisa preservada nos links de retorno e navegação por histórico.
- Perfil → todos os lugares do autor no mapa, sem corte pelo raio de proximidade; cada lugar abre o ponto e prioriza o texto desse autor.
- Ponto → biografia do autor do texto selecionado → mesmo ponto, preservando o diálogo existente.
- Estados explícitos de carregamento, erro com repetição, pesquisa sem resultados e autor sem lugares. Sem retratos, datas ou relações inventados; identidades editoriais permanecem separadas.

## Verificações

- `nix develop ./backend --command sh -c 'npm run webapp:build && npm --workspace @ecosdelisboa/webapp run test'`: TypeScript/build aprovados; 24 testes aprovados. Inclui busca, URLs, paginação completa e atribuição da biografia por ID.
- Chrome conectado: perfil em 360, 390, 768, 1023, 1024, 1025 e 1440 px de largura, altura 900 px; capturas adicionais em 360×800 e 390×844. Sem overflow horizontal; transição entre uma e duas colunas confirmada. Ajuste pequeno na navegação global evita cortar Autores em 360 px e amplia seus alvos para 44 px.
- Inspeção visual do catálogo móvel, perfil móvel, perfil longo com retorno fixo e composição desktop. Cabeçalho e idiomas existentes preservados.
- Busca real por `ECA QUEIROS`, `Florbela Espanca` e termo inexistente. Abertura pelo teclado com Enter e foco transferido ao título; retorno à lista devolve foco ao autor. Recarregamento do URL preserva perfil e pesquisa.
- Eça: três lugares no perfil e três marcadores no mapa filtrado. Link individual para Arcada da Praça do Comércio abriu trecho de Eça, sua biografia e fechou com Escape mantendo o ponto.
- Fernando Pessoa: zero lugares, mensagem explícita e ausência de ação de mapa. Nome completo de Garrett sem transbordamento. Damião de Góis: biografia longa, retorno visível durante rolagem; falha 503 simulada no fetch local do perfil e recuperação com Tentar novamente.

## Referência visual e limites

O conceito gerado foi usado como referência de hierarquia, paleta clara, tipografia literária, divisórias, catálogo lateral e ação verde de mapa. Não é uma comparação pixel a pixel: a imagem combina quadros mobile/desktop e usa conteúdo ilustrativo. A implementação usa dados reais, mantém os seis idiomas e o cabeçalho do produto, não cria retratos e mantém estados de foco explícitos. Esses desvios são intencionais.

Lint não concluído: a instalação reaproveitada não fornece `typescript-eslint` à configuração existente; a tentativa padrão também não encontra o binário local. Nenhum pacote foi instalado para contornar isso. Firefox, WebKit, Safari/iOS e Android reais não foram validados. Teclado virtual, leitor de tela real, áudio e uso offline não foram revalidados neste escopo. São lacunas de cobertura, não evidência de compatibilidade. A proposta de pesquisa com visitantes continua pendente; esta entrega não representa um estudo com usuários.

Narração por nome no player e percursos relacionados no perfil ficam pendentes de dados que sustentem a associação correta; esta implementação utiliza a relação de lugares já oferecida pelo endpoint do autor.
