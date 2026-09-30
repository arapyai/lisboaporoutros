# Correção de pontos pelo GPS no site

Abra um ponto no site público, toque em **Acesso administrativo** e entre com sua
conta administrativa. A sessão do painel em outro domínio não é compartilhada;
o acesso no site dura nesta aba e pode ser encerrado com **Sair**.

No local correto, toque em **Corrigir localização pelo GPS**, **Obter posição
atual**, confira o mapa (roxo: anterior; verde: GPS) e confirme. Cancelar não grava.
O GPS exige HTTPS (ou localhost), permissão do navegador e precisão até 60 m.
Acima de 25 m aparece um aviso; deslocamentos acima de 100 m exigem confirmação
adicional. Uma medição expira após dois minutos. Atualizações concorrentes são
recusadas: feche e reabra o ponto para obter as coordenadas mais recentes.

O histórico autenticado guarda responsável, data, fonte, coordenadas anteriores e
novas, precisão e instante da medição. Os dados públicos expõem somente data e
fonte da última correção. Alterações de coordenadas no editor administrativo também
são auditadas como `admin_editor`; no site a fonte é `admin_gps_pwa`.
Importações diretas e dados anteriores à migration não têm histórico retroativo.
Percursos que usam o ponto ficam com roteamento desatualizado para recálculo.

Antes de publicar, aplicar a migration `20260930_000022` na cadeia Alembic normal.
Validar em um aparelho real: login, permissão, precisão, mapa, cancelar, confirmar
e consultar histórico. Os testes automatizados simulam GPS e não substituem essa
validação física, especialmente no Safari/iOS.
