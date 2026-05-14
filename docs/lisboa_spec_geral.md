  
**LISBOA POR OUTROS**

A Cidade Escrita em Voz Alta

**ESPECIFICAÇÃO TÉCNICA  ·  v2.0**

Abril de 2025  ·  Uso interno da equipa

# **1\. Visão Geral**

O Lisboa por Outros é uma aplicação móvel multilíngue (PT · EN · ES · FR · DE · ZH) que guia utilizadores por Lisboa através de textos literários narrados em voz dramatizada com IA. Esta versão da especificação incorpora simplificações de infraestrutura e uma interface administrativa completa para gestão de conteúdo.

| Dimensão | Decisão |
| :---- | :---- |
| Plataformas | iOS \+ Android (React Native / Expo) · Web App PWA |
| Idiomas v1.0 | PT e EN no lançamento; ES, FR, DE, ZH em updates posteriores |
| Servidor | Railway — backend \+ PostgreSQL gerido |
| Storage de áudio | Cloudflare R2 (S3-compatible, sem egress fees) |
| Síntese de voz | ElevenLabs API — voz por autor \+ voz padrão configurável |
| Tradução automática | Gemini API com workflow de revisão humana no admin |
| Modelo de negócio | Gratuito, sem anúncios — suportado por candidatura EGEAC 2025 |
| Orçamento total | €10.000  (€5.000 conteúdo/gestão · €1.500×3 devs · €500 UX) |

# **2\. Arquitetura do Sistema**

## **2.1 Diagrama de Componentes**

| ┌───────────────────────────────────────────────────────────────┐ │                      CLIENTES                                 │ │   React Native App (iOS/Android)   |   Web PWA (React/Vite)  │ └───────────────────┬───────────────────────────────────────────┘                     │ HTTPS / REST JSON ┌───────────────────▼───────────────────────────────────────────┐ │                RAILWAY — API (FastAPI/Python)                 │ │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │ │  │  /points │  │ /routes  │  │ /admin   │  │ /translate  │  │ │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │ └──────────┬──────────────────────────┬─────────────────────────┘            │                          │ ┌──────────▼──────────┐   ┌───────────▼────────────────────────┐ │  Railway PostgreSQL │   │   Serviços externos                │ │  (PostGIS enabled)  │   │   ElevenLabs  DeepL  Cloudflare R2 │ └─────────────────────┘   └────────────────────────────────────┘ |
| :---- |

## **2.2 Stack Tecnológico**

| Camada | Tecnologia | Notas |
| :---- | :---- | :---- |
| API Backend | Python 3.12 \+ FastAPI | Async nativo, OpenAPI docs automáticas |
| Base de dados | PostgreSQL 16 \+ PostGIS | Gerido pelo Railway; queries geoespaciais |
| Cache de sessão | Railway Redis (opcional fase 2\) | Rate limiting e cache de traduções pendentes |
| App Mobile | React Native \+ Expo SDK 51 | iOS \+ Android; OTA updates sem app store |
| Web App | React 18 \+ Vite (PWA) | Para uso desktop/browser sem instalação |
| Admin UI | React 18 \+ Vite \+ TanStack Query | SPA separada servida pelo próprio Railway |
| Síntese de voz | ElevenLabs API | Voz por autor; fallback para voz padrão |
| Tradução | Google Gemini API | Tradução automática com prompt literário \+ workflow de revisão |
| Storage de áudio | Cloudflare R2 | S3-compatible; PUT direto do backend |
| CI/CD | GitHub Actions \+ Railway deploy | Deploy automático em push para main |
| Monitoramento | Railway Metrics \+ Sentry | Logs, erros e uptime incluídos no Railway |
| Mapas | Mapbox GL JS / react-native-maps | Tiles offline e geofencing |

## **2.3 Estrutura de Repositórios**

| lisboa-por-outros/ ├── api/                  \# FastAPI backend │   ├── app/ │   │   ├── models/       \# SQLAlchemy models │   │   ├── routers/      \# endpoints por domínio │   │   ├── services/     \# ElevenLabs, DeepL, R2 │   │   └── admin/        \# routers do painel admin │   ├── alembic/          \# migrations │   └── Dockerfile ├── mobile/               \# React Native \+ Expo ├── webapp/               \# PWA pública (React/Vite) ├── admin/                \# Painel admin (React/Vite) └── .github/workflows/    \# CI/CD |
| :---- |

