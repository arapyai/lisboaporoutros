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
for (const viewport of [{width:360,height:800},{width:390,height:844},{width:1366,height:768}]) {
  test(`text context links retain drafts and filters at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto(`/#/texts/${adminTexts[0].id}?lang=pt&q=${encodeURIComponent(adminTexts[0].content_pt.slice(0,8))}&status=approved`);
    const editor = page.getByRole('complementary', {name:'Editar texto'});
    await expect(editor.getByRole('textbox',{name:'Conteúdo PT',exact:true})).toHaveValue(adminTexts[0].content_pt);
    await editor.getByRole('button',{name:/Inglês.*sem texto/}).click();
    await expect(page).toHaveURL(/lang=en/);
    await editor.getByRole('button',{name:/Português.*com texto/}).click();
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
  await expect(page.getByRole('complementary',{name:'Editar texto'})).toHaveCount(0);
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
    const editor=page.getByRole('complementary',{name:'Editar texto'});
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toBeVisible();
    const bounds=await editor.boundingBox();
    expect(bounds!.x+bounds!.width,`drawer at ${width}`).toBeLessThanOrEqual(width+1);
    const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
    expect(size.document,`document at ${width}`).toBeLessThanOrEqual(size.viewport+1);
  }
});
test('text context rejects item changes and keeps translation drafts across languages', async ({page}) => {
  await page.goto(`/#/texts/${adminTexts[0].id}?lang=en`);
  const editor=page.getByRole('complementary',{name:'Editar texto'});
  await editor.getByRole('textbox',{name:'Conteúdo EN',exact:true}).fill('Rascunho EN no link');
  await editor.getByRole('button',{name:/Português.*com texto/}).click();
  await editor.getByRole('button',{name:/Inglês.*sem texto/}).click();
  await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Rascunho EN no link');
  let dialogs=0;
  page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await page.evaluate(id=>{location.hash=`#/texts/${id}?lang=pt`;},adminTexts[1].id);
  await expect(page).toHaveURL(new RegExp(`/texts/${adminTexts[0].id}\\?lang=en`));
  await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Rascunho EN no link');
  expect(dialogs).toBe(1);
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
