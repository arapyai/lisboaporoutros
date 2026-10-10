# Florianópolis

Instância independente prevista para `floripa.literarymap.org`, com API em
`api.floripa.literarymap.org` e admin em `admin.floripa.literarymap.org`.

## Conteúdo inicial

O arquivo `backend/app/fixtures/floripa.json` contém 24 pontos, 24 textos e três
percursos no Centro. Cada ponto registra as fontes de sua associação literária,
o objeto OpenStreetMap usado para a coordenada, a consulta de geocodificação e a
data de conferência. Marcadores de praias são representativos da área, não
entradas ou indicações de banho. Endereços atuais do IEE e da Assembleia não são
apresentados como os prédios em que Antonieta trabalhou.

Fragmentos de **Broquéis / Antífona** (Cruz e Sousa, 1893) e **Santa Catarina: a
ilha** (Virgílio Várzea, 1900) vêm das transcrições da Biblioteca Digital de
Literatura Brasileira da UFSC. Os autores morreram em 1898 e 1941; as obras
originais estão em domínio público no Brasil conforme o art. 41 da Lei 9.610/1998.
Não reproduzimos notas editoriais das edições modernas. A transcrição e a grafia
seguem a fonte consultada, não uma edição diplomática dos originais.

As demais leituras são notas originais atribuídas a **Curadoria · Floripa
Literary Map**. Não são falas nem textos literários de Antonieta, Cascaes, Salim,
Eglê ou Álvaro. Seus perfis contextualizam os pontos, mas não têm trechos de obra
atribuídos a eles neste lançamento. As fontes permanecem no fixture para revisão
editorial. Os textos históricos descrevem a cidade de 1900, não condições atuais.

Os três percursos têm geometria `foot-walking` do OpenRouteService consultada em
10/10/2026: Cruz e Sousa e a cidade leitora (~608 m), Antonieta (~1.618 m) e
O Centro nas palavras de Virgílio Várzea (~1.136 m). Não houve caminhada em campo:
acessibilidade, obras, horários de museus/escolas e condições reais das calçadas
precisam de revisão local. As leituras são públicas e não exigem entrar nos imóveis.

## Seed seguro

Use um banco novo e independente. Configure conforme `backend/.env.floripa.example`.
Nunca copie usuários, filas, mídia ou credenciais de Lisboa.

```sh
nix develop ./backend
cd backend
uv run alembic upgrade head
uv run python -m app.scripts.seed_floripa          # dry-run
uv run python -m app.scripts.seed_floripa --apply  # gravação explícita
```

O seed exige Florianópolis/Brasil, recusa bancos com pontos de outras cidades,
usa UUIDs determinísticos e insere apenas registros ausentes. Não sobrescreve
edições, percursos ou publicação existentes. Não chama provedores nem cria jobs
de tradução/áudio. O conteúdo inicial fica somente em `pt-BR`, sem áudio.

`ROUTE_REQUIRE_AUDIO=false` dispensa somente o áudio; publicação continua
exigindo metadados, textos, coordenadas e geometria atual. Lisboa conserva
`ROUTE_REQUIRE_AUDIO=true` e seus idiomas existentes.

## Railway

Projeto `ecos-de-lisboa`, ambiente exclusivo `floripa-production`.

| Serviço | Fonte/configuração | Persistência |
| --- | --- | --- |
| floripa-postgres | `postgis/postgis:16-3.4` | `/var/lib/postgresql/data`, PGDATA em subdiretório |
| floripa-api | raiz `/backend` | `/data/media` |
| floripa-web | raiz `/`, build no modo `floripa` | nenhuma |
| floripa-admin | raiz `/`, build no modo `floripa` | nenhuma |

`deploy/floripa-services.json` registra os comandos e health checks aplicados
diretamente às instâncias via `serviceInstanceUpdate` da API Railway. Serviços
novos não aceitam mais Config as Code em `railway.toml`; não alteramos a
configuração legada de Lisboa. O pre-deploy da nova API aplica migrations,
cria o primeiro admin e roda o seed idempotente explicitamente.

Configure a API com a URL privada do PostGIS deste ambiente, senha/JWT novos,
`ROUTE_REQUIRED_LANGUAGES=["pt"]`, worker desabilitado e CORS apenas para PWA/admin
de Florianópolis. Não configure chaves Anthropic/ElevenLabs. Resend é opcional;
sem ele, recuperação por e-mail não funciona. Nunca deixe os defaults de admin.

Configure `VITE_API_BASE_URL` nos dois frontends para a API de Florianópolis e
`VITE_MAPTILER_KEY` na PWA para um mapa com ruas. Builds usam `--mode floripa`;
as variáveis do Railway têm precedência sobre os arquivos de cidade versionados.

Antes da publicação canônica, obtenha autorização para merge do PR em
`production`. Todos os três serviços devem usar o mesmo commit dessa branch.
Uma prévia de feature usa somente os domínios do provedor. Depois, crie os três
CNAMEs usando os destinos exatos devolvidos por `railway domain`, confira DNS/TLS,
`/health`, listas de pontos e percursos e navegação real no site publicado.

Use a skill global `uptime-monitoring` para criar/verificar monitores ativos do
site canônico e da API `/health`, com queda/recuperação para
`pedro@markun.com.br`. Não monitore preview, banco ou admin. Não declare a
publicação completa com DNS ou ativação dos alertas pendentes.

## Validação

Testes do seed cobrem dry-run, isolamento, preservação de edições, ausência de
jobs e prontidão sem áudio. O runner `scripts/test-postgres-ux.sh` aplica a cadeia
real de migrations e testa o seed em PostgreSQL/PostGIS privado. Os testes de
proximidade cobrem norte/sul da ilha, visitante distante e a política original
de Portugal. Execute também a suíte completa, lint, builds de Lisboa e Floripa
e a jornada no navegador com a API real antes do deploy.