# **3\. Modelo de Base de Dados**

| authors   id               UUID  PK   name             TEXT  NOT NULL   bio\_pt           TEXT   birth\_year       INT   death\_year       INT   photo\_url        TEXT   elevenlabs\_voice\_id   TEXT          \-- voz específica deste autor   created\_at       TIMESTAMPTZ points   id               UUID  PK   author\_id        UUID  FK → authors   title\_pt         TEXT  NOT NULL   address          TEXT   neighborhood     TEXT   lat              DOUBLE PRECISION   lng              DOUBLE PRECISION   geom             GEOMETRY(Point, 4326\)  \-- PostGIS   created\_at       TIMESTAMPTZ texts   id               UUID  PK   point\_id         UUID  FK → points   content\_pt       TEXT  NOT NULL        \-- texto original PT   source\_work      TEXT   source\_year      INT   content\_type     ENUM(prose, poetry, lyrics)   created\_at       TIMESTAMPTZ translations   id               UUID  PK   text\_id          UUID  FK → texts   lang             ENUM(en, es, fr, de, zh)  NOT NULL   content          TEXT  NOT NULL        \-- conteúdo traduzido   status           ENUM(pending, approved, rejected)  DEFAULT pending   auto\_translated  BOOLEAN  DEFAULT true   reviewed\_by      TEXT                 \-- email do revisor   reviewed\_at      TIMESTAMPTZ   created\_at       TIMESTAMPTZ   UNIQUE(text\_id, lang) audio\_files   id               UUID  PK   text\_id          UUID  FK → texts   lang             ENUM(pt, en, es, fr, de, zh)  NOT NULL   r2\_key           TEXT                 \-- chave no Cloudflare R2   public\_url       TEXT   duration\_s       FLOAT   voice\_id         TEXT                 \-- voz usada na geração   generated\_at     TIMESTAMPTZ   manually\_uploaded BOOLEAN  DEFAULT false   UNIQUE(text\_id, lang) voices   id               UUID  PK   elevenlabs\_id    TEXT  NOT NULL  UNIQUE   name             TEXT   preview\_url      TEXT   is\_default       BOOLEAN  DEFAULT false   synced\_at        TIMESTAMPTZ routes   id               UUID  PK   title\_pt         TEXT  NOT NULL   description\_pt   TEXT   distance\_m       INT   duration\_min     INT   cover\_image\_url  TEXT   published        BOOLEAN  DEFAULT false route\_points   id               UUID  PK   route\_id         UUID  FK → routes   point\_id         UUID  FK → points  (ou lat/lng direto se não for ponto cadastrado)   lat\_override     DOUBLE PRECISION     \-- posição custom dentro do percurso   lng\_override     DOUBLE PRECISION   order\_index      INT  NOT NULL   transition\_text\_pt TEXT              \-- narração de transição entre pontos |
| :---- |

# **4\. API Pública — Endpoints**

Todos os endpoints públicos são read-only e não requerem autenticação. Idioma via parâmetro ?lang={code}. Respostas em JSON com envelope {data, meta}.

| Método | Endpoint | Descrição |
| :---- | :---- | :---- |
| GET | /api/v1/points | Pontos próximos — parâm: lat, lng, radius (m), lang, author\_id |
| GET | /api/v1/points/{id} | Detalhe completo: textos, áudios, autor |
| GET | /api/v1/authors | Lista de autores com contagem de pontos |
| GET | /api/v1/authors/{id} | Perfil do autor com todos os pontos |
| GET | /api/v1/routes | Lista de percursos publicados |
| GET | /api/v1/routes/{id} | Percurso completo com sequência de pontos |
| GET | /api/v1/routes/{id}/gpx | Export GPX do percurso |
| GET | /api/v1/routes/{id}/podcast.rss | RSS Feed do percurso (podcast) |
| GET | /api/v1/voices/default | Voz padrão atual (para o app saber qual usar) |

# **5\. Interface Administrativa**

O painel admin é uma SPA React servida numa aplicação Railway. Autenticação via e-mail \+ password simples (sem OAuth externo na v1). O acesso é apenas para a equipa interna — não há registo público.

**5.1 Módulos do Painel**

