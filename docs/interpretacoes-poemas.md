# Interpretações de poemas enviadas por visitantes

## Escopo aprovado

O visitante poderá gravar ou enviar a sua interpretação de um poema e disponibilizá-la como uma opção de áudio no Lisboa por Outros. A contribuição terá crédito próprio e passará por confirmação de e-mail e conferência da leitura. As interpretações com alta correspondência ao poema poderão ser publicadas automaticamente; as demais serão encaminhadas à moderação.

A implementação ficará na branch `codex/interpretacoes-poemas`, criada a partir de `production`. A branch será preservada após a integração em produção. Este contrato define a primeira versão; o código de gravação, envio e processamento ainda não está implementado.

| Item | Regra aprovada |
| --- | --- |
| Participação | Sem conta, apenas voz própria de participantes com 18 anos ou mais |
| Conteúdo | Leitura completa de um poema já disponível no site |
| Idioma | O idioma do poema efetivamente exibido na tela |
| Entrada | Gravação no celular ou envio de MP3 |
| Limites | Até 10 minutos e 25 MB; os dois limites precisam ser respeitados |
| Identificação | Nome de crédito e e-mail obrigatórios; link de crédito opcional |
| Confirmação | E-mail confirmado antes de qualquer publicação |
| Transcrição | No servidor do projeto, sem API externa de transcrição |
| Autorização de publicação | Obrigatória para enviar a contribuição |
| Autorização de IA | Opcional, restrita às traduções daquele mesmo poema com a voz da pessoa |
| Geração com IA | Acionada pelo administrativo após a aceitação da interpretação |
| Retirada | Por link enviado ao e-mail, incluindo as versões com IA derivadas da contribuição |

## Envio e escolha da interpretação

1. No leitor do poema, o seletor apresenta apenas opções que correspondam a gravações disponíveis e a ação **Enviar a minha interpretação**. O áudio atual continua disponível e permanece como escolha inicial.
2. O formulário mantém visíveis o poema, o autor e o idioma da leitura. Se a interface estiver em inglês mas o conteúdo disponível for um fallback em português, a referência da gravação será explicitamente o texto português.
3. A pessoa escolhe **Gravar agora** ou **Enviar MP3**. Na gravação, pode parar, ouvir e refazer antes de enviar. A permissão do microfone só é pedida ao iniciar a gravação; negar a permissão mantém o envio de arquivo disponível. Cancelar ou fechar encerra o microfone.
4. O formulário recolhe nome de crédito, e-mail e, opcionalmente, um link para o trabalho da pessoa. As duas autorizações começam desmarcadas. Recusar IA não impede o envio nem a publicação da gravação original.
5. Depois do envio, o arquivo fica privado. O e-mail contém uma ligação para confirmar a contribuição. A análise só entra na fila depois da confirmação, evitando gastar processamento com envios não confirmados.
6. A transcrição local é comparada com a versão do poema vinculada ao envio. O resultado decide entre publicação automática e revisão; uma falha técnica nunca autoriza a publicação.
7. A interpretação publicada entra no seletor com o nome de crédito. Ao selecioná-la, aparece **Interpretação de [nome]**, com **Conhecer o trabalho** quando houver link. O e-mail nunca aparece no catálogo público.

Uma contribuição acrescenta uma alternativa de escuta; não substitui a gravação editorial nem as outras interpretações. Trocar a opção interrompe o áudio anterior. Uma interpretação retirada deixa de ser oferecida e não pode continuar como opção ativa do leitor.

## Texto proposto para o formulário

### Explicação antes das autorizações

> Envie uma leitura completa deste poema, feita com a sua própria voz. Pode gravar aqui ou enviar um MP3 de até 10 minutos e 25 MB. Antes de publicar, vamos confirmar o seu e-mail e conferir se a leitura corresponde ao poema. Essa conferência transforma o áudio em texto no servidor do projeto, sem enviar a gravação a uma API externa de transcrição. Se houver diferenças ou dúvidas, a nossa equipa fará a revisão.
>
> Quando a interpretação for publicada, outras pessoas poderão ouvi-la no site. Mostraremos o nome de crédito e o link que indicar. O seu e-mail será usado para confirmar e gerir a contribuição e não será publicado.
>
> A autorização de IA é uma escolha separada. Se aceitar, poderemos enviar a gravação à ElevenLabs para criar versões deste mesmo poema em outros idiomas, usando uma reprodução sintética da sua voz. Essas versões serão identificadas como feitas com IA. A autorização não permite usar a sua voz para outros textos nem disponibilizá-la num catálogo de vozes para terceiros. Se não aceitar, a sua interpretação original poderá ser publicada normalmente.
>
> Pode retirar a contribuição através do link enviado ao seu e-mail. Deixaremos de oferecer no site a gravação e as versões com IA feitas a partir dela. A retirada não apaga cópias que visitantes já tenham guardado.

