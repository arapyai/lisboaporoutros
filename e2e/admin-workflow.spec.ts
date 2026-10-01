import { test, expect } from '@playwright/test';
import { adminTexts, publicRoute, mapStyle } from './routeFixture';
import type { Page } from '@playwright/test';
async function addWaypoint(page: Page) {
  const supported = await page.evaluate(() => {
    try { return Boolean(document.createElement('canvas').getContext('webgl2')); } catch { return false; }
  });
  if (supported) {
    await page.getByRole('button',{name:'+ Waypoint no mapa'}).click();
    await page.locator('.route-map canvas').click({position:{x:180,y:140}});
  } else {
    await page.getByLabel('Latitude do waypoint').fill('38.715');
    await page.getByLabel('Longitude do waypoint').fill('-9.135');
    await page.getByRole('button',{name:'Adicionar waypoint pelas coordenadas'}).click();
  }
}
const point = {id:'point-1',title_pt:'Ponto QA',lat:38.71,lng:-9.14,point_type_id:'literary',translations:[],point_type:{id:'literary',slug:'literary',name_pt:'Literário',icon_key:'book-open',color:'#76507A'}};
for (const width of [390,821,1366]) {
  test(`text drawer opens with focus and restores its invoker at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    await page.getByRole('button',{name:'Textos',exact:true}).click();
    const invoker=page.getByRole('button',{name:'＋ Novo texto',exact:true});
    await invoker.click();
    const editor=page.getByLabel('Novo texto',{exact:true});
    const heading=editor.getByRole('heading',{name:'Novo texto',exact:true});
    await expect(heading).toBeFocused();
    expect(await page.locator('.sidebar').evaluate(element=>Boolean(element.closest('[inert]')))).toBe(width<=820);
    if (width<=820) {
      await expect(editor).toHaveAttribute('role','dialog');
      await expect(editor).toHaveAttribute('aria-modal','true');
      await heading.press('Shift+Tab');
      const save=editor.getByRole('button',{name:'Guardar alterações',exact:true});
      await expect(save).toBeFocused();
      await save.press('Tab');
      await expect(editor.getByRole('button',{name:'Fechar',exact:true})).toBeFocused();
    } else {
      await expect(editor).not.toHaveAttribute('aria-modal','true');
      await expect(page.getByRole('button',{name:'Autores',exact:true})).toBeEnabled();
    }
    await editor.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(invoker).toBeFocused();
    expect(await page.locator('.sidebar').evaluate(element=>Boolean(element.closest('[inert]')))).toBe(false);
  });
}
test('mobile Escape cancellation preserves the draft and resizing releases outside navigation',async ({page})=>{
  await page.setViewportSize({width:820,height:844});
  await page.goto(`/#/texts/${adminTexts[0].id}?lang=pt`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  const content=editor.getByRole('textbox',{name:'Conteúdo PT',exact:true});
  await content.fill('Rascunho mantido no Escape');
  page.once('dialog',async dialog=>{expect(dialog.type()).toBe('confirm');await dialog.dismiss();});
  await content.press('Escape');
  await expect(content).toHaveValue('Rascunho mantido no Escape');
  await expect(content).toBeFocused();
  await page.setViewportSize({width:821,height:844});
  await expect(editor).not.toHaveAttribute('aria-modal','true');
  expect(await page.locator('.sidebar').evaluate(element=>Boolean(element.closest('[inert]')))).toBe(false);
  await page.setViewportSize({width:819,height:844});
  await expect(editor).toHaveAttribute('aria-modal','true');
  await expect(content).toHaveValue('Rascunho mantido no Escape');
  page.once('dialog',async dialog=>{await dialog.accept();});
  await content.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.locator('input[type="search"]')).toBeFocused();
});
for (const width of [390,1366]) {
  test(`bulk drawer protects the submitted configuration at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    let release!: () => void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    let writes=0;
    await page.route('**/api/v1/admin/automation/batches',async route=>{
      if (route.request().method() !== 'POST') return route.fallback();
      writes++;
      await gate;
      await route.fulfill({status:503,json:{detail:'Unavailable'}});
    });
    await page.getByRole('button',{name:'Textos',exact:true}).click();
    await page.getByRole('checkbox',{name:'Selecionar resultados',exact:true}).check();
    const invoker=page.getByRole('button',{name:'Gerar conteúdo',exact:true});
    await invoker.click();
    const editor=page.getByLabel('Gerar conteúdo em lote',{exact:true});
    await expect(editor.getByRole('heading',{name:'Gerar conteúdo',exact:true})).toBeFocused();
    await editor.getByRole('button',{name:'Iniciar geração',exact:true}).click();
    await expect(editor.getByRole('checkbox').first()).toBeDisabled();
    page.once('dialog',async dialog=>{expect(dialog.type()).toBe('alert');await dialog.dismiss();});
    await editor.press('Escape');
    await expect(editor).toBeVisible();
    release();
    await expect(editor.getByRole('alert')).toBeVisible();
    await expect(editor.getByRole('checkbox').first()).toBeEnabled();
    expect(writes).toBe(1);
    await editor.getByRole('button',{name:'Cancelar',exact:true}).click();
    await expect(editor).toHaveCount(0);
    await expect(invoker).toBeFocused();
  });
  test(`audio import drawer protects pending preview and restores focus at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    let release!: () => void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/v1/admin/audio-bundles/import/preview',async route=>{
      await gate;
      await route.fulfill({status:503,json:{detail:'Preview unavailable'}});
    });
    await page.getByRole('button',{name:'Textos',exact:true}).click();
    const invoker=page.getByRole('button',{name:'Importar pacote',exact:true});
    await invoker.click();
    const editor=page.getByLabel('Importar pacote de áudios',{exact:true});
    await expect(editor.getByRole('heading',{name:'Importar pacote',exact:true})).toBeFocused();
    await editor.locator('input[type="file"]').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:Buffer.from('fixture')});
    await expect(editor.locator('input[type="file"]')).toBeDisabled();
    page.once('dialog',async dialog=>{expect(dialog.type()).toBe('alert');await dialog.dismiss();});
    await editor.press('Escape');
    await expect(editor).toBeVisible();
    release();
    await expect(editor.getByRole('status')).toContainText('Falha ao enviar pacote');
    await expect(editor.locator('input[type="file"]')).toBeEnabled();
    await editor.getByRole('button',{name:'Fechar',exact:true}).first().click();
    await expect(editor).toHaveCount(0);
    await expect(invoker).toBeFocused();
  });
  test(`language tabs have keyboard focus, panels and preserved drafts at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:844});
    await page.goto(`/#/texts/${adminTexts[0].id}?lang=en`);
    const editor=page.locator('.text-versions-editor');
    const en=editor.getByRole('tab',{name:/Inglês/});
    await expect(en).toHaveAttribute('aria-selected','true');
    await expect(en).toHaveAttribute('tabindex','0');
    await editor.getByRole('textbox',{name:'Conteúdo EN',exact:true}).fill('Rascunho por teclado');
    await en.focus();
    await en.press('End');
    const fr=editor.getByRole('tab',{name:/Francês/});
    await expect(fr).toBeFocused();
    await expect(fr).toHaveAttribute('aria-selected','true');
    const panel=editor.getByRole('tabpanel');
    await expect(panel).toHaveAttribute('id',await fr.getAttribute('aria-controls') as string);
    await expect(panel).toHaveAttribute('aria-labelledby',await fr.getAttribute('id') as string);
    await fr.press('Home');
    const pt=editor.getByRole('tab',{name:/Português/});
    await expect(pt).toBeFocused();
    await pt.press('ArrowLeft');
    await expect(fr).toBeFocused();
    await fr.press('ArrowLeft');
    await expect(en).toBeFocused();
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Rascunho por teclado');
    await en.press('Tab');
    const pointField=editor.getByRole('combobox',{name:'Ponto',exact:true});
    await expect(pointField).toBeFocused();
    await pointField.press('Shift+Tab');
    await expect(en).toBeFocused();
    await expect(page.getByRole('tab',{selected:true})).toHaveCount(1);
  });
}
test('point language tabs associate panels and preserve draft while keyboard-switching', async ({page}) => {
  await page.goto('/#/points/point-1?lang=en');
  const editor=page.locator('.point-translations-editor');
  const en=editor.getByRole('tab',{name:'EN',exact:true});
  await editor.getByRole('textbox',{name:'Título',exact:true}).fill('Título de rascunho');
  await en.focus();
  await en.press('ArrowRight');
  const fr=editor.getByRole('tab',{name:'FR',exact:true});
  await expect(fr).toBeFocused();
  await expect(page).toHaveURL(/lang=fr/);
  await fr.press('ArrowRight');
  await expect(en).toBeFocused();
  await expect(editor.getByRole('textbox',{name:'Título',exact:true})).toHaveValue('Título de rascunho');
  await expect(editor.getByRole('tabpanel')).toHaveAttribute('aria-labelledby',await en.getAttribute('id') as string);
  await en.press('Tab');
  await expect(editor.getByRole('tabpanel')).toBeFocused();
});
test('text version save locks editing and tab navigation until the server confirms', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release=resolve; });
  let saved: Record<string,unknown> | undefined;
  let writes=0;
  let baseWrites=0;
  await page.route(`**/api/v1/admin/texts/${adminTexts[0].id}`,async route=>{
    if (route.request().method() !== 'PUT') return route.fallback();
    baseWrites++;
    await route.fulfill({json:{data:adminTexts[0],meta:{}}});
  });
  await page.route('**/api/v1/admin/translations',route=>route.fulfill({json:{data:saved?[saved]:[],meta:{}}}));
  await page.route('**/api/v1/admin/translations/*/en/manual',async route=>{
    writes++;
    saved={...route.request().postDataJSON(),id:'translation-qa',text_id:adminTexts[0].id,lang:'en',origin:'manual'};
    await gate;
    await route.fulfill({json:{data:saved,meta:{}}});
  });
  await page.goto(`/#/texts/${adminTexts[0].id}?lang=en`);
  const editor=page.locator('.text-versions-editor');
  const content=editor.getByRole('textbox',{name:'Conteúdo EN',exact:true});
  await content.fill('Versão protegida');
  await editor.getByRole('button',{name:'Guardar versão manual',exact:true}).click();
  await expect(content).toBeDisabled();
  await expect(editor.getByRole('tab',{name:/Francês/})).toBeDisabled();
  await expect(editor.getByText('Versão guardada.',{exact:true})).toHaveCount(0);
  page.once('dialog',async dialog=>{expect(dialog.type()).toBe('alert');await dialog.dismiss();});
  await page.getByRole('button',{name:'Guardar alterações',exact:true}).click();
  expect(baseWrites).toBe(0);
  page.once('dialog',async dialog=>{expect(dialog.type()).toBe('alert');await dialog.dismiss();});
  await page.getByRole('button',{name:'Apagar texto',exact:true}).click();
  await expect(content).toBeDisabled();
  release();
  await expect(content).toBeEnabled();
  await expect(content).toHaveValue('Versão protegida');
  expect(writes).toBe(1);
});
test('base text save locks all fields and a failed save preserves the draft', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release=resolve; });
  await page.route(`**/api/v1/admin/texts/${adminTexts[0].id}`,async route=>{
    if (route.request().method() !== 'PUT') return route.fallback();
    await gate;
    await route.fulfill({status:503,json:{detail:'Unavailable'}});
  });
  await page.goto(`/#/texts/${adminTexts[0].id}?lang=pt`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  const content=editor.getByRole('textbox',{name:'Conteúdo PT',exact:true});
  await content.fill('Rascunho conservado após falha');
  await editor.getByRole('button',{name:'Guardar alterações',exact:true}).click();
  await expect(content).toBeDisabled();
  await expect(editor.getByRole('combobox',{name:'Ponto',exact:true})).toBeDisabled();
  await expect(editor.getByRole('tab',{name:/Inglês/})).toBeDisabled();
  await expect(editor.getByRole('button',{name:'Apagar texto',exact:true})).toBeDisabled();
  release();
  await expect(editor.getByRole('status')).toHaveText('Não foi possível guardar o texto.');
  await expect(content).toBeEnabled();
  await expect(content).toHaveValue('Rascunho conservado após falha');
});
for (const viewport of [{width:360,height:800},{width:390,height:844},{width:1366,height:768}]) {
  test(`text context links retain drafts and filters at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto(`/#/texts/${adminTexts[0].id}?lang=pt&q=${encodeURIComponent(adminTexts[0].content_pt.slice(0,8))}&status=approved`);
    const editor = page.getByLabel('Editar texto', {exact:true});
    await expect(editor.getByRole('textbox',{name:'Conteúdo PT',exact:true})).toHaveValue(adminTexts[0].content_pt);
    await editor.getByRole('tab',{name:/Inglês.*sem texto/}).click();
    await expect(page).toHaveURL(/lang=en/);
    await editor.getByRole('tab',{name:/Português.*com texto/}).click();
    await editor.getByRole('textbox',{name:'Conteúdo PT',exact:true}).fill('Rascunho de contexto');
    let dialogs=0;
    page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
    await page.goBack();
    await expect(page).toHaveURL(/lang=pt/);
    await expect(editor.getByRole('textbox',{name:'Conteúdo PT',exact:true})).toHaveValue('Rascunho de contexto');
    await editor.getByRole('button',{name:'Fechar',exact:true}).click();
    await expect(editor).toBeVisible();
    expect(dialogs).toBe(2);
    const bounds=await editor.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width+1);
  });
}
test('text context reloads filters and reports missing items without opening another text', async ({page}) => {
  await page.goto('/#/texts/missing-id?lang=en&q=Lisboa&status=pending');
  await expect(page.getByRole('alert')).toContainText('O texto deste link não foi encontrado');
  await expect(page.getByLabel('Editar texto',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Voltar à lista'}).click();
  await expect(page.locator('input[type="search"]')).toHaveValue('Lisboa');
  await page.reload();
  await expect(page.locator('input[type="search"]')).toHaveValue('Lisboa');
  await page.getByRole('button',{name:/Mais filtros/}).click();
  await expect(page.getByRole('combobox',{name:'Revisão',exact:true})).toHaveValue('pending');
});
test('text context editor fits mobile, tablet and breakpoint boundaries', async ({page}) => {
  await page.goto(`/#/texts/${adminTexts[0].id}?lang=en`);
  for (const width of [360,390,768,820,821,822,1279,1280,1281,1366,1440]) {
    await page.setViewportSize({width,height:800});
    const editor=page.getByLabel('Editar texto',{exact:true});
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toBeVisible();
    const bounds=await editor.boundingBox();
    expect(bounds!.x+bounds!.width,`drawer at ${width}`).toBeLessThanOrEqual(width+1);
    const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
    expect(size.document,`document at ${width}`).toBeLessThanOrEqual(size.viewport+1);
  }
});
test('text context rejects item changes and keeps translation drafts across languages', async ({page}) => {
  await page.goto(`/#/texts/${adminTexts[0].id}?lang=en`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  await editor.getByRole('textbox',{name:'Conteúdo EN',exact:true}).fill('Rascunho EN no link');
  await editor.getByRole('tab',{name:/Português.*com texto/}).click();
  await editor.getByRole('tab',{name:/Inglês.*sem texto/}).click();
  await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Rascunho EN no link');
  let dialogs=0;
  page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await page.evaluate(id=>{location.hash=`#/texts/${id}?lang=pt`;},adminTexts[1].id);
  await expect(page).toHaveURL(new RegExp(`/texts/${adminTexts[0].id}\\?lang=en`));
  await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Rascunho EN no link');
  expect(dialogs).toBe(1);
});
test('author context opens the correct item and history cancellation preserves its draft', async ({page}) => {
  await page.goto('/#/authors/author');
  await expect(page.getByRole('textbox',{name:'Nome',exact:true})).toHaveValue('Autor QA');
  await page.getByRole('textbox',{name:'Nome',exact:true}).fill('Nome local');
  page.on('dialog',async dialog=>dialog.dismiss());
  await page.evaluate(()=>{location.hash='#/authors/missing';});
  await expect(page).toHaveURL(/#\/authors\/author$/);
  await expect(page.getByRole('textbox',{name:'Nome',exact:true})).toHaveValue('Nome local');
});
test('resource search lives in the URL without overwriting an open draft', async ({page}) => {
  await page.goto('/#/authors/author?q=Autor');
  await expect(page.getByRole('searchbox',{name:'Buscar autores'})).toHaveValue('Autor');
  await page.getByRole('textbox',{name:'Nome',exact:true}).fill('Nome local preservado');
  await page.getByRole('searchbox',{name:'Buscar autores'}).fill('Sem correspondência');
  await expect(page.getByText('Nenhum registo corresponde à busca ou aos filtros.')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Nome',exact:true})).toHaveValue('Nome local preservado');
  await expect(page).toHaveURL(/q=Sem\+correspond/);
});
test('point context selects its language and parent save preserves translation drafts', async ({page}) => {
  await page.goto('/#/points/point-1?lang=fr&type=literary&status=pending');
  const editor=page.locator('.point-translations-editor');
  await expect(editor.getByRole('tab',{name:'FR',exact:true})).toHaveAttribute('aria-selected','true');
  await editor.getByRole('textbox',{name:'Título',exact:true}).fill('Titre local FR');
  await page.route('**/api/v1/admin/points/point-1',async route=>route.fulfill({json:{data:{...point,...route.request().postDataJSON()},meta:{}}}));
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.locator('.editor-message[role="status"]')).toContainText('Alterações guardadas com sucesso.');
  await expect(editor.getByRole('textbox',{name:'Título',exact:true})).toHaveValue('Titre local FR');
  await editor.getByRole('tab',{name:'EN',exact:true}).click();
  await expect(page).toHaveURL(/lang=en/);
  await editor.getByRole('tab',{name:'FR',exact:true}).click();
  await expect(editor.getByRole('textbox',{name:'Título',exact:true})).toHaveValue('Titre local FR');
});
test('missing resource links and initial failures do not masquerade as empty editable records', async ({page}) => {
  await page.goto('/#/authors/missing');
  await expect(page.getByRole('alert')).toContainText('O registo deste link não foi encontrado');
  await expect(page.getByRole('button',{name:'Criar',exact:true})).toBeDisabled();
  await page.route('**/api/v1/admin/authors',route=>route.fulfill({status:500,json:{detail:'Unavailable'}}));
  await page.goto('/#/authors');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Consulta indisponível'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Criar',exact:true})).toBeDisabled();
  await page.route('**/api/v1/admin/authors',route=>route.fulfill({json:{data:[{id:'author',name:'Autor QA'}],meta:{}}}));
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.getByRole('heading',{name:'1 registos'})).toBeVisible();
});
test('resource deletion cancellation sends nothing and failure remains visible', async ({page}) => {
  let deletes=0;
  await page.route('**/api/v1/admin/authors/author',async route=>{deletes++;await route.fulfill({status:503,json:{detail:'Unavailable'}});});
  const cancel=async dialog=>dialog.dismiss();
  page.on('dialog',cancel);
  await page.getByRole('button',{name:'Apagar',exact:true}).click();
  expect(deletes).toBe(0);
  page.off('dialog',cancel);
  page.on('dialog',async dialog=>dialog.accept());
  await page.getByRole('button',{name:'Apagar',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Não foi possível apagar');
  await expect(page.getByRole('cell',{name:'Autor QA',exact:true})).toBeVisible();
  expect(deletes).toBe(1);
});
test('route context opens its language and history protects narrative drafts', async ({page}) => {
  await page.goto(`/#/routes/${publicRoute.id}?lang=en`);
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toHaveValue(publicRoute.title_pt);
  await expect(page.locator('select').filter({has:page.locator('option[value="en"]')}).last()).toHaveValue('en');
  await page.getByRole('textbox',{name:'Título em português',exact:true}).fill('Percurso local');
  page.on('dialog',async dialog=>dialog.dismiss());
  await page.evaluate(()=>{location.hash='#/routes/missing';});
  await expect(page).toHaveURL(new RegExp(`/routes/${publicRoute.id}\\?lang=en`));
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toHaveValue('Percurso local');
});
test('missing route cannot edit another route and an empty catalog creates safely', async ({page}) => {
  await page.goto('/#/routes/missing');
  await expect(page.getByRole('alert')).toContainText('O percurso deste link não foi encontrado');
  await expect(page.getByRole('button',{name:'Guardar percurso',exact:true})).toHaveCount(0);
  await page.route('**/api/v1/admin/routes',route=>route.fulfill({json:{data:[],meta:{}}}));
  await page.goto('/?empty-catalog=1#/routes');
  await expect(page).toHaveURL(/#\/routes\/new\?lang=pt/);
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toHaveValue('');
});
test('dashboard download failure is recoverable rather than a blank page', async ({page}) => {
  await page.route('**/src/Dashboard.tsx*',route=>route.abort());
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Não foi possível abrir o administrativo');
  await page.unroute('**/src/Dashboard.tsx*');
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.getByRole('button',{name:'Textos',exact:true})).toBeVisible();
});
test.beforeEach(async ({page}, testInfo) => {
  page.on('pageerror', error => { void testInfo.attach('browser-error', { body: error.stack ?? error.message, contentType: 'text/plain' }); });
  await page.addInitScript(() => localStorage.setItem('ecosdelisboa.admin.token','audit-fixture'));
  await page.route(/.*\/style\.json.*/, r=>r.fulfill({json:mapStyle}));
  await page.route('**/api/v1/admin/**', async r=> {
    const p=new URL(r.request().url()).pathname, m=r.request().method();
    const send=data=>r.fulfill({json:{data,meta:{}}});
    if(m!=='GET')return r.fulfill({status:503,json:{detail:'Simulated provider failure'}});
    if(p.endsWith('/auth/me'))return send({id:'admin',email:'audit@example.com',is_active:true});
    if(p.endsWith('/authors'))return send([{id:'author',name:'Autor QA',bio_pt:'Biografia QA'}]);
    if(p.endsWith('/points'))return send([point]);
    if(p.endsWith('/point-types'))return send([point.point_type]);
    if(p.endsWith('/languages'))return send([{code:'pt',name:'Português',is_source:true,is_active:true},{code:'en',name:'Inglês',is_source:false,is_active:true},{code:'fr',name:'Francês',is_source:false,is_active:true}]);
    if(p.endsWith('/points/point-1/translations'))return send([{id:'t',point_id:'point-1',lang:'en',title:'Original EN',description:'',status:'approved'}]);
    if(p.endsWith('/texts'))return send(adminTexts);
    if(p.endsWith('/routes'))return send([{...publicRoute,is_published:false,segments:publicRoute.segments.map(s=>({...s,bridge_content_pt:s.kind==='bridge'?s.content_pt:undefined})),routing_status:'ready',migration_status:'ready'}]);
    if(p.endsWith('/readiness'))return send({lang:'en',ready:false,issues:[{code:'missing_route_translation',path:'translations.en',message:'Approved route metadata is required'}]});
    return send([]);
  });
  await page.goto('/');
});
test('draft navigation asks confirmation and cancel preserves author input', async ({page}) => {
  let dialogs=0; page.on('dialog',async dialog=>{dialogs++; await dialog.dismiss();});
  await page.getByLabel('Nome',{exact:true}).fill('Alteração não guardada');
  await page.getByRole('button',{name:'Pontos',exact:true}).click();
  await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Alteração não guardada');
  expect(dialogs).toBe(1);
});
test('point translation drafts survive language changes and rejected saves', async ({page}) => {
  await page.getByRole('button',{name:'Pontos',exact:true}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  const editor=page.locator('.point-translations-editor');
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Original EN');
  await editor.getByLabel('Título',{exact:true}).fill('Rascunho EN');
  await editor.getByRole('tab',{name:'FR',exact:true}).click();
  await editor.getByLabel('Título',{exact:true}).fill('Rascunho FR');
  await editor.getByRole('tab',{name:'EN',exact:true}).click();
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Rascunho EN');
  await editor.getByRole('button',{name:'Guardar tradução',exact:true}).click();
  await expect(editor.getByText('Não foi possível atualizar esta tradução.')).toBeVisible();
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Rascunho EN');
  await editor.getByRole('tab',{name:'FR',exact:true}).click();
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Rascunho FR');
});
test('waypoints are unsaved, protected on navigation and retained after routing failure', async ({page}) => {
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await addWaypoint(page);
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await expect(page.locator('.route-status-line .unsaved')).toContainText('Waypoints por guardar');
  let dialogs=0; page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  expect(dialogs).toBe(1);
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Recalcular caminhada'}).click();
  await expect(page.locator('.route-status-line')).toContainText('última geometria válida foi preservada');
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await expect(page.locator('.route-status-line .unsaved')).toBeVisible();
});
test('route metadata can be reviewed and refreshes publication readiness', async ({page}) => {
  let approved=false;
  await page.route('**/api/v1/admin/routes/*/translations**', async r=>{
    if(r.request().method()==='PUT'){
      const payload=r.request().postDataJSON();
      expect(payload.status).toBe('approved');
      approved=true;
      return r.fulfill({json:{data:{...payload,id:'metadata-en',lang:'en'},meta:{}}});
    }
    return r.fulfill({json:{data:[],meta:{}}});
  });
  await page.route('**/api/v1/admin/routes/*/readiness*',r=>r.fulfill({json:{data:{lang:'en',ready:approved,issues:approved?[]:[{code:'missing_route_translation',path:'translations.en'}]},meta:{}}}));
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await page.getByLabel('Título EN',{exact:true}).fill('Walking Lisbon');
  await page.getByLabel('Descrição EN',{exact:true}).fill('Reviewed description');
  await page.getByRole('button',{name:'Rever e guardar metadados EN'}).click();
  await expect(page.getByText('Metadados EN revistos e guardados.')).toBeVisible();
  await expect(page.locator('.readiness-language.ready')).toHaveCount(2);
});
test('bridge translation and audio failures show actionable errors without erasing content', async ({page}) => {
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await page.locator('.narrative-card.bridge').first().click();
  await page.getByLabel('Texto em inglês',{exact:true}).fill('Bridge English QA');
  await page.getByRole('button',{name:'Rever e guardar EN',exact:true}).click();
  await expect(page.locator('.route-status-line')).toContainText('Não foi possível guardar a ponte EN');
  await expect(page.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('Bridge English QA');
  await page.getByRole('button',{name:'Gerar',exact:true}).first().click();
  await expect(page.locator('.route-status-line')).toContainText('Não foi possível gerar o áudio da ponte');
  await page.route('**/audio/*/generate',r=>r.fulfill({json:{data:{status:'failed',error:'Provider error',audio:{public_url:'https://example.invalid/old.mp3'}},meta:{}}}));
  await page.getByRole('button',{name:'Gerar',exact:true}).first().click();
  await expect(page.locator('.route-status-line')).toContainText('Não foi possível gerar o áudio. O áudio anterior foi preservado.');
  await page.route('**/audio/*/generate',r=>r.fulfill({json:{data:{status:'completed',error:null,audio:{lang:'pt',manually_uploaded:true,public_url:'https://example.invalid/manual.mp3'}},meta:{}}}));
  await page.getByRole('button',{name:'Gerar',exact:true}).first().click();
  await expect(page.locator('.route-status-line')).toContainText('Áudio manual protegido');
});
test('text query errors show retry rather than an empty collection', async ({page}) => {
  await page.route('**/api/v1/admin/texts',r=>r.fulfill({status:500,json:{detail:'Database unavailable'}}));
  await page.getByRole('button',{name:'Textos',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await expect(page.getByText('0 de 0 textos',{exact:true})).toHaveCount(0);
  await page.route('**/api/v1/admin/texts',r=>r.fulfill({json:{data:adminTexts,meta:{}}}));
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Textos',exact:true})).toBeVisible();
});
test('mobile navigation and review map remain reachable without page overflow', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.route('**/api/v1/admin/review-map/preview*',r=>r.fulfill({json:{data:{generated_at:new Date().toISOString(),total_points:1,main_points:1,outside_points:0,invalid_points:0,bounds:{west:-9.2,south:38.7,east:-9.1,north:38.8},sectors:[],warnings:[],points:[{...point,review_code:'P0001',sectors:[],location_status:'main'}]},meta:{}}}));
  await page.getByRole('button',{name:'Mapa de revisão',exact:true}).click();
  await expect(page).toHaveURL(/#\/review-map$/);
  await expect(page.getByRole('heading',{name:'Mapa de revisão',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const preview = await page.locator('.review-map-preview-card').boundingBox();
  const options = await page.locator('.review-map-options').boundingBox();
  expect(preview!.width).toBeGreaterThan(250);
  expect(options!.y).toBeGreaterThanOrEqual(preview!.y + preview!.height);
});

test('route reload restores uncalculated waypoints only after explicit confirmation', async ({page}) => {
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await addWaypoint(page);
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('ecosdelisboa.route-draft.v2.admin.')))).toBe(true);
  page.on('dialog',async dialog=>{ await dialog.accept(); });
  await page.reload();
  await expect(page.getByText('Rascunho local restaurado.')).toBeVisible();
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await expect(page.locator('.route-status-line .unsaved')).toContainText('Waypoints por guardar');
});

test('browser history cannot silently discard an author draft', async ({page}) => {
  await page.getByRole('button',{name:'Pontos',exact:true}).click();
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await page.getByLabel('Nome',{exact:true}).fill('Protegido no histórico');
  let dialogs=0;
  page.on('dialog',async dialog=>{ dialogs++; await dialog.dismiss(); });
  await page.goBack();
  await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Protegido no histórico');
  await expect(page).toHaveURL(/#\/authors$/);
  expect(dialogs).toBe(1);
});

test('route shell has no document overflow across mobile, tablet and breakpoint boundaries', async ({page}) => {
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await expect(page.getByLabel('Título em português')).toBeVisible();
  for (const width of [360,390,768,820,821,822,1279,1280,1281,1366,1440]) {
    await page.setViewportSize({width,height: width < 821 ? 844 : 768});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1), `overflow at ${width}px`).toBe(true);
  }
});

test('pending translation save locks input and navigation until it finishes', async ({page}) => {
  let finish: () => void = () => {};
  const gate = new Promise<void>(resolve => { finish=resolve; });
  await page.route('**/api/v1/admin/points/point-1/translations/en',async route => {
    if (route.request().method() === 'GET') return route.fallback();
    await gate;
    await route.fulfill({status:503,json:{detail:'Unavailable'}});
  });
  await page.getByRole('button',{name:'Pontos',exact:true}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  const editor=page.locator('.point-translations-editor');
  await editor.getByLabel('Título',{exact:true}).fill('Guardando sem perda');
  await editor.getByRole('button',{name:'Guardar tradução',exact:true}).click();
  await expect(editor.getByLabel('Título',{exact:true})).toBeDisabled();
  page.once('dialog',async dialog => { expect(dialog.type()).toBe('alert'); await dialog.dismiss(); });
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(editor).toBeVisible();
  finish();
  await expect(editor.getByLabel('Título',{exact:true})).toBeEnabled();
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Guardando sem perda');
});

test('new administrator draft is protected without persisting its password', async ({page}) => {
  await page.getByRole('button',{name:'Usuários',exact:true}).click();
  await page.getByRole('button',{name:'Novo usuário',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('novo@example.invalid');
  await page.getByLabel('Senha inicial',{exact:true}).fill('SenhaFixture123!');
  page.on('dialog',async dialog=>{ await dialog.dismiss(); });
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('novo@example.invalid');
  await expect(page.getByLabel('Senha inicial',{exact:true})).toHaveValue('SenhaFixture123!');
  expect(await page.evaluate(()=>Object.values(localStorage).join(' ').includes('SenhaFixture123!'))).toBe(false);
});

test('background route refresh preserves narrative and uncalculated waypoint drafts', async ({page}) => {
  let reads=0;
  await page.route('**/api/v1/admin/routes',route=>{
    reads++;
    return route.fulfill({json:{data:[{...publicRoute,title_pt:reads>1?'Título remoto atualizado':publicRoute.title_pt,is_published:false,segments:publicRoute.segments.map(segment=>({...segment,bridge_content_pt:segment.kind==='bridge'?segment.content_pt:undefined})),routing_status:'ready',migration_status:'ready'}],meta:{}}});
  });
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await addWaypoint(page);
  await page.getByLabel('Título em português').fill('Meu rascunho local');
  await page.evaluate(()=>window.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(()=>reads).toBeGreaterThan(1);
  await expect(page.getByLabel('Título em português')).toHaveValue('Meu rascunho local');
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await expect(page.locator('.route-status-line .unsaved')).toBeVisible();
});