| Módulo | Rota Admin | Descrição |
| :---- | :---- | :---- |
| Dashboard | /admin | KPIs: pontos, percursos, áudios pendentes, traduções pendentes |
| Autores | /admin/authors | CRUD de autores \+ atribuição de voz ElevenLabs |
| Pontos Literários | /admin/points | CRUD com mapa inline \+ importação CSV |
| Textos e Citações | /admin/points/{id} | Textos por ponto \+ status de tradução e áudio por língua |
| Percursos | /admin/routes | CRUD de percursos \+ editor de sequência drag-and-drop |
| Traduções | /admin/translations | Fila de revisão de traduções automáticas |
| Vozes ElevenLabs | /admin/voices | Sincronização e configuração de vozes disponíveis |
| Gestão de Áudio | /admin/audio | Visão geral do status de geração por texto/língua |

## **5.2 Módulo: Autores**

Formulário de criação/edição de autor com os seguintes campos:

* Nome, datas de nascimento/morte, foto (upload direto para R2)

* Biografia em PT (as outras línguas são traduzidas automaticamente como textos)

* Seletor de voz: dropdown com as vozes sincronizadas da conta ElevenLabs

* Prévia de voz: botão que toca o preview\_url da voz selecionada

* Se nenhuma voz for atribuída, usa a voz padrão definida no módulo Vozes

## **5.3 Módulo: Pontos Literários e Importação CSV**

Os pontos podem ser criados manualmente ou importados em lote via CSV. O mapa inline permite ajustar coordenadas arrastando o marcador.

**Formato do CSV de Importação**

| author\_name,title,address,neighborhood,lat,lng,content\_pt,source\_work,source\_year,content\_type Fernando Pessoa,Tabacaria do Rossio,Rossio 59,Baixa,38.7134,-9.1392,"Não sou nada...",Tabacaria,1928,poetry Eça de Queirós,O Ramalhete,Rua das Janelas Verdes,Santos,38.7037,-9.1597,"Ali vivia...",Os Maias,1888,prose |
| :---- |

Comportamento da importação:

* Se author\_name existir na BD → associa ao existente; se não existir → cria autor novo com dados mínimos

* Validação de lat/lng obrigatória; linhas inválidas são rejeitadas com erro por linha

* Preview de importação antes de confirmar: tabela mostrando o que será criado/actualizado

* Operação idempotente por (author\_name \+ title): reimportar o mesmo CSV não duplica

*⚠ A importação CSV cria pontos e textos mas não dispara tradução nem geração de áudio automaticamente. O gestor decide quando acionar esses processos.*

## **5.4 Módulo: Textos, Tradução e Áudio por Ponto**

Ao abrir um ponto, o admin mostra uma tabela com todos os textos associados. Para cada texto, uma linha por língua mostra o status de tradução e áudio:

| Língua | Tradução | Áudio | Ações |
| :---- | :---- | :---- | :---- |
| PT | Original | ✓ Gerado  1m24s | ▶ Ouvir  ↑ Substituir |
| EN | ✓ Aprovada | ✓ Gerado  1m31s | ▶ Ouvir  ↺ Regerar  ↑ Substituir |
| ES | ⏳ Pendente revisão | — Não gerado | ✎ Rever tradução  ⊕ Gerar áudio |
| FR | ⏳ Pendente revisão | — Não gerado | ✎ Rever tradução |
| DE | — Não traduzido | — Não gerado | ⊕ Traduzir |
| ZH | — Não traduzido | — Não gerado | ⊕ Traduzir |

Ações disponíveis por linha:

* Traduzir: dispara chamada Gemini e cria translation com status=pending

* Rever tradução: abre modal inline com texto PT à esquerda e tradução automática à direita (editável) \+ botões Aprovar / Rejeitar

* Gerar áudio: disponível apenas quando tradução está approved (ou para PT, sempre disponível); chama ElevenLabs com a voz do autor

* Regerar: regenera o áudio (sobrescreve R2 e actualiza audio\_files)

* Substituir: upload manual de ficheiro MP3 (marca manually\_uploaded=true; não sobrescrito por regerar automático)

* Ouvir: player inline na própria linha

| Regra de negócio: áudios marcados como manually\_uploaded=true nunca são sobrescritos por regenerações automáticas em lote. Só podem ser substituídos por upload manual explícito. |
| :---- |

## **5.5 Módulo: Percursos**

Editor visual de percursos com duas áreas: mapa à esquerda e lista ordenada à direita.

* Criar percurso: título (PT), descrição, foto de capa, dificuldade, publicado/rascunho

* Adicionar ponto ao percurso: busca por nome ou clique no mapa → adiciona à lista