### Autorização obrigatória

> Declaro que esta é a minha voz e que tenho 18 anos ou mais. Autorizo o Lisboa por Outros a processar esta gravação para conferir a leitura e a publicá-la junto deste poema, com o nome de crédito e o link que indiquei.

### Autorização opcional de IA

> Autorizo o envio desta gravação à ElevenLabs para criar versões em outros idiomas deste mesmo poema com uma reprodução sintética da minha voz. Sei que posso recusar esta opção sem impedir a publicação da gravação original e que posso retirar esta autorização pelo link enviado ao meu e-mail.

O formulário deve ligar à informação de privacidade do projeto, com responsável, contacto, destinatários e prazos de conservação definidos antes do lançamento. As finalidades separadas, a linguagem clara, as caixas inicialmente desmarcadas e a retirada acessível seguem os princípios descritos pelo [EDPB sobre consentimento](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en). O texto acima é a proposta de produto a conciliar com essa informação.

## Conferência da leitura e publicação

O envio guarda o identificador do poema, o idioma e uma referência à versão exata do texto lido. Alterações posteriores no poema não podem fazer uma gravação antiga parecer automaticamente compatível com o texto novo; nesses casos, o envio vai para revisão.

Como proposta técnica para a calibração, a diferença pode ser calculada pela quantidade de palavras substituídas, omitidas e acrescentadas, dividida pela quantidade de palavras do poema. Maiúsculas, pontuação e quebras de linha não devem causar divergências artificiais. A comparação não deve apagar diferenças de palavras que alterem o sentido.

**Menor diferença significa maior correspondência.** O limite numérico será escolhido com gravações reais, incluindo sotaques, pausas e estilos de interpretação variados. Não há uma percentagem aprovada neste momento. A publicação automática só será ativada com um limite configurado e validado; sem essa calibração, os envios confirmados ficam disponíveis para revisão manual.

| Resultado | Destino |
| --- | --- |
| Leitura completa, correspondência suficiente e análise concluída | Publicação automática, identificada no administrativo |
| Divergência acima do limite ou gravação incompleta | Moderação com diferenças realçadas |
| Transcrição inconclusiva ou falha do processamento | Pendente, com motivo e possibilidade de nova análise |
| Arquivo inválido, formato incompatível ou acima dos limites | Erro de envio explicado à pessoa; sem publicação |
| E-mail ainda não confirmado | Arquivo privado, aguardando confirmação |

A comparação confere as palavras reconhecidas; não comprova a identidade de quem fala, a titularidade da voz nem a qualidade artística. A confirmação do e-mail comprova acesso à caixa postal. A declaração de voz própria e o mecanismo de retirada continuam necessários.

## Painel administrativo

O painel reúne contribuições pendentes, publicadas automaticamente, publicadas por decisão editorial, rejeitadas e retiradas. A equipa poderá ouvir o áudio, consultar a transcrição, comparar com o poema e ver o motivo da análise. Nome de crédito, contacto privado, idioma, duração, link, autorizações e histórico das decisões acompanham cada contribuição.

As ações são aprovar, rejeitar com motivo, retirar uma publicação, repetir uma análise que falhou e iniciar uma versão com IA quando autorizada. Publicar uma gravação original não inicia automaticamente versões em outros idiomas. As ações editoriais exigem autenticação, ficam registadas e não podem ser desfeitas por um processamento antigo que termine depois delas.

## Versões com IA e retirada

O administrativo só pode iniciar uma versão com IA quando o e-mail estiver confirmado, a interpretação estiver aceita e a autorização de IA continuar válida. A autorização é vinculada àquela contribuição e àquele poema; não pode ser reaproveitada para outros textos. A tradução textual usada na geração precisa passar pelo fluxo editorial existente.

Cada versão gerada fica ligada à interpretação original, ao idioma e ao registo de autorização. Antes de publicar, o sistema volta a verificar a autorização e o estado da contribuição. A retirada bloqueia novos trabalhos e a publicação de trabalhos em andamento, retira os áudios derivados do catálogo e solicita a remoção dos recursos de voz correspondentes no provedor.

