# Preview local com dados de desenvolvimento

Este fluxo permite revisar uma branch com conteúdo representativo sem publicar um deploy. A
aplicação inteira roda na máquina local; um Cloudflare Tunnel nomeado encaminha três hostnames
para PWA, admin e API, e o Cloudflare Access controla quem pode abrir o preview.

Netlify não faz parte deste fluxo. Railway continua sendo a plataforma dos ambientes
publicados; o tunnel é somente uma janela temporária para a execução local.

## Limites de segurança

- a origem dos dados é sempre o ambiente `development` da Railway;
- o acesso remoto via Railway SSH é usado somente para `pg_dump`, sem escrita;
- o restore só aceita `localhost` ou `127.0.0.1` e banco terminado em `_preview`;
- usuários administrativos e filas de automação/áudio/tradução não são copiados;
- identificadores de revisores são removidos e um admin exclusivamente local é criado;
- o dump vive em um diretório temporário e é apagado ao terminar;
- credenciais de providers, Railway e Cloudflare não entram no banco nem no repositório.

O sync copia registros do banco, não o volume de MP3 da Railway. Metadados de áudio permanecem
visíveis para conferir estados editoriais, mas a reprodução local pode retornar arquivo ausente.

Mesmo sanitizada, a cópia pode conter conteúdo editorial ainda não publicado. Por isso, os
hostnames de preview devem ter uma política de Cloudflare Access antes do primeiro uso.

## 1. Configurar o tunnel uma vez

No Cloudflare Zero Trust, crie um tunnel remotamente gerido e associe três hostnames:

| Hostname de exemplo | Serviço local |
| --- | --- |
| `preview.lisbon.literarymap.org` | `http://localhost:5173` |
| `admin-preview.lisbon.literarymap.org` | `http://localhost:5174` |
| `api-preview.lisbon.literarymap.org` | `http://localhost:8000` |

Crie aplicações/políticas de Access para os três hostnames, limitadas à equipe revisora. Copie
o token do tunnel, sem adicioná-lo a comandos versionados, issues ou logs.

Quick Tunnels com domínio aleatório `trycloudflare.com` servem apenas para uma demonstração
descartável com mocks ou seed. Eles não têm SLA, têm limite de requisições simultâneas e não
suportam SSE; portanto, não devem expor esta cópia da Railway nem validar o tray de jobs.

## 2. Preparar o ambiente

Requisitos: Nix, Docker com Compose, Node/npm e Railway CLI autenticada.

```bash
cp .env.preview.example .env.preview.local
```

Preencha em `.env.preview.local` o `TUNNEL_TOKEN` e ajuste os três URLs para os hostnames
criados. O arquivo é ignorado pelo Git.

Instale as dependências JavaScript, se necessário:

```bash
npm install
```

`cloudflared`, PostgreSQL client, Python e `uv` vêm do ambiente Nix de `backend/`.

## 3. Atualizar a cópia local dos dados

```bash
npm run preview:data:sync
```

O comando:

1. inicia PostGIS local em `127.0.0.1:54329`;
2. executa um `pg_dump` read-only em `postgres-dev` via Railway SSH;
3. transmite um dump temporário para a máquina local, excluindo autenticação e jobs;
4. recria apenas o banco local validado;
5. restaura os dados, aplica as migrations da branch e sanitiza revisores;
6. cria `admin@example.com` com senha `change-me` exclusivamente no banco local.

O restore substitui o conteúdo do banco local `_preview`. Ele não altera a Railway. Execute o
sync novamente quando precisar de uma fotografia mais recente.

Se o checkout não estiver ligado ao projeto na Railway, mantenha o `RAILWAY_PROJECT_ID` do
arquivo de exemplo. Para evitar uma cópia acidental do ambiente errado, o script rejeita
qualquer valor de `RAILWAY_ENVIRONMENT` diferente de `development`.

O snapshot publicado pode conter um identificador de migration que ainda não está no Git. A
cópia local reposiciona o marcador Alembic para `LOCAL_ALEMBIC_BASE_REVISION`, que deve ser a
última revisão comum, e então aplica as migrations da branch. Isso altera somente o clone local;
se a cadeia de migrations mudar, atualize esse valor de forma explícita no arquivo local.

## 4. Abrir o preview

```bash
npm run preview:local
```

O comando inicia API, PWA, admin e `cloudflared` no terminal atual. Interromper com `Ctrl+C`
encerra esses processos; o container PostGIS permanece disponível para a próxima execução.

A API local desliga o worker de áudio e não recebe chaves de tradução, geocoding ou ElevenLabs.
Assim, a revisão navega pelos dados existentes sem disparar processamento externo. Operações
editoriais feitas no admin afetam somente o banco local.

## Diagnóstico rápido

```bash
docker compose -f compose.local.yml ps
curl http://127.0.0.1:8000/health
curl https://api-preview.lisbon.literarymap.org/health
```

Se o domínio público responder e o local não, revise a aplicação. Se o local responder e o
público não, revise a rota do tunnel, DNS e política de Access. Não desative Access para
contornar problemas de configuração.

## Preview local versus staging

| Fluxo | Finalidade | Dados | Persistência |
| --- | --- | --- | --- |
| local + Tunnel | revisão rápida de branch | fotografia sanitizada de `development` | máquina do desenvolvedor |
| Railway `development` | integração compartilhada | banco próprio de desenvolvimento | ambiente publicado |
| Railway produção | uso público | banco de produção | ambiente publicado |

Publicar ou migrar staging/produção continua exigindo o procedimento de release; iniciar um
tunnel não autoriza nem realiza deploy.