* Suporte a waypoints livres (lat/lng sem ponto cadastrado) para pontos intermédios de navegação

* Reordenar pontos: drag-and-drop na lista à direita

* Texto de transição entre pontos: campo opcional por par de pontos consecutivos

* Distância e duração estimada calculadas automaticamente via Mapbox Directions API

* Publicar/despublicar: toggle; percursos não publicados não aparecem na app pública

## **5.6 Módulo: Traduções — Fila de Revisão**

Vista consolidada de todas as traduções com status=pending, ordenadas por data de criação. Permite revisão em lote.

| Campo | Detalhe |
| :---- | :---- |
| Filtros | Por língua, por autor, por status (pending / approved / rejected) |
| Vista de revisão | Texto PT à esquerda (coluna fixa); tradução automática à direita (editável) |
| Ações em lote | Selecionar múltiplas → Aprovar tudo / Rejeitar tudo |
| Histórico | Ver quem aprovou e quando (campo reviewed\_by \+ reviewed\_at) |
| Trigger de áudio | Ao aprovar tradução, opção 'Gerar áudio agora' disponível inline |

## **5.7 Módulo: Vozes ElevenLabs**

Gestão das vozes disponíveis na conta ElevenLabs sem necessidade de aceder ao painel da ElevenLabs.

* Botão Sincronizar: chama GET /v1/voices da ElevenLabs e actualiza a tabela voices na BD

* Lista com nome, preview de áudio e autores que a usam

* Toggle Voz Padrão: define qual voz é usada quando um autor não tem voz específica atribuída (apenas uma pode ser padrão)

* A voz padrão é exposta pela API pública em GET /api/v1/voices/default para referência do app

## **5.8 Módulo: Gestão de Áudio — Visão Geral**

Dashboard de status de áudio para o gestor de conteúdo acompanhar a produção em escala.

| Métrica | Descrição |
| :---- | :---- |
| Total de textos | Número total de textos cadastrados |
| Áudios gerados (por língua) | Contagem e percentagem de textos com áudio gerado por idioma |
| Fila de geração | Textos com tradução aprovada mas sem áudio — botão 'Gerar todos pendentes' |
| Uploads manuais | Textos com áudio marcado como manually\_uploaded |
| Último erro de geração | Log dos últimos erros da ElevenLabs API (quota, falha de rede) |

| O botão 'Gerar todos pendentes' é uma operação assíncrona. O backend enfileira as gerações e actualiza o status em tempo real via SSE (Server-Sent Events) — o admin mostra uma barra de progresso. |
| :---- |

# **6\. Integração com Serviços Externos**

## **6.1 ElevenLabs — Síntese de Voz**

| Operação | Endpoint ElevenLabs | Quando |
| :---- | :---- | :---- |
| Listar vozes disponíveis | GET  /v1/voices | Sincronização manual no admin (módulo Vozes) |
| Gerar áudio de texto | POST /v1/text-to-speech/{voice\_id} | Geração sob demanda ou em lote (admin) |
| Stream para preview | POST /v1/text-to-speech/{voice\_id}/stream | Preview inline no admin (sem guardar) |

| \# Payload de geração (backend → ElevenLabs) POST /v1/text-to-speech/{voice\_id} {   "text": "\<tradução aprovada\>",   "model\_id": "eleven\_multilingual\_v2",   "voice\_settings": { "stability": 0.5, "similarity\_boost": 0.75 } } \# Após resposta OK: \# 1\. Upload do MP3 para Cloudflare R2  (PUT /{text\_id}/{lang}.mp3) \# 2\. Actualizar audio\_files: r2\_key, public\_url, duration\_s, voice\_id, generated\_at |
| :---- |

## **6.2 Google Gemini — Tradução Automática**

O Gemini é usado em vez de um serviço de tradução genérico porque permite instruções contextuais ricas no prompt — essencial para preservar o registo literário, a pontuação poética e o tom de cada autor.

| Operação | Modelo | Quando |
| :---- | :---- | :---- |
| Traduzir texto literário | gemini-2.0-flash | Admin: botão 'Traduzir' por texto ou em lote |
| Verificar quota/billing | — | Google Cloud Console (sem endpoint dedicado) |