A modalidade de clonagem precisa ser escolhida antes da integração. A ElevenLabs distingue a [clonagem instantânea da profissional](https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning); na modalidade profissional, [a própria pessoa precisa verificar a voz e partilhá-la](https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice). Não se deve presumir que um checkbox habilita qualquer modalidade do provedor.

Antes de enviar gravações de participantes, o projeto deve verificar a configuração que exclui novos dados do treino geral de modelos. A [ElevenLabs documenta o controlo de utilização de dados](https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models); a configuração da conta ainda precisa ser confirmada. A autorização para traduções de um poema não abrange treino geral de modelos.

O link de gestão permite retirar a contribuição inteira ou revogar apenas a autorização de IA. Revogar apenas IA mantém a interpretação original, bloqueia novas gerações e retira as versões derivadas. Os tokens de confirmação e gestão não devem aparecer em logs, referências públicas nem no cadastro público da interpretação.

## Integração técnica proposta

O modelo atual permite um `AudioFile` por texto e idioma (`backend/app/models/entities.py`). As interpretações devem ter entidade e estados próprios, preservando esse áudio existente. O leitor combina a gravação editorial com as interpretações publicadas; nenhuma voz deve aparecer como opção de escuta sem um áudio correspondente ao poema e idioma.

Os arquivos aguardando confirmação ou revisão ficam em armazenamento privado. As rotas públicas só entregam contribuições publicadas, e a retirada precisa bloquear o acesso público ao áudio, além de remover a opção do seletor. Links de crédito aceitam apenas endereços web seguros e não são consultados pelo servidor para gerar prévias.

O envio valida tamanho, formato real, duração e decodificação no servidor; a extensão ou o tipo declarado pelo navegador não bastam. A gravação nativa do celular pode produzir outros formatos e precisará de conversão controlada. A escolha do transcritor local, do conversor e do processamento em segundo plano deve considerar memória, CPU e limites de concorrência antes de acrescentar dependências ao projeto.

O projeto já utiliza Resend para e-mails administrativos (`backend/app/services/password_recovery.py`). A confirmação e a gestão da contribuição podem reaproveitar esse provedor, com tokens próprios, expiração e proteção contra envios repetidos. A fila de análise deve ser independente dos trabalhos pagos de geração de áudio; esta feature não deve reativar a fila de áudio atualmente pausada.

Guardar o registo da autorização inclui a versão do texto apresentado, as escolhas separadas e as datas de envio, confirmação e revogação. Os limites de envio e de repetição de e-mails precisam impedir abuso sem expor se outro participante usa determinado endereço.

## Critérios de aceitação

- O visitante grava, ouve e refaz antes do envio; negar microfone não impede enviar MP3. O poema continua acessível durante a gravação.
- Arquivos acima de 10 minutos ou 25 MB, inválidos ou incompatíveis recebem erro claro e não entram no catálogo público.
- Nenhum áudio é público antes da confirmação do e-mail. A confirmação repetida é idempotente e um link expirado permite pedir novo envio com limites de frequência.
- Recusar IA permite publicar a interpretação original e impede qualquer envio da voz à ElevenLabs. A transcrição continua exclusivamente no servidor do projeto.
- A publicação automática respeita a calibração e a versão do poema. Divergência, áudio incompleto, erro ou dúvida de análise nunca resultam em publicação automática.
- O painel mostra tanto os envios moderados quanto os publicados automaticamente, com áudio, diferenças e histórico. A retirada editorial prevalece sobre trabalhos em andamento.
- A escolha da interpretação muda de facto o áudio e mostra o crédito correspondente. O e-mail e os tokens de gestão não aparecem na API pública.
- A revogação bloqueia novas gerações e retira versões com IA; a retirada integral também remove a interpretação original do acesso público.
- A validação inclui gravações reais de referência para a comparação, além de testes com HTTP e PostgreSQL reais. Integrações pagas ficam simuladas nos testes automatizados.
- O fluxo é verificado em Chromium, Firefox e WebKit, em mobile e desktop, e em aparelhos reais para permissões de microfone, formato de gravação e reprodução. WebKit em Linux não substitui Safari num iPhone.

## Condições antes do lançamento

Antes da publicação desta feature, é preciso calibrar o limite de comparação, escolher e medir o processamento local, verificar a modalidade de clonagem e a configuração de utilização dos dados na ElevenLabs e definir os prazos de expiração e conservação de envios e registos. Essas decisões completam a operação do recurso sem alterar as autorizações de produto aprovadas acima.
