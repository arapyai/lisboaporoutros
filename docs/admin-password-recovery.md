# Recuperação de senha do admin

## Configuração de envio

Provedor escolhido: Resend. Domínio `mail.arapy.ia.br` consultado e verificado em 30/09/2026. Remetente autorizado: `Lisboa por Outros <no-reply@mail.arapy.ia.br>`.

Configurar somente no serviço API, nunca no frontend:

- `RESEND_API_KEY`: obter do arquivo local `secrets`, sem versionar ou imprimir seu conteúdo.
- `RESEND_FROM_EMAIL=Lisboa por Outros <no-reply@mail.arapy.ia.br>`
- `ADMIN_PASSWORD_RESET_URL=https://admin.lisbon.literarymap.org/`

Os testes não enviam e-mails reais. Configuração de produção, migrations e teste real de entrega são etapas de publicação separadas e exigem autorização. O arquivo `secrets` não é copiado para o checkout de trabalho nem incluído no Git.

## Segurança e operação

- `forgot-password` retorna a mesma resposta para e-mails conhecidos, desconhecidos, inativos e limitados.
- Limite persistido no banco: três pedidos por e-mail e trinta por endereço de conexão em quinze minutos; sem depender de memória de um worker. A contagem não é um limitador transacional contra rajadas concorrentes; usar também proteção de borda para abuso volumétrico. Não confiar em `X-Forwarded-For` enviado pelo cliente. Proxies podem compartilhar o limite de conexão.
- Tokens aleatórios de 256 bits, armazenados apenas como HMAC, expiram em trinta minutos e são consumidos atomicamente. Nenhum token é devolvido pela API.
- O link usa fragmento, não query string; o frontend remove o fragmento ao abrir o formulário. O endereço do admin vem de configuração HTTPS fixa, não de cabeçalhos do pedido.
- Senha mínima de doze caracteres. Alterar a senha incrementa `auth_version`, revogando sessões e demais links anteriores. Usuários inativos não podem redefinir a senha.
- O envio usa tarefa de background e chave de idempotência por pedido. Resposta aceita não comprova entrega na caixa postal. Falhas são registradas apenas com ID do pedido, sem token, endereço ou corpo do provedor. Não há fila persistente de retentativas: se o processo parar antes do envio, solicitar outro link.
- Pedidos com mais de 24 horas são removidos na próxima solicitação. Não alteram histórico editorial.
- Migration `20260930_000023` cria somente a tabela de recuperação; não modifica senhas existentes.

## Verificação de publicação

Após autorização, aplicar migration, configurar variáveis somente na API e publicar a mesma revisão de `production` nos serviços afetados. Solicitar recuperação para uma conta autorizada; confirmar entrega, domínio/remetente, expiração, login com a nova senha, invalidação da sessão antiga e recusa da reutilização. Não solicitar nem alterar a senha de terceiros para smoke tests.