| \# Prompt enviado ao Gemini (backend) system: |   You are a literary translator. Preserve the author's voice, rhythm,   punctuation style and register. Do not modernize or simplify.   Return ONLY the translated text, no explanation. user: |   Translate the following Portuguese literary excerpt to {target\_lang}.   Author: {author\_name} ({birth\_year}–{death\_year})   Source work: {source\_work} ({source\_year})   Content type: {content\_type}  \[prose | poetry | lyrics\]   \---   {content\_pt}   \--- \# Resultado gravado em translations com status=pending \# Nunca marcado como approved automaticamente — revisão humana obrigatória |
| :---- |

*⚠ O prompt inclui autor, obra e tipo de conteúdo para que o Gemini calibre o registo. Um soneto de Cesário Verde não deve soar como um parágrafo de Saramago — mesmo em inglês.*

## **6.3 Cloudflare R2 — Storage de Áudio**

| Operação | Quando |
| :---- | :---- |
| PUT  /{text\_id}/{lang}.mp3 | Upload após geração ElevenLabs ou upload manual |
| DELETE /{text\_id}/{lang}.mp3 | Ao substituir áudio (regerar ou novo upload manual) |
| GET URL pública | Lida de audio\_files.public\_url; nunca proxy pela API |

| \# Estrutura de keys no bucket R2 audio/   {text\_id}/     pt.mp3     en.mp3     es.mp3     ... \# URL pública (Cloudflare CDN) https://audio.lisboaporoutros.com/{text\_id}/{lang}.mp3 \# Configurar custom domain no R2 para evitar URLs longas do Cloudflare |
| :---- |

## **6.4 Railway — Infraestrutura**

| Recurso Railway | Configuração recomendada |
| :---- | :---- |
| Serviço API | Starter plan (\~€5/mês) — auto-deploy via GitHub main branch |
| PostgreSQL | Railway Postgres plugin — inclui backups automáticos diários |
| Variáveis de env | Configuradas no painel Railway (nunca no repositório) |
| Domínio custom | api.lisboaporoutros.com → Railway HTTPS automático |
| Logs | Railway Log Drain → Sentry ou Papertrail |

*⚠ Railway não tem Redis incluído no plano base. Usar cache em memória (functools.lru\_cache) na v1; adicionar Railway Redis na v2 se o tráfego justificar.*

# **7\. Divisão de Tarefas e Responsabilidades**

Cada membro tem escopo e orçamento fixos. As tarefas listadas são as entregas mínimas para o lançamento v1.0. Funcionalidades P1 (pós-lançamento) podem ser negociadas separadamente.

|  | Markun  ·  Backend Developer    €1.500 Setup do projeto FastAPI: estrutura de módulos, routers, middleware CORS, paginação Modelos SQLAlchemy \+ migrations Alembic para todas as entidades do schema (secção 3\) Endpoints públicos da API v1 (secção 4): pontos, autores, rotas, RSS, GPX Endpoints admin autenticados: CRUD completo de autores, pontos, textos, percursos Serviço de importação CSV: validação, preview, idempotência, relatório de erros por linha Serviço ElevenLabs: listar vozes, gerar áudio, stream de preview, gestão de erros de quota Serviço Gemini: traduzir texto com prompt literário contextual (autor, obra, tipo), armazenar como pending Serviço Cloudflare R2: upload/delete de MP3, geração de URLs públicas Endpoint SSE para progresso de geração de áudio em lote (EventSource no frontend) Geração de OG cards dinâmicos por ponto (para partilha em redes sociais) Testes com pytest: cobertura mínima 70% nos serviços e routers principais Documentação OpenAPI completa (gerada automaticamente pelo FastAPI) |
| :---- | :---- |

|  | Carlos  ·  Frontend Developer    €1.500 Setup React Native \+ Expo SDK 51 com Expo Router (navegação file-based) Ecrã de mapa principal: Mapbox com clustering, marcadores por autor, filtros Bottom sheet de detalhe de ponto com player de áudio inline e transcrição sincronizada Ecrã de percursos: lista \+ detalhe \+ modo guiado com geofencing automático Ecrã de onboarding e seleção de idioma (persistida em AsyncStorage) Cache offline: pré-fetch dos pontos e áudios do bairro atual Web PWA (React/Vite): versão simplificada para desktop (mapa \+ player, sem modo guiado) Integração com sistema de design providenciado por Roberta (tokens, componentes base) |
| :---- | :---- |

|  | Joel  ·  SysAdmin / Infraestrutura / Admin Frontend    €1.500 Criar projeto no Railway: serviço API \+ plugin PostgreSQL \+ variáveis de ambiente Configurar GitHub Actions: lint \+ testes em PRs; deploy automático em merge para main Ativar extensão PostGIS no PostgreSQL do Railway (via migration ou psql direto) Configurar Cloudflare R2: criar bucket, CORS policy, domínio custom para áudios Script de seed inicial: inserir vozes padrão, utilizador admin, dados de teste Testar e documentar procedimento de restore do backup Railway PostgreSQL Runbook de operações: deploy, rollback, reset de variáveis, troubleshooting de quota ElevenLabs Revisão de segurança pré-lançamento: headers HTTP, secrets exposure, CORS, SQL injection Admin UI (React/Vite \+ TanStack Query): todas as páginas do painel (secção 5\) Admin — Editor de percursos: drag-and-drop com @dnd-kit, mapa inline, waypoints livres Admin — Vista de textos: tabela de status por língua com ações inline (secção 5.4) Admin — Fila de traduções: revisão lado-a-lado PT vs tradução com aprovação/rejeição Admin — Progresso de geração em lote: componente SSE com barra de progresso em tempo real |
| :---- | :---- |

|  | Roberta  ·  Consultora UX    €500 Workshop de briefing (2h): personas, jornadas críticas, princípios de design acordados Wireframes de baixa fidelidade dos 6 ecrãs P0 da app pública \+ 3 ecrãs críticos do admin Sistema de design: paleta de cores, tipografia, espaçamento, tokens exportados para Carlos Protótipo Figma navegável para validação interna antes do desenvolvimento 1 rodada de testes de usabilidade (5 utilizadores) na fase 3 — foco no fluxo GPS \+ áudio Revisão de acessibilidade WCAG 2.1 AA no frontend antes do lançamento |
| :---- | :---- |

# **8\. Cronograma — 6 Meses**

| Fase | Período | Marco | Destaques |
| :---- | :---- | :---- | :---- |
| Fase 1Fundações | Mês 1 | Infra Railway operacional \+ schema BD \+ sistema de design | Joel: Railway \+ R2 \+ CI/CD  |  Markun: FastAPI \+ migrations \+ endpoints base  |  Carlos: setup Expo \+ Admin skeleton  |  Roberta: wireframes \+ tokens |
| Fase 2Core API \+ Admin | Mês 2–3 | Admin funcional: CRUD completo \+ importação CSV \+ gestão de vozes | Markun: todos os endpoints admin \+ serviços ElevenLabs/DeepL/R2  |  Carlos: Admin UI completa \+ app móvel (mapa \+ player)  |  Joel: monitoramento \+ seed |
| Fase 3Conteúdo \+ Tradução | Mês 4 | Conteúdo real carregado \+ traduções EN aprovadas \+ primeiros áudios gerados | Markun: endpoint SSE progresso  |  Carlos: fila de traduções \+ progresso lote \+ cache offline  |  Roberta: teste usabilidade (5 users) |
| Fase 4Polimento | Mês 5 | PWA \+ percursos \+ RSS/GPX \+ fixes UX pós-testes | Markun: RSS \+ GPX \+ OG cards  |  Carlos: editor percursos drag-drop \+ PWA \+ modo guiado geofencing  |  Roberta: revisão acessibilidade WCAG |
| Fase 5Lançamento | Mês 6 | Submissão app stores \+ go-live público | Carlos: build release \+ submissão App Store / Google Play  |  Joel: runbook \+ revisão segurança  |  Markun: docs finais |

# **9\. Orçamento**

| Categoria | Valor (€) | Notas |
| :---- | :---- | :---- |
| Pesquisa, conteúdo e gestão de projeto | 4.250 | Curadoria literária, traduções humanas de revisão, produção de referência de áudio, coordenação |
| Backend (Markun) | 1.500 | Escopo secção 7 |
| Frontend \+ Admin UI (Carlos) | 1.500 | Escopo secção 7 |
| Infra / SysAdmin (Joel) | 1.500 | Escopo secção 7 |
| Consultoria UX (Roberta) | 500 | Escopo secção 7 |
| Hospedagem, APIs e Playstore/iOS | 750 |  |
| TOTAL | 10.000 |  |

**Custos mensais de operação estimados (pós-lançamento)**

| Serviço | Plano / Limite | Custo Estimado |
| :---- | :---- | :---- |
| Railway (API \+ Postgres) | Starter plan | \~€5/mês |
| Cloudflare R2 | 10 GB grátis; \~200 MB MVP | €0/mês no MVP |
| ElevenLabs | Creator (\~30 min/mês) | \~€22/mês — apenas na fase de produção de conteúdo |
| Google Gemini API | gemini-2.0-flash | \~€0–2/mês — \~$0.075/1M tokens input; textos literários são curtos |
| Sentry | Developer (grátis) | €0/mês |
| Mapbox | 50k loads/mês grátis | €0/mês até escala |
| Playstore |  | €25 |
| iOS |  | €99 (ano) |
| Total estimado | — | \~€35-45/mês |

# **10\. Qualidade e Convenções**

## **10.1 Critérios de Aceitação**

| Critério | Padrão |
| :---- | :---- |
| Performance API | P95 \< 200 ms para endpoints de geolocalização |
| Cold start app | \< 3 segundos em dispositivo médio com 4G |
| Testes backend | Cobertura mínima 70% (pytest) — CI bloqueia merge se falhar |
| Acessibilidade | WCAG 2.1 AA — validado por Roberta antes do lançamento |
| Offline | Mapa e áudios do último bairro visitado acessíveis sem dados |
| Segurança | Nenhuma chave de API no repositório; HTTPS em todos os endpoints |
| Admin — tradução | Nenhuma tradução pode ser marcada approved automaticamente (sem revisão humana) |
| Admin — áudio manual | Ficheiros com manually\_uploaded=true nunca sobrescritos por lote |

## **10.2 Git e Branches**

* main — protegida; merge apenas via PR com 1 aprovação

* develop — branch de integração

* feature/{nome} ou fix/{nome} — branches de trabalho

* Conventional Commits: feat:, fix:, chore:, docs:

* PRs de UI incluem screenshots; PRs de API incluem exemplo de request/response

## **10.3 Variáveis de Ambiente**

| \# Nunca commitar .env — usar .env.example com chaves sem valores DATABASE\_URL=postgresql://... ELEVENLABS\_API\_KEY=sk\_... GEMINI\_API\_KEY=AIza...       \# Google AI Studio ou Vertex AI R2\_ACCOUNT\_ID=... R2\_ACCESS\_KEY\_ID=... R2\_SECRET\_ACCESS\_KEY=... R2\_BUCKET\_NAME=lisboa-audio R2\_PUBLIC\_BASE\_URL=https://audio.lisboaporoutros.com ADMIN\_SECRET\_KEY=...     \# JWT signing para sessões admin SENTRY\_DSN=https://... |
| :---- |

# **11\. Riscos e Mitigações**

| Risco | Prob. | Impacto | Mitigação |
| :---- | :---- | :---- | :---- |
| Direitos autorais (obras modernas) | Média | Alto | Priorizar domínio público (+70 anos). Sophia e Saramago requerem validação jurídica antes de qualquer publicação. |
| Quota ElevenLabs esgotada em lote | Média | Médio | Geração incremental com fila; monitorar quota no dashboard admin. ElevenLabs Creator: \~30 min/mês (\~60 textos de 30s). |
| Qualidade das vozes IA | Média | Médio | Revisão de áudio obrigatória antes de publicar. Fallback: narradores humanos para PT e EN. |
| Atraso nas revisões de tradução | Alta | Baixo | Lançar com PT e EN apenas; outras línguas como updates. Workflow de revisão no admin facilita o processo. |
| Rejeição nas App Stores | Baixa | Alto | Carlos revê checklists Apple/Google antes da submissão. TestFlight para iOS antes do release. |
| Custo Railway em escala | Baixa | Médio | Railway tem planos escaláveis; arquitectura permite migrar para outro provider sem mudanças de código. |

# **Aprovação**

Este documento constitui o acordo técnico da equipa. Alterações de escopo devem ser aprovadas por todos antes de implementação.

| Nome | Papel | Assinatura | Data |
| :---- | :---- | :---- | :---- |
| Markun | Backend |  | \_\_\_/\_\_\_/2025 |
| Carlos | Frontend |  | \_\_\_/\_\_\_/2025 |
| Joel | Infra / SysAdmin \+ Admin |  | \_\_\_/\_\_\_/2025 |
| Roberta | Consultora UX |  | \_\_\_/\_\_\_/2025 |

Lisboa por Outros  ·  Especificação Técnica v2.0  ·  Abril 2025  ·  Confidencial