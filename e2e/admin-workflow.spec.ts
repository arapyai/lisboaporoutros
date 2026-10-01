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
const point = {id:'point-1',title_pt:'Ponto QA',lat:38.71,lng:-9.14,point_type_id:'literary',translations:[],point_type:{id:'literary',slug:'literary',name_pt:'Literário',icon_key:'book-open',color:'#76507A',is_active:true}};
const authorDraftKey = 'ecosdelisboa.editor-draft:v1:admin:authors:author:pt';
test('point recovery warns about remote changes and discard keeps other account copies',async ({page})=>{
  const identity={userId:'admin',entity:'point-translations',id:'point-1',language:'en'};
  const baseline={title:'Nome anterior',description:'',status:'pending'};
  const value={title:'Minha revisão EN',description:'Descrição local',status:'pending'};
  const key='ecosdelisboa.editor-draft:v1:admin:point-translations:point-1:en';
  const frKey=key.replace(/:en$/,':fr'), otherKey=key.replace(':admin:',':other:');
  await page.addInitScript(({identity,baseline,value,key,frKey,otherKey})=>{
    const entry={version:1,identity,baseline,value,savedAt:Date.now()};
    localStorage.setItem(key,JSON.stringify(entry));
    localStorage.setItem(frKey,JSON.stringify({...entry,identity:{...identity,language:'fr'}}));
    localStorage.setItem(otherKey,JSON.stringify({...entry,identity:{...identity,userId:'other'}}));
  },{identity,baseline,value,key,frKey,otherKey});
  await page.goto('/?point-version-conflict=1#/points/point-1?lang=en');
  const editor=page.locator('.point-translations-editor');
  const title=editor.getByLabel('Título',{exact:true});
  await expect(title).toHaveValue('Original EN');
  await expect(title).toBeDisabled();
  await expect(editor.getByRole('alert')).toContainText('A base no servidor mudou');
  await editor.getByRole('button',{name:'Restaurar mesmo assim',exact:true}).click();
  await expect(title).toHaveValue('Minha revisão EN');
  page.once('dialog',dialog=>dialog.dismiss());
  await editor.getByRole('button',{name:'Gerar tradução IA',exact:true}).click();
  await expect(title).toHaveValue('Minha revisão EN');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(title).toHaveValue('Minha revisão EN');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),frKey)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),otherKey)).not.toBeNull();
});
test('point translation quota failure is explicit and editing remains usable',async ({page})=>{
  await page.addInitScript(()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.includes(':point-translations:'))throw new DOMException('Quota','QuotaExceededError');return set.call(this,key,value);};
  });
  await page.goto('/?point-version-quota=1#/points/point-1?lang=en');
  const editor=page.locator('.point-translations-editor');
  const title=editor.getByLabel('Título',{exact:true});
  await title.fill('Posso continuar');
  await expect(editor.getByRole('alert')).toContainText('não permite guardar o rascunho local');
  await expect(title).toHaveValue('Posso continuar');
  await expect(title).toBeEnabled();
  await expect(editor.getByText(/cópia neste navegador por até sete dias/)).toHaveCount(0);
});
test('point parent save prevents a concurrent translation request',async ({page})=>{
  let translationWrites=0;
  let finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  await page.route('**/api/v1/admin/points/point-1',async route=>{await gate;await route.fulfill({status:503,json:{detail:'Unavailable'}});});
  await page.route('**/api/v1/admin/points/point-1/translations/en',route=>{translationWrites++;return route.fulfill({status:503,json:{detail:'Unexpected concurrent write'}});});
  await page.goto('/?parent-save-lock=1#/points/point-1?lang=en');
  await page.getByLabel('Título PT',{exact:true}).fill('Correção do ponto');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByLabel('Título PT',{exact:true})).toBeDisabled();
  page.once('dialog',dialog=>{expect(dialog.type()).toBe('alert');return dialog.dismiss();});
  await page.locator('.point-translations-editor').getByRole('button',{name:'Guardar tradução',exact:true}).click();
  expect(translationWrites).toBe(0);
  finish();
  await expect(page.getByLabel('Título PT',{exact:true})).toBeEnabled();
  await expect(page.getByLabel('Título PT',{exact:true})).toHaveValue('Correção do ponto');
});
test('point translation draft survives expired session without replaying its save',async ({page})=>{
  let writes=0;
  await page.route('**/api/v1/admin/points/point-1/translations/en',route=>{
    writes++;
    if(writes===1)return route.fulfill({status:401,json:{detail:'Expired'}});
    expect(route.request().headers().authorization).toBe('Bearer resumed-point-token');
    return route.fulfill({json:{data:{id:'t',point_id:'point-1',lang:'en',...route.request().postDataJSON()},meta:{}}});
  });
  await page.route('**/api/v1/admin/auth/login',route=>route.fulfill({json:{data:{access_token:'resumed-point-token',token_type:'bearer'},meta:{}}}));
  await page.goto('/?point-session-recovery=1#/points/point-1?lang=en');
  const editor=page.locator('.point-translations-editor');
  const title=editor.getByLabel('Título',{exact:true});
  await title.fill('Trabalho preservado');
  await editor.getByRole('button',{name:'Guardar tradução',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sessão expirada',exact:true})).toBeVisible();
  await expect(editor).toBeHidden();
  await page.getByLabel('Senha',{exact:true}).fill('local-point-password');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(title).toHaveValue('Trabalho preservado');
  await expect(editor).toBeVisible();
  expect(writes).toBe(1);
  await editor.getByRole('button',{name:'Guardar tradução',exact:true}).click();
  await expect(editor.getByRole('status')).toContainText('Tradução guardada no servidor.');
  expect(writes).toBe(2);
});
test('deleting a point removes only its translation copies',async ({page})=>{
  const key='ecosdelisboa.editor-draft:v1:admin:point-translations:point-1:';
  const otherKey='ecosdelisboa.editor-draft:v1:other:point-translations:point-1:en';
  await page.addInitScript(({key,otherKey})=>{localStorage.setItem(key+'en','unused-copy');localStorage.setItem(key+'fr','unused-copy');localStorage.setItem(otherKey,'keep');},{key,otherKey});
  await page.route('**/api/v1/admin/points/point-1',route=>route.fulfill({json:{data:{deleted:true},meta:{}}}));
  await page.goto('/?point-delete-copies=1#/points');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Apagar',exact:true}).click();
  await expect(page.locator('.editor-message')).toContainText('Registo apagado.');
  expect(await page.evaluate(key=>Object.keys(localStorage).filter(item=>item.startsWith(key)),key)).toEqual([]);
  expect(await page.evaluate(key=>localStorage.getItem(key),otherKey)).toBe('keep');
});
for (const width of [390,1366]) {
  test(`point translation recovery isolates EN FR and parent save at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    let writes=0;
    let savedPoint={...point};
    await page.route('**/api/v1/admin/points',route=>route.fulfill({json:{data:[savedPoint],meta:{}}}));
    await page.route('**/api/v1/admin/points/point-1',route=>{
      writes++;
      savedPoint={...savedPoint,...route.request().postDataJSON()};
      return route.fulfill({json:{data:savedPoint,meta:{}}});
    });
    await page.route('**/api/v1/admin/points/point-1/translations/en',route=>{
      writes++;
      return route.fulfill({json:{data:{id:'t',point_id:'point-1',lang:'en',...route.request().postDataJSON()},meta:{}}});
    });
    await page.goto('/?point-language-recovery=1#/points/point-1?lang=en');
    const editor=page.locator('.point-translations-editor');
    const title=editor.getByLabel('Título',{exact:true});
    await expect(title).toHaveValue('Original EN');
    await title.fill('Correção EN');
    await editor.getByRole('textbox',{name:'Descrição',exact:true}).fill('Descrição EN');
    await editor.getByRole('tab',{name:'FR',exact:true}).click();
    await title.fill('Correção FR');
    const enKey='ecosdelisboa.editor-draft:v1:admin:point-translations:point-1:en';
    const frKey=enKey.replace(/:en$/,':fr');
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),frKey)).toContain('Correção FR');
    await editor.getByRole('tab',{name:'EN',exact:true}).click();
    await expect(title).toHaveValue('Correção EN');
    await expect(editor.getByRole('button',{name:'Restaurar rascunho',exact:true})).toHaveCount(0);
    page.on('dialog',dialog=>dialog.accept());
    await page.reload();
    await expect(title).toBeDisabled();
    await editor.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
    await expect(title).toHaveValue('Correção EN');
    await expect(title).toBeFocused();
    await expect(editor.getByRole('textbox',{name:'Descrição',exact:true})).toHaveValue('Descrição EN');
    expect(writes).toBe(0);
    await editor.getByRole('tab',{name:'FR',exact:true}).click();
    await editor.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
    await expect(title).toHaveValue('Correção FR');
    await page.getByLabel('Título PT',{exact:true}).fill('Ponto-base corrigido');
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await expect(page.locator('.editor-message')).toContainText('Alterações guardadas');
    expect(writes).toBe(1);
    expect(await page.evaluate(key=>localStorage.getItem(key),enKey)).not.toBeNull();
    expect(await page.evaluate(key=>localStorage.getItem(key),frKey)).not.toBeNull();
    await editor.getByRole('tab',{name:'EN',exact:true}).click();
    await expect(title).toHaveValue('Correção EN');
    await editor.getByRole('button',{name:'Guardar tradução',exact:true}).click();
    await expect(editor.getByRole('status')).toContainText('Tradução guardada no servidor.');
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),enKey)).toBeNull();
    expect(await page.evaluate(key=>localStorage.getItem(key),frKey)).not.toBeNull();
    expect(writes).toBe(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
for (const width of [390,1366]) {
  test(`language draft recovery isolates EN FR and base saves at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    let writes=0;
    let texts=[...adminTexts];
    await page.route('**/api/v1/admin/texts**',route=>{
      if(route.request().method() === 'GET')return route.fulfill({json:{data:texts,meta:{}}});
      writes++;
      const saved={...texts[0],...route.request().postDataJSON()};
      texts=[saved,...texts.slice(1)];
      return route.fulfill({json:{data:saved,meta:{}}});
    });
    await page.route(`**/api/v1/admin/translations/${adminTexts[0].id}/en/manual`,route=>{
      writes++;
      const payload=route.request().postDataJSON();
      return route.fulfill({json:{data:{id:'translation-en',text_id:adminTexts[0].id,lang:'en',origin:'manual',...payload},meta:{}}});
    });
    await page.goto(`/?versions-reload=1#/texts/${adminTexts[0].id}?lang=en`);
    const editor=page.getByLabel('Editar texto',{exact:true});
    await expect(editor.getByRole('combobox',{name:'Autor',exact:true})).toHaveValue(adminTexts[0].author_id);
    await expect(editor.getByRole('combobox',{name:'Autor',exact:true}).locator('option:checked')).toContainText('indisponível');
    await editor.getByRole('textbox',{name:'Conteúdo EN',exact:true}).fill('EN não guardado');
    await editor.getByRole('tab',{name:/Francês/}).click();
    await editor.getByRole('textbox',{name:'Conteúdo FR',exact:true}).fill('FR não guardado');
    const enKey=`ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[0].id}:en`;
    const frKey=`ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[0].id}:fr`;
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),frKey)).toContain('FR não guardado');
    await editor.getByRole('tab',{name:/Inglês/}).click();
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('EN não guardado');
    await expect(editor.getByRole('button',{name:'Restaurar rascunho',exact:true})).toHaveCount(0);
    page.on('dialog',async dialog=>{await dialog.accept();});
    await page.reload();
    await expect(editor.getByRole('combobox',{name:'Autor',exact:true})).toHaveValue(adminTexts[0].author_id);
    await expect(editor.getByRole('button',{name:'Restaurar rascunho',exact:true})).toHaveCount(1);
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toBeDisabled();
    await editor.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('EN não guardado');
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toBeFocused();
    expect(writes).toBe(0);
    await editor.getByRole('tab',{name:/Francês/}).click();
    await editor.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
    await expect(editor.getByRole('textbox',{name:'Conteúdo FR',exact:true})).toHaveValue('FR não guardado');
    await editor.getByRole('tab',{name:/Português/}).click();
    await editor.getByRole('textbox',{name:'Conteúdo PT',exact:true}).fill('PT guardado separadamente');
    await editor.getByRole('button',{name:'Guardar alterações',exact:true}).click();
    await expect(editor.locator('.drawer-message')).toHaveText('Texto guardado.');
    expect(writes).toBe(1);
    expect(await page.evaluate(key=>localStorage.getItem(key),enKey)).not.toBeNull();
    expect(await page.evaluate(key=>localStorage.getItem(key),frKey)).not.toBeNull();
    await editor.getByRole('tab',{name:/Inglês/}).click();
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('EN não guardado');
    await editor.getByRole('button',{name:'Guardar versão manual',exact:true}).click();
    await expect(editor.getByText('Versão guardada.',{exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),enKey)).toBeNull();
    expect(await page.evaluate(key=>localStorage.getItem(key),frKey)).not.toBeNull();
    expect(writes).toBe(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('changed remote translation is not overwritten silently and confirmed discard clears only this record languages',async ({page})=>{
  const identity={userId:'admin',entity:'text-versions',id:adminTexts[0].id,language:'en'};
  const baseline={content:'Original anterior',phoneticContent:'',status:'pending'};
  const value={content:'Edição local antiga',phoneticContent:'Pronúncia local',status:'pending'};
  const key=`ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[0].id}:en`;
  const frKey=key.replace(/:en$/,':fr');
  const otherKey=key.replace(':admin:',':other:');
  await page.addInitScript(({identity,baseline,value,key,frKey,otherKey})=>{
    const entry={version:1,identity,baseline,value,savedAt:Date.now()};
    localStorage.setItem(key,JSON.stringify(entry));
    localStorage.setItem(frKey,JSON.stringify({...entry,identity:{...identity,language:'fr'}}));
    localStorage.setItem(otherKey,JSON.stringify({...entry,identity:{...identity,userId:'other'}}));
  },{identity,baseline,value,key,frKey,otherKey});
  await page.route('**/api/v1/admin/translations',route=>route.fulfill({json:{data:[{id:'remote-en',text_id:adminTexts[0].id,lang:'en',content:'Versão remota nova',phonetic_content:null,status:'approved',origin:'manual'}],meta:{}}}));
  let generations=0;
  await page.route(`**/api/v1/admin/translations/${adminTexts[0].id}/en`,route=>{generations++;return route.fulfill({status:503,json:{detail:'No generation expected'}});});
  await page.goto(`/?changed-version=1#/texts/${adminTexts[0].id}?lang=en`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  const content=editor.getByRole('textbox',{name:'Conteúdo EN',exact:true});
  await expect(content).toHaveValue('Versão remota nova');
  await expect(content).toBeDisabled();
  await expect(editor.getByRole('alert')).toContainText('A base no servidor mudou');
  await editor.getByRole('button',{name:'Restaurar mesmo assim',exact:true}).click();
  await expect(content).toHaveValue('Edição local antiga');
  await expect(editor.getByRole('combobox',{name:'Estado',exact:true})).toHaveValue('pending');
  page.once('dialog',dialog=>dialog.dismiss());
  await editor.getByRole('button',{name:'Gerar tradução IA',exact:true}).click();
  expect(generations).toBe(0);
  await expect(content).toHaveValue('Edição local antiga');
  page.once('dialog',dialog=>dialog.dismiss());
  await editor.getByRole('button',{name:'Fechar',exact:true}).click();
  await expect(content).toHaveValue('Edição local antiga');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  page.once('dialog',dialog=>dialog.accept());
  await editor.getByRole('button',{name:'Fechar',exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),frKey)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),otherKey)).not.toBeNull();
});
test('translation quota failure preserves editing without claiming a recoverable copy',async ({page})=>{
  await page.addInitScript(()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key.includes(':text-versions:'))throw new DOMException('Quota','QuotaExceededError');
      return set.call(this,key,value);
    };
  });
  await page.goto(`/?version-quota=1#/texts/${adminTexts[0].id}?lang=en`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  const content=editor.getByRole('textbox',{name:'Conteúdo EN',exact:true});
  await content.fill('Ainda posso editar');
  await expect(editor.getByRole('alert')).toContainText('não permite guardar o rascunho local');
  await expect(content).toHaveValue('Ainda posso editar');
  await expect(content).toBeEnabled();
  await expect(editor.getByText(/cópia neste navegador por até sete dias/)).toHaveCount(0);
});
test('source and translation recovery offers identify their scope and require separate choices',async ({page})=>{
  await page.goto(`/?combined-recovery=1#/texts/${adminTexts[0].id}?lang=pt`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  await editor.getByRole('textbox',{name:'Conteúdo PT',exact:true}).fill('Fonte em revisão');
  await editor.getByRole('tab',{name:/Inglês/}).click();
  await editor.getByRole('textbox',{name:'Conteúdo EN',exact:true}).fill('Tradução em revisão');
  const enKey=`ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[0].id}:en`;
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),enKey)).toContain('Tradução em revisão');
  page.on('dialog',dialog=>dialog.accept());
  await page.reload();
  const sourceOffer=editor.getByRole('alert',{name:'Recuperação de rascunho: Texto original e metadados',exact:true});
  const versionOffer=editor.getByRole('alert',{name:'Recuperação de rascunho: Tradução EN',exact:true});
  await expect(sourceOffer).toBeVisible();
  await expect(versionOffer).toBeVisible();
  await expect(versionOffer.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeDisabled();
  await sourceOffer.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(editor.getByText('Fonte em revisão',{exact:true})).toBeVisible();
  await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toBeDisabled();
  await versionOffer.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Tradução em revisão');
});
test('deleting a text clears its language copies without removing another record',async ({page})=>{
  const key=`ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[0].id}:`;
  const otherKey=`ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[1].id}:en`;
  await page.addInitScript(({key,otherKey})=>{
    localStorage.setItem(key+'en','unvisited-copy');localStorage.setItem(key+'fr','unvisited-copy');
    localStorage.setItem(otherKey,'keep-other-record');
  },{key,otherKey});
  await page.route(`**/api/v1/admin/texts/${adminTexts[0].id}`,route=>route.fulfill({json:{data:{deleted:true},meta:{}}}));
  await page.goto(`/?delete-version-copies=1#/texts/${adminTexts[0].id}?lang=pt`);
  const editor=page.getByLabel('Editar texto',{exact:true});
  await expect(editor.getByRole('textbox',{name:'Conteúdo PT',exact:true})).toHaveValue(adminTexts[0].content_pt);
  page.once('dialog',dialog=>dialog.accept());
  await editor.getByRole('button',{name:'Apagar texto',exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(key=>Object.keys(localStorage).filter(item=>item.startsWith(key)),key)).toEqual([]);
  expect(await page.evaluate(key=>localStorage.getItem(key),otherKey)).toBe('keep-other-record');
});
for (const width of [390,1366]) {
  for (const id of [adminTexts[0].id, 'new']) {
    test(`base text local recovery is explicit for ${id === 'new' ? 'creation' : 'editing'} at ${width}px`,async ({page})=>{
      await page.setViewportSize({width,height:844});
      let writes=0;
      await page.route('**/api/v1/admin/texts**',route=>{
        if(route.request().method() === 'GET')return route.fallback();
        writes++;
        return route.fulfill({status:503,json:{detail:'No writes expected'}});
      });
      await page.goto(`/?text-recovery=1#/texts/${id}`);
      const editor=page.getByLabel(id === 'new' ? 'Novo texto' : 'Editar texto',{exact:true});
      const content=editor.getByRole('textbox',{name:'Conteúdo PT',exact:true});
      await expect(content).toBeEnabled();
      if(id === 'new')await expect(editor.getByText('Não guardado',{exact:true})).toBeVisible();
      await content.fill('Texto que precisa sobreviver ao recarregamento');
      await editor.getByRole('textbox',{name:'Obra',exact:true}).fill('Obra em revisão');
      const key=`ecosdelisboa.editor-draft:v1:admin:texts:${id}:pt`;
      await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toContain('Obra em revisão');
      page.on('dialog',async dialog=>{await dialog.accept();});
      await page.reload();
      await expect(editor.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeVisible();
      await expect(content).toBeDisabled();
      await expect(editor.getByRole('button',{name:'Guardar alterações',exact:true})).toBeDisabled();
      await editor.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
      await expect(content).toHaveValue('Texto que precisa sobreviver ao recarregamento');
      await expect(content).toBeEnabled();
      await expect(editor.getByRole('textbox',{name:'Obra',exact:true})).toHaveValue('Obra em revisão');
      await expect(editor.getByRole('combobox',{name:'Ponto',exact:true})).toBeFocused();
      expect(writes).toBe(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
for (const item of [{entity:'points',id:'point-1',label:'Título PT',original:'Ponto QA',inactive:false},
  {entity:'points',id:'point-1',label:'Título PT',original:'Ponto QA',inactive:true},
  {entity:'point-types',id:'literary',label:'Nome em português',original:'Literário',inactive:false}]) {
  test(`local draft recovery preserves ${item.entity} main fields after reload${item.inactive?' with an inactive type':''}`,async ({page})=>{
    const loopErrors: string[]=[];
    page.on('console',message=>{if(message.text().includes('Maximum update depth'))loopErrors.push(message.text());});
    if(item.inactive)await page.route('**/api/v1/admin/point-types',route=>route.fulfill({json:{data:[{...point.point_type,is_active:false}],meta:{}}}));
    await page.goto(`/?recover-${item.entity}=1#/${item.entity}/${item.id}`);
    const field=page.getByLabel(item.label,{exact:true});
    await expect(field).toHaveValue(item.original);
    await field.fill('Correção recuperável');
    const key=`ecosdelisboa.editor-draft:v1:admin:${item.entity}:${item.id}:pt`;
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toContain('Correção recuperável');
    page.on('dialog',async dialog=>{await dialog.accept();});
    await page.reload();
    await expect(page.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeVisible();
    await expect(field).toBeDisabled();
    await page.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
    await expect(field).toHaveValue('Correção recuperável');
    if(item.inactive)await expect(page.getByRole('combobox',{name:'Tipo de ponto',exact:true})).toHaveValue('literary');
    await field.fill('Ainda editável após restaurar');
    await expect(field).toHaveValue('Ainda editável após restaurar');
    expect(loopErrors).toEqual([]);
  });
}
for (const width of [390,1366]) {
  test(`local author draft restores explicitly after reload without a server write at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    let writes=0;
    await page.route('**/api/v1/admin/authors/author',route=>{
      writes++;
      return route.fulfill({json:{data:{id:'author',...route.request().postDataJSON()},meta:{}}});
    });
    await page.goto('/?local-recovery=1#/authors/author');
    const name=page.getByRole('textbox',{name:'Nome',exact:true});
    await expect(name).toHaveValue('Autor QA');
    await name.fill('Rascunho recuperável');
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Rascunho recuperável');
    page.on('dialog',async dialog=>{await dialog.accept();});
    await page.reload();
    await expect(page.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeVisible();
    await expect(name).toBeDisabled();
    await expect(name).toHaveValue('Autor QA');
    expect(writes).toBe(0);
    await page.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
    await expect(name).toHaveValue('Rascunho recuperável');
    await expect(name).toBeEnabled();
    await expect(name).toBeFocused();
    await expect(page.getByRole('status')).toContainText('Ainda não foi guardado no servidor');
    expect(writes).toBe(0);
    await page.getByRole('button',{name:'Guardar',exact:true}).click();
    await expect.poll(()=>writes).toBe(1);
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toBeNull();
  });
}
for(const width of [360,1366])test(`resource save and exit waits for confirmation with keyboard cancellation at ${width}`,async ({page})=>{
  await page.setViewportSize({width,height:600});
  let writes=0,finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  await page.route('**/api/v1/admin/authors/author',async route=>{
    writes++;await gate;return route.fulfill({json:{data:{id:'author',...route.request().postDataJSON()},meta:{}}});
  });
  await page.goto('/?save-exit=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await name.fill('Save before leaving');
  const clear=page.getByRole('button',{name:'Limpar',exact:true});
  await clear.click();
  const dialog=page.getByRole('dialog',{name:'Alterações não guardadas'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Continuar a editar',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button',{name:'Descartar alterações',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'Continuar a editar',exact:true})).toBeFocused();
  const bounds=await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(clear).toBeFocused();
  await expect(name).toHaveValue('Save before leaving');
  expect(writes).toBe(0);
  await clear.click();
  await dialog.getByRole('button',{name:'Guardar e sair',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('A guardar');
  await expect(dialog.getByRole('button',{name:'Continuar a editar',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#\/authors\/author$/);
  expect(writes).toBe(1);
  finish();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/#\/authors$/);
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toBeNull();
  expect(writes).toBe(1);
});
for(const target of [{resource:'points',id:'point-1',field:'Título PT',original:'Ponto QA',saved:point},
  {resource:'point-types',id:'literary',field:'Nome em português',original:'Literário',saved:point.point_type}])test(`save and exit persists ${target.resource} without editorial child writes`,async ({page})=>{
  let writes=0;
  const paths:string[]=[];
  page.on('request',request=>{if(request.method()!=='GET' && new URL(request.url()).pathname.startsWith('/api/v1/admin/'))paths.push(new URL(request.url()).pathname);});
  await page.route(`**/api/v1/admin/${target.resource}/${target.id}`,route=>{
    writes++;return route.fulfill({json:{data:{...target.saved,...route.request().postDataJSON()},meta:{}}});
  });
  await page.goto(`/?resource-exit=1#/${target.resource}/${target.id}`);
  await expect(page.getByRole('textbox',{name:target.field,exact:true})).toHaveValue(target.original);
  await page.getByRole('textbox',{name:target.field,exact:true}).fill('Explicit base save');
  await expect(page.getByRole('textbox',{name:target.field,exact:true})).toHaveValue('Explicit base save');
  await page.getByRole('button',{name:'Limpar',exact:true}).click();
  await page.getByRole('dialog',{name:'Alterações não guardadas'}).getByRole('button',{name:'Guardar e sair',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`#/${target.resource}$`));
  expect(writes).toBe(1);
  expect(paths).toEqual([`/api/v1/admin/${target.resource}/${target.id}`]);
});
test('save and exit failure keeps draft and dialog until explicit retry or cancellation',async ({page})=>{
  await page.goto('/?failed-save-exit=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await name.fill('Keep failed exit');
  await page.getByRole('button',{name:'Limpar',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Alterações não guardadas'});
  await dialog.getByRole('button',{name:'Guardar e sair',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('A edição continua aberta');
  await expect(page).toHaveURL(/#\/authors\/author$/);
  await expect(name).toHaveValue('Keep failed exit');
  expect(await page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Keep failed exit');
  await dialog.getByRole('button',{name:'Continuar a editar',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue('Keep failed exit');
});
test('save and exit session expiry releases the modal for login without automatic replay',async ({page})=>{
  let writes=0;
  await page.route('**/api/v1/admin/authors/author',route=>{
    writes++;
    if(writes===1)return route.fulfill({status:401,json:{detail:'Expired'}});
    return route.fulfill({json:{data:{id:'author',...route.request().postDataJSON()},meta:{}}});
  });
  await page.route('**/api/v1/admin/auth/login',route=>route.fulfill({json:{data:{access_token:'save-exit-resumed',token_type:'bearer'},meta:{}}}));
  await page.goto('/?expired-save-exit=1#/authors/author');
  await page.getByRole('textbox',{name:'Nome',exact:true}).fill('Preserved on expired exit');
  await page.getByRole('button',{name:'Limpar',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Alterações não guardadas'});
  await dialog.getByRole('button',{name:'Guardar e sair',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sessão expirada',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Email',exact:true})).toBeFocused();
  await page.getByLabel('Senha',{exact:true}).fill('local-test-only');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText('nenhuma gravação será repetida automaticamente');
  expect(writes).toBe(1);
  await dialog.getByRole('button',{name:'Continuar a editar',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Nome',exact:true})).toHaveValue('Preserved on expired exit');
  expect(writes).toBe(1);
});
test('exit with point translation drafts never silently approves or writes the parent',async ({page})=>{
  let writes=0;
  await page.route('**/api/v1/admin/points/point-1**',route=>{
    if(route.request().method()!=='GET'){writes++;return route.fulfill({status:503,json:{detail:'Unexpected'}});}
    return route.fallback();
  });
  await page.goto('/?translation-save-exit=1#/points/point-1?lang=en');
  await page.locator('.point-translations-editor').getByRole('textbox',{name:'Título',exact:true}).fill('Explicit review needed');
  await page.getByRole('button',{name:'Limpar',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Alterações não guardadas'});
  await expect(dialog).toContainText('ação editorial própria');
  await expect(dialog.getByRole('button',{name:'Guardar e sair',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Continuar a editar',exact:true}).click();
  expect(writes).toBe(0);
});
test('exit discard removes only current copies without saving',async ({page})=>{
  await page.goto('/?discard-exit=1#/authors/author');
  await page.getByRole('textbox',{name:'Nome',exact:true}).fill('Discard explicitly');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).not.toBeNull();
  const other=authorDraftKey.replace(':admin:',':other:');
  await page.evaluate(({key,other})=>localStorage.setItem(other,localStorage.getItem(key)!),{key:authorDraftKey,other});
  await page.getByRole('button',{name:'Limpar',exact:true}).click();
  await page.getByRole('dialog',{name:'Alterações não guardadas'}).getByRole('button',{name:'Descartar alterações',exact:true}).click();
  await expect(page).toHaveURL(/#\/authors$/);
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),other)).not.toBeNull();
});
test('recovery warns about changed remote content and never applies the draft silently',async ({page})=>{
  let remoteName='Autor QA';
  await page.route('**/api/v1/admin/authors',route=>route.fulfill({json:{data:[{id:'author',name:remoteName,bio_pt:'Biografia QA'}],meta:{}}}));
  await page.goto('/?remote-draft-base=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Edição antiga');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Edição antiga');
  remoteName='Nome atualizado no servidor';
  page.on('dialog',async dialog=>{await dialog.accept();});
  await page.reload();
  await expect(name).toHaveValue(remoteName);
  await expect(page.getByRole('alert')).toContainText('A base no servidor mudou');
  await page.getByRole('button',{name:'Restaurar mesmo assim',exact:true}).click();
  await expect(name).toHaveValue('Edição antiga');
});
test('discard cancellation retains the local copy and accepted navigation removes it',async ({page})=>{
  await page.goto('/?discard-local-draft=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Não perder no cancelamento');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Não perder');
  page.once('dialog',async dialog=>{await dialog.dismiss();});
  await page.getByRole('button',{name:'Pontos',exact:true}).click();
  await expect(name).toHaveValue('Não perder no cancelamento');
  expect(await page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).not.toBeNull();
  page.once('dialog',async dialog=>{await dialog.accept();});
  await page.getByRole('button',{name:'Pontos',exact:true}).click();
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toBeNull();
});
test('a different authenticated account cannot see or restore another account draft',async ({page})=>{
  let userId='admin';
  await page.route('**/api/v1/admin/auth/me',route=>route.fulfill({json:{data:{id:userId,email:'qa@example.com',is_active:true},meta:{}}}));
  await page.goto('/?identity-local-draft=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Somente primeira conta');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Somente primeira');
  userId='other';
  page.on('dialog',async dialog=>{await dialog.accept();});
  await page.reload();
  await expect(name).toHaveValue('Autor QA');
  await expect(page.getByRole('button',{name:'Restaurar rascunho',exact:true})).toHaveCount(0);
  await expect(name).toBeEnabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).not.toBeNull();
  userId='admin';
  await page.reload();
  await expect(page.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Descartar rascunho local',exact:true}).click();
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toBeNull();
  await expect(name).toHaveValue('Autor QA');
});
test('logout clears only the current account copies and never persists credentials in drafts',async ({page})=>{
  await page.goto('/?logout-local-draft=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Limpar ao sair');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Limpar ao sair');
  const raw=await page.evaluate(key=>localStorage.getItem(key),authorDraftKey);
  expect(raw).not.toContain('audit-fixture');
  await page.evaluate(()=>localStorage.setItem('ecosdelisboa.editor-draft:v1:other:authors:author:pt','other-copy'));
  page.once('dialog',async dialog=>{await dialog.accept();});
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toBeNull();
  expect(await page.evaluate(()=>localStorage.getItem('ecosdelisboa.editor-draft:v1:other:authors:author:pt'))).toBe('other-copy');
});
test('quota failure warns without breaking editing or pretending the draft is recoverable',async ({page})=>{
  await page.goto('/?draft-quota=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await expect(name).toBeEnabled();
  await page.evaluate(()=>{
    const setItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.startsWith('ecosdelisboa.editor-draft:'))throw new DOMException('Quota','QuotaExceededError');setItem.call(this,key,value);};
  });
  await name.fill('Continua na aba sem cópia local');
  await expect(page.getByRole('alert')).toContainText('não permite guardar o rascunho local');
  await expect(name).toHaveValue('Continua na aba sem cópia local');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Não foi possível guardar');
  await expect(name).toHaveValue('Continua na aba sem cópia local');
});
test('failed local cleanup is disclosed after logout rather than claiming the copies were removed',async ({page})=>{
  await page.goto('/?draft-cleanup-failure=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Cópia que o navegador não deixa apagar');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).toContain('Cópia que');
  await page.evaluate(()=>{
    const removeItem=Storage.prototype.removeItem;
    Storage.prototype.removeItem=function(key){if(key.startsWith('ecosdelisboa.editor-draft:'))throw new DOMException('Blocked','SecurityError');removeItem.call(this,key);};
  });
  page.once('dialog',async dialog=>{await dialog.accept();});
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Não foi possível apagar');
  expect(await page.evaluate(key=>localStorage.getItem(key),authorDraftKey)).not.toBeNull();
  expect(await page.evaluate(()=>localStorage.getItem('ecosdelisboa.admin.token'))).toBeNull();
});
for (const width of [390,1366]) {
  test(`expired session preserves source and language drafts and rejects another identity at ${width}px`,async ({page})=>{
    await page.setViewportSize({width,height:844});
    let writes=0;
    let logins=0;
    let authorization='';
    await page.route(`**/api/v1/admin/texts/${adminTexts[0].id}`,async route=>{
      if (route.request().method() !== 'PUT') return route.fallback();
      writes++;
      authorization=route.request().headers().authorization;
      if (writes===1) return route.fulfill({status:401,json:{detail:'Expired'}});
      return route.fulfill({json:{data:{...adminTexts[0],...route.request().postDataJSON()},meta:{}}});
    });
    await page.route('**/api/v1/admin/auth/login',route=>{
      logins++;
      return route.fulfill({json:{data:{access_token:logins===1?'foreign-token':logins===2?'inactive-token':'renewed-token',token_type:'bearer'},meta:{}}});
    });
    await page.route('**/api/v1/admin/auth/me',route=>route.fulfill({json:{data:{id:route.request().headers().authorization==='Bearer foreign-token'?'other':'admin',email:'audit@example.com',is_active:route.request().headers().authorization!=='Bearer inactive-token'},meta:{}}}));
    await page.goto(`/#/texts/${adminTexts[0].id}?lang=en`);
    const editor=page.getByLabel('Editar texto',{exact:true});
    await editor.getByRole('textbox',{name:'Conteúdo EN',exact:true}).fill('Rascunho EN durante expiração');
    await editor.getByRole('tab',{name:/Português/}).click();
    await editor.getByRole('textbox',{name:'Conteúdo PT',exact:true}).fill('Rascunho PT durante expiração');
    await editor.getByRole('button',{name:'Guardar alterações',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Sessão expirada',exact:true})).toBeVisible();
    await expect(editor).toBeHidden();
    await expect(page.getByLabel('Email',{exact:true})).toBeFocused();
    await page.getByLabel('Senha',{exact:true}).fill('local-password-only');
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('mesma conta');
    expect(await page.evaluate(()=>localStorage.getItem('ecosdelisboa.admin.token'))).toBeNull();
    expect(writes).toBe(1);
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('mesma conta');
    expect(await page.evaluate(()=>localStorage.getItem('ecosdelisboa.admin.token'))).toBeNull();
    expect(writes).toBe(1);
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('textbox',{name:'Conteúdo PT',exact:true})).toHaveValue('Rascunho PT durante expiração');
    await editor.getByRole('tab',{name:/Inglês/}).click();
    await expect(editor.getByRole('textbox',{name:'Conteúdo EN',exact:true})).toHaveValue('Rascunho EN durante expiração');
    expect(writes).toBe(1);
    await editor.getByRole('button',{name:'Guardar alterações',exact:true}).click();
    await expect(editor.locator('.drawer-message')).toHaveText('Texto guardado.');
    expect(authorization).toBe('Bearer renewed-token');
    expect(writes).toBe(2);
    const entries=await page.evaluate(()=>Object.entries(localStorage));
    expect(entries.filter(([key])=>!key.startsWith('ecosdelisboa.editor-draft:v1:')).map(([,value])=>value).join(' ')).not.toContain('Rascunho');
    const en=entries.find(([key])=>key === `ecosdelisboa.editor-draft:v1:admin:text-versions:${adminTexts[0].id}:en`);
    expect(JSON.parse(en![1]).value).toEqual({content:'Rascunho EN durante expiração',phoneticContent:'',status:'pending'});
    const storage=entries.map(([,value])=>value).join(' ');
    expect(storage).not.toContain('local-password-only');
    expect(en![1]).not.toContain('renewed-token');
  });
}
test('permission failure does not log out or discard the author draft',async ({page})=>{
  await page.route('**/api/v1/admin/authors/author',route=>route.fulfill({status:403,json:{detail:'Forbidden'}}));
  await page.goto('/#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Rascunho sem permissão');
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(name).toHaveValue('Rascunho sem permissão');
  await expect(page.getByRole('button',{name:'Entrar',exact:true})).toHaveCount(0);
  await expect(page.locator('.editor-message[role="status"]')).toContainText('Você não tem permissão');
});
test('session resumes with blocked storage and discard still requires confirmation',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/v1/admin/authors/author',route=>route.fulfill({status:401,json:{detail:'Expired'}}));
  await page.route('**/api/v1/admin/auth/login',route=>route.fulfill({json:{data:{access_token:'memory-renewed',token_type:'bearer'},meta:{}}}));
  await page.goto('/#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toHaveValue('Autor QA');
  await name.fill('Rascunho em memória');
  await expect(name).toHaveValue('Rascunho em memória');
  await page.evaluate(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sessão expirada',exact:true})).toBeVisible();
  await expect(page.locator('.resource-editing-fields input').first()).toHaveValue('Rascunho em memória');
  page.once('dialog',async dialog=>{expect(dialog.type()).toBe('confirm');await dialog.dismiss();});
  await page.getByRole('button',{name:'Descartar edição e sair',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sessão expirada',exact:true})).toBeVisible();
  await page.getByLabel('Senha',{exact:true}).fill('local-password-only');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(name).toHaveValue('Rascunho em memória');
  await expect(page.getByText('Este navegador não permite manter a sessão após recarregar.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Sessão expirada',exact:true})).toBeVisible();
  page.once('dialog',async dialog=>{await dialog.accept();});
  await page.getByRole('button',{name:'Descartar edição e sair',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Lisboa por Outros',exact:true})).toBeVisible();
  await expect(name).toHaveCount(0);
});
test('direct record loading disables fields until the selected draft is initialized',async ({page})=>{
  let finish: () => void = () => {};
  const gate = new Promise<void>(resolve=>{finish=resolve;});
  await page.route('**/api/v1/admin/authors',async route=>{
    await gate;
    await route.fulfill({json:{data:[{id:'author',name:'Autor carregado'}],meta:{}}});
  });
  // New document, not a hash-only transition from beforeEach's create form.
  await page.goto('/?direct-record-loading=1#/authors/author');
  const name=page.getByRole('textbox',{name:'Nome',exact:true});
  await expect(name).toBeDisabled();
  await expect(page.locator('.editor button[type="submit"]')).toBeDisabled();
  finish();
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue('Autor carregado');
  await name.fill('Edição após carregamento');
  await expect(name).toHaveValue('Edição após carregamento');
});
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
      expect(route.request().postDataJSON().auto_approve_translations).toBe(false);
      await gate;
      await route.fulfill({status:503,json:{detail:'Unavailable'}});
    });
    await page.getByRole('button',{name:'Textos',exact:true}).click();
    await page.getByRole('checkbox',{name:'Selecionar resultados',exact:true}).check();
    const invoker=page.getByRole('button',{name:'Gerar conteúdo',exact:true});
    await invoker.click();
    const editor=page.getByLabel('Gerar conteúdo em lote',{exact:true});
    await expect(editor.getByRole('heading',{name:'Gerar conteúdo',exact:true})).toBeFocused();
    await expect(editor.getByRole('checkbox',{name:/Aprovar traduções automaticamente/})).toHaveCount(0);
    await expect(editor.getByText(/As traduções geradas ficam pendentes de revisão/)).toBeVisible();
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
  await expect(editor.locator('.drawer-message')).toHaveText('Não foi possível guardar o texto.');
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
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Rascunho EN');
  await editor.getByRole('tab',{name:'FR',exact:true}).click();
  await expect(editor.getByRole('tab',{name:'FR',exact:true})).toHaveAttribute('aria-selected','true');
  await editor.getByLabel('Título',{exact:true}).fill('Rascunho FR');
  await expect(editor.getByLabel('Título',{exact:true})).toHaveValue('Rascunho FR');
  await editor.getByRole('tab',{name:'EN',exact:true}).click();
  await expect(editor.getByRole('tab',{name:'EN',exact:true})).toHaveAttribute('aria-selected','true');
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
for (const width of [390, 1366]) test(`route metadata recovery is explicit and clears only after review at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:844});
  let writes=0;
  await page.route('**/api/v1/admin/routes/*/translations**',r=>{
    if(r.request().method()==='PUT') { writes++; return r.fulfill({json:{data:{...r.request().postDataJSON(),id:'metadata-en',lang:'en'},meta:{}}}); }
    return r.fulfill({json:{data:[],meta:{}}});
  });
  await page.goto(`/?metadata-recovery=1#/routes/${publicRoute.id}?lang=en`);
  const editor=page.getByRole('region',{name:'Metadados em inglês',exact:true});
  await editor.getByRole('textbox',{name:'Título EN',exact:true}).fill('Local EN route title');
  await editor.getByRole('textbox',{name:'Descrição EN',exact:true}).fill('Description awaiting review');
  const key='ecosdelisboa.editor-draft:v1:admin:route-metadata:route-e2e:en';
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  await page.reload();
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toBeDisabled();
  await editor.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toHaveValue('Local EN route title');
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toBeFocused();
  await expect(editor.getByRole('textbox',{name:'Descrição EN',exact:true})).toHaveValue('Description awaiting review');
  expect(writes).toBe(0);
  await editor.getByRole('button',{name:'Rever e guardar metadados EN',exact:true}).click();
  await expect(editor.getByText('Metadados EN revistos e guardados.')).toBeVisible();
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(writes).toBe(1);
});
test('route metadata review blocks a concurrent narrative save', async ({page}) => {
  let parentWrites=0, finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  await page.route('**/api/v1/admin/routes/*/translations**',async r=>{
    if(r.request().method()==='PUT') {await gate;return r.fulfill({status:503,json:{detail:'Unavailable'}});}
    return r.fulfill({json:{data:[],meta:{}}});
  });
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,r=>{parentWrites++;return r.fulfill({status:503,json:{detail:'Unexpected write'}});});
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await page.getByRole('textbox',{name:'Título EN',exact:true}).fill('Unfinished review');
  await page.getByRole('button',{name:'Rever e guardar metadados EN',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Título EN',exact:true})).toBeDisabled();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Guardar percurso',exact:true}).click();
  expect(parentWrites).toBe(0);
  finish();
  await expect(page.getByRole('textbox',{name:'Título EN',exact:true})).toBeEnabled();
  await expect(page.getByRole('textbox',{name:'Título EN',exact:true})).toHaveValue('Unfinished review');
});
test('route metadata recovery warns about changed base and permission failure preserves the copy', async ({page}) => {
  const identity={userId:'admin',entity:'route-metadata',id:'route-e2e',language:'en'};
  const key='ecosdelisboa.editor-draft:v1:admin:route-metadata:route-e2e:en';
  const other=key.replace(':admin:',':other:');
  await page.addInitScript(({identity,key,other})=>{
    const entry={version:1,identity,baseline:{title:'Old',description:''},value:{title:'Local revision',description:'Local description'},savedAt:Date.now()};
    localStorage.setItem(key,JSON.stringify(entry));
    localStorage.setItem(other,JSON.stringify({...entry,identity:{...identity,userId:'other'}}));
  },{identity,key,other});
  await page.route('**/api/v1/admin/routes/*/translations**',r=>r.request().method()==='PUT'
    ? r.fulfill({status:403,json:{detail:'Forbidden'}})
    : r.fulfill({json:{data:[{id:'en',lang:'en',title:'Remote update',description:'',status:'approved'}],meta:{}}}));
  await page.goto(`/?metadata-conflict=1#/routes/${publicRoute.id}`);
  const editor=page.getByRole('region',{name:'Metadados em inglês',exact:true});
  await expect(editor.getByRole('alert')).toContainText('A base no servidor mudou');
  await editor.getByRole('button',{name:'Restaurar mesmo assim',exact:true}).click();
  await editor.getByRole('button',{name:'Rever e guardar metadados EN',exact:true}).click();
  await expect(editor.getByRole('alert')).toContainText('permissão');
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toHaveValue('Local revision');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(editor).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),other)).not.toBeNull();
});
test('route metadata quota failure does not promise recovery or prevent editing', async ({page}) => {
  await page.addInitScript(()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.includes(':route-metadata:'))throw new DOMException('Quota','QuotaExceededError');return set.call(this,key,value);};
  });
  await page.goto(`/?metadata-quota=1#/routes/${publicRoute.id}`);
  const editor=page.getByRole('region',{name:'Metadados em inglês',exact:true});
  await editor.getByRole('textbox',{name:'Título EN',exact:true}).fill('Editable without storage');
  await expect(editor.getByRole('alert')).toContainText('não permite guardar o rascunho local');
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toHaveValue('Editable without storage');
  await expect(editor.getByText(/cópia neste navegador por até sete dias/)).toHaveCount(0);
});
test('route metadata initial error blocks review and explicit retry restores editing',async ({page})=>{
  await page.route('**/api/v1/admin/routes/*/translations**',r=>r.fulfill({status:503,json:{detail:'Unavailable'}}));
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  const editor=page.getByRole('region',{name:'Metadados em inglês',exact:true});
  await expect(editor.getByRole('alert')).toContainText('Não foi possível carregar');
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toBeDisabled();
  await expect(editor.getByRole('button',{name:'Rever e guardar metadados EN',exact:true})).toBeDisabled();
  await page.route('**/api/v1/admin/routes/*/translations**',r=>r.fulfill({json:{data:[],meta:{}}}));
  await editor.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(editor.getByRole('textbox',{name:'Título EN',exact:true})).toBeEnabled();
});
test('narrative save prevents concurrent route metadata review',async ({page})=>{
  let writes=0,finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,async r=>{await gate;await r.fulfill({status:503,json:{detail:'Unavailable'}});});
  await page.route('**/api/v1/admin/routes/*/translations**',r=>{
    if(r.request().method()==='PUT')writes++;
    return r.fulfill({json:{data:[],meta:{}}});
  });
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await page.getByRole('textbox',{name:'Título EN',exact:true}).fill('Waiting review');
  await page.getByRole('button',{name:'Guardar percurso',exact:true}).click();
  await expect(page.getByRole('button',{name:'A guardar…',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Rever e guardar metadados EN',exact:true})).toBeDisabled();
  await expect(page.getByRole('textbox',{name:'Título EN',exact:true})).toBeDisabled();
  expect(writes).toBe(0);
  finish();
  await expect(page.getByRole('button',{name:'Guardar percurso',exact:true})).toBeEnabled();
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
for (const width of [390,1366]) test(`bridge EN recovery after reload does not approve before explicit review at ${width}`,async ({page})=>{
  await page.setViewportSize({width,height:844});
  let writes=0;
  await page.route('**/api/v1/admin/routes/*/segments/*/translations/en',r=>{
    writes++;const body=r.request().postDataJSON();expect(body.status).toBe('approved');
    return r.fulfill({json:{data:{...body,id:'bridge-en',lang:'en'},meta:{}}});
  });
  await page.goto(`/?bridge-recovery=1#/routes/${publicRoute.id}`);
  await page.getByRole('textbox',{name:'Texto em inglês',exact:true}).fill('Bridge awaiting human review');
  const key='ecosdelisboa.editor-draft:v1:admin:route-bridge%3Aroute-e2e:intro:en';
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,r=>{
    const payload=r.request().postDataJSON();
    expect(payload.segments.map(segment=>segment.id)).toEqual(publicRoute.segments.map(segment=>segment.id));
    return r.fulfill({json:{data:{...publicRoute,title_pt:'Metadata saved',is_published:false,
      segments:publicRoute.segments.map(segment=>({...segment,bridge_content_pt:segment.kind==='bridge'?segment.content_pt:undefined}))},meta:{}}});
  });
  await page.getByRole('textbox',{name:'Título em português',exact:true}).fill('Metadata saved');
  await page.getByRole('button',{name:'Guardar percurso',exact:true}).click();
  await expect(page.locator('.route-status-line')).toContainText('Percurso guardado no servidor');
  await expect(page.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('Bridge awaiting human review');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  await page.reload();
  const editorial=page.locator('.route-bridge-editorial-card');
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toBeDisabled();
  await editorial.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('Bridge awaiting human review');
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toBeFocused();
  expect(writes).toBe(0);
  await editorial.getByRole('button',{name:'Rever e guardar EN',exact:true}).click();
  await expect(page.locator('.route-status-line')).toContainText('Ponte EN revista e guardada');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(writes).toBe(1);
  await expect(page.locator('.route-status-line .saved')).toHaveText('Guardado');
});
test('bridge recovery compares remote base and stage discard clears only this account and bridge',async ({page})=>{
  const identity={userId:'admin',entity:'route-bridge:route-e2e',id:'intro',language:'en'};
  const key='ecosdelisboa.editor-draft:v1:admin:route-bridge%3Aroute-e2e:intro:en',other=key.replace(':admin:',':other:');
  await page.addInitScript(({identity,key,other})=>{
    const entry={version:1,identity,baseline:{content:'Older EN'},value:{content:'My revision'},savedAt:Date.now()};
    localStorage.setItem(key,JSON.stringify(entry));localStorage.setItem(other,JSON.stringify({...entry,identity:{...identity,userId:'other'}}));
  },{identity,key,other});
  await page.goto(`/?bridge-conflict=1#/routes/${publicRoute.id}`);
  const editorial=page.locator('.route-bridge-editorial-card');
  await expect(editorial.getByRole('alert')).toContainText('A base no servidor mudou');
  await editorial.getByRole('button',{name:'Restaurar mesmo assim',exact:true}).click();
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('My revision');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('.narrative-card.text').first().click();
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('My revision');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.narrative-card.text').first().click();
  await expect(editorial).toHaveCount(0);
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),other)).not.toBeNull();
  await page.locator('.narrative-card.bridge').first().click();
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('');
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toBeEnabled();
});
for (const width of [390,1366]) test(`removing selected bridge confirms unsaved EN without losing cancellation at ${width}`,async ({page})=>{
  await page.setViewportSize({width,height:844});
  let writes=0;
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,r=>{writes++;return r.fulfill({status:503,json:{detail:'Unexpected write'}});});
  await page.goto(`/?bridge-removal=1#/routes/${publicRoute.id}`);
  const editorial=page.locator('.route-bridge-editorial-card');
  const input=editorial.getByRole('textbox',{name:'Texto em inglês',exact:true});
  const key='ecosdelisboa.editor-draft:v1:admin:route-bridge%3Aroute-e2e:intro:en';
  const other=key.replace(':admin:',':other:');
  await input.fill('Unsaved EN before removal');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  await page.evaluate(({key,other})=>localStorage.setItem(other,localStorage.getItem(key)!),{key,other});
  const cards=page.locator('.narrative-card');
  const count=await cards.count();
  const dialogs:string[]=[];
  page.once('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  await page.locator('.narrative-card.bridge').first().getByRole('button',{name:'Remover',exact:true}).click();
  await expect(cards).toHaveCount(count);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0]).toContain('ponte EN');
  await expect(input).toHaveValue('Unsaved EN before removal');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  page.once('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  await page.locator('.narrative-card.bridge').first().getByRole('button',{name:'Remover',exact:true}).click();
  await expect(cards).toHaveCount(count-1);
  await expect(editorial).toHaveCount(0);
  expect(dialogs).toHaveLength(2);
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),other)).not.toBeNull();
  expect(writes).toBe(0);
});
test('removing a bridge with an unrestored local copy requires confirmation',async ({page})=>{
  const identity={userId:'admin',entity:'route-bridge:route-e2e',id:'intro',language:'en'};
  const key='ecosdelisboa.editor-draft:v1:admin:route-bridge%3Aroute-e2e:intro:en';
  await page.addInitScript(({identity,key})=>localStorage.setItem(key,JSON.stringify({version:1,identity,
    baseline:{content:''},value:{content:'Not restored yet'},savedAt:Date.now()})),{identity,key});
  await page.goto(`/?bridge-candidate-removal=1#/routes/${publicRoute.id}`);
  const editorial=page.locator('.route-bridge-editorial-card');
  await expect(editorial.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeVisible();
  const count=await page.locator('.narrative-card').count();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('.narrative-card.bridge').first().getByRole('button',{name:'Remover',exact:true}).click();
  await expect(page.locator('.narrative-card')).toHaveCount(count);
  await expect(editorial.getByRole('button',{name:'Restaurar rascunho',exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('.narrative-card.bridge').first().getByRole('button',{name:'Remover',exact:true}).click();
  await expect(page.locator('.narrative-card')).toHaveCount(count-1);
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});
test('removing another stage preserves selected bridge EN without switching or prompting',async ({page})=>{
  await page.goto(`/?other-removal=1#/routes/${publicRoute.id}`);
  const input=page.getByRole('textbox',{name:'Texto em inglês',exact:true});
  await input.fill('Keep selected EN');
  const dialogs:string[]=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  const texts=page.locator('.narrative-card.text');
  const count=await texts.count();
  await texts.first().getByRole('button',{name:'Remover',exact:true}).click();
  await expect(texts).toHaveCount(count-1);
  await expect(input).toHaveValue('Keep selected EN');
  expect(dialogs).toEqual([]);
});
test('bridge quota warning preserves editing but does not claim recovery',async ({page})=>{
  await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes(':route-bridge%3A'))throw new DOMException('Quota','QuotaExceededError');return set.call(this,key,value);};});
  await page.goto(`/?bridge-quota=1#/routes/${publicRoute.id}`);
  const editorial=page.locator('.route-bridge-editorial-card');
  await editorial.getByRole('textbox',{name:'Texto em inglês',exact:true}).fill('Still editable');
  await expect(editorial.getByRole('alert')).toContainText('não permite guardar o rascunho local');
  await expect(editorial.getByRole('textbox',{name:'Texto em inglês',exact:true})).toHaveValue('Still editable');
  await expect(editorial.getByText(/cópia neste navegador por até sete dias/)).toHaveCount(0);
});
for (const width of [390,1366]) test(`bridge upload blocks navigation and concurrent writes until failure at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:844});
  let uploads=0,otherWrites=0,finish!:()=>void;
  const gate=new Promise<void>(resolve=>{finish=resolve;});
  await page.route('**/api/v1/admin/routes/*/segments/*/audio/pt/upload',async r=>{
    uploads++; await gate; await r.fulfill({status:503,json:{detail:'Unavailable'}});
  });
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,r=>{otherWrites++;return r.fulfill({status:503,json:{detail:'Unexpected write'}});});
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  const editorial=page.locator('.route-bridge-editorial-card');
  await expect(editorial).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await editorial.locator('input[type="file"]').first().setInputFiles({name:'review.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('synthetic audio test')});
  await expect.poll(()=>uploads).toBe(1);
  await expect(editorial.getByRole('status')).toContainText('A enviar MP3 PT');
  await expect(page.locator('.route-status-line')).toContainText('Operação em andamento');
  await expect(editorial.locator('input[type="file"]').first()).toBeDisabled();
  await expect(page.getByRole('button',{name:'Guardar percurso',exact:true})).toBeDisabled();
  page.once('dialog',dialog=>{expect(dialog.type()).toBe('alert');return dialog.dismiss();});
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(editorial).toBeVisible();
  expect(otherWrites).toBe(0);
  finish();
  await expect(editorial.locator('input[type="file"]').first()).toBeEnabled();
  await expect(page.locator('.route-status-line')).toContainText('Falha no upload');
  await expect(editorial.getByRole('alert')).toContainText('áudio anterior foi preservado');
  await expect(editorial.locator('.bridge-audio-row').first()).toContainText('gerado');
  await expect(editorial.locator('input[type="file"]').first()).toHaveValue('');
});
test('bridge upload cancellation sends nothing and the same file can retry after failure',async ({page})=>{
  let uploads=0;
  await page.route('**/api/v1/admin/routes/*/segments/*/audio/pt/upload',r=>{
    uploads++;
    expect(new URL(r.request().url()).pathname).toBe(`/api/v1/admin/routes/${publicRoute.id}/segments/intro/audio/pt/upload`);
    return uploads===1 ? r.fulfill({status:503,json:{detail:'Unavailable'}})
      : r.fulfill({json:{data:{id:'uploaded',lang:'pt',manually_uploaded:true,public_url:'/audio/reviewed.mp3'},meta:{}}});
  });
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  const editorial=page.locator('.route-bridge-editorial-card');
  const file=editorial.getByLabel('Enviar MP3 PT da ponte selecionada',{exact:true});
  const fixture={name:'same-review.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('synthetic test')};
  page.once('dialog',dialog=>{expect(dialog.message()).toContain('Substituir o áudio PT');return dialog.dismiss();});
  await file.setInputFiles(fixture);
  expect(uploads).toBe(0);
  await expect(file).toHaveValue('');
  page.once('dialog',dialog=>dialog.accept());
  await file.setInputFiles(fixture);
  await expect(page.locator('.route-status-line')).toContainText('Falha no upload');
  await expect(page.locator('.route-status-line')).toContainText('Selecione o ficheiro novamente');
  page.once('dialog',dialog=>dialog.accept());
  await file.setInputFiles(fixture);
  await expect(page.locator('.route-status-line')).toContainText('Áudio manual PT guardado e protegido');
  await expect(editorial.locator('.bridge-audio-row').first()).toContainText('manual protegido');
  await expect(page.locator('.bridge-preview-copy audio')).toHaveAttribute('src','/audio/reviewed.mp3');
  expect(uploads).toBe(2);
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

for (const width of [390,1366]) test(`route narrative recovery is explicit and stores no publication or media at ${width}`,async ({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto(`/?narrative-recovery=1#/routes/${publicRoute.id}`);
  await page.getByRole('textbox',{name:'Título em português',exact:true}).fill('Recover narrative');
  const key='ecosdelisboa.editor-draft:v1:admin:route-narrative:route-e2e:pt';
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  const raw=await page.evaluate(key=>localStorage.getItem(key)!,key);
  for(const forbidden of ['is_published','audio_files','translations','reviewed_by'])expect(raw).not.toContain(forbidden);
  await page.reload();
  const recovery=page.getByRole('alert',{name:'Recuperação de rascunho: Narrativa e waypoints'});
  await expect(recovery).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toBeDisabled();
  await recovery.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toHaveValue('Recover narrative');
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toBeFocused();
  await expect(page.getByRole('checkbox',{name:'Publicar',exact:true})).not.toBeChecked();
});
test('legacy route copy is sanitized and offered without restoring old publication',async ({page})=>{
  const oldKey='ecosdelisboa.route-draft.v2.admin.route-e2e';
  const narrative={title_pt:'Legacy local title',slug:'legacy',description_pt:'Legacy description',cover_image_url:'',difficulty:'easy',is_published:true,
    segments:publicRoute.segments.map(s=>({...s,bridge_content_pt:s.kind==='bridge'?s.content_pt:undefined}))};
  await page.addInitScript(({oldKey,narrative})=>{if(!sessionStorage.getItem('legacy-seeded')){
    localStorage.setItem(oldKey,JSON.stringify({version:2,narrative,waypoints:[]}));sessionStorage.setItem('legacy-seeded','1');}},{oldKey,narrative});
  await page.goto(`/?legacy-narrative=1#/routes/${publicRoute.id}`);
  const recovery=page.getByRole('alert',{name:'Recuperação de rascunho: Narrativa e waypoints'});
  await expect(recovery).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Cópia antiga convertida'})).toContainText('não tinha data nem base histórica');
  expect(await page.evaluate(key=>localStorage.getItem(key),oldKey)).toBeNull();
  await page.reload();
  await expect(page.getByRole('status').filter({hasText:'Cópia antiga convertida'})).toContainText('não tinha data nem base histórica');
  await recovery.getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toHaveValue('Legacy local title');
  await expect(page.getByRole('checkbox',{name:'Publicar',exact:true})).not.toBeChecked();
  await expect(page.locator('.visitor-preview-copy audio')).toHaveAttribute('src','/audio/intro.mp3');
});
test('narrative failure preserves editing; confirmed discard clears only this account',async ({page})=>{
  const key='ecosdelisboa.editor-draft:v1:admin:route-narrative:route-e2e:pt',other=key.replace(':admin:',':other:');
  await page.goto(`/?narrative-discard=1#/routes/${publicRoute.id}`);
  const title=page.getByRole('textbox',{name:'Título em português',exact:true});
  await title.fill('Keep failed narrative');
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  await page.evaluate(({key,other})=>localStorage.setItem(other,localStorage.getItem(key)!),{key,other});
  await page.getByRole('button',{name:'Guardar percurso',exact:true}).click();
  await expect(page.locator('.route-status-line')).toContainText('Não foi possível guardar');
  await expect(title).toHaveValue('Keep failed narrative');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect(title).toHaveValue('Keep failed narrative');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Autores',exact:true}).click();
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
  expect(await page.evaluate(key=>localStorage.getItem(key),other)).not.toBeNull();
});
test('narrative quota failure warns and retains the legacy source during conversion',async ({page})=>{
  await page.goto(`/?narrative-quota=1#/routes/${publicRoute.id}`);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
    if(key.includes(':route-narrative:'))throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};});
  const title=page.getByRole('textbox',{name:'Título em português',exact:true});
  await title.fill('Editable without storage');
  await expect(page.getByRole('alert').filter({hasText:'não permite guardar o rascunho local'})).toBeVisible();
  await expect(title).toHaveValue('Editable without storage');
  const oldKey='ecosdelisboa.route-draft.v2.admin.route-e2e';
  const narrative={title_pt:'Legacy kept',slug:'',description_pt:'',cover_image_url:'',difficulty:'easy',is_published:false,segments:[]};
  await page.evaluate(({oldKey,narrative})=>localStorage.setItem(oldKey,JSON.stringify({version:2,narrative,waypoints:[]})),{oldKey,narrative});
  await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){
    if(key.includes(':route-narrative:'))throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};});
  await page.reload();
  await expect(page.getByRole('alert').filter({hasText:'Não foi possível converter a cópia antiga'})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),oldKey)).toContain('Legacy kept');
});
test('narrative recovery compares remote base and restores without an automatic write',async ({page})=>{
  await page.goto(`/?narrative-base=1#/routes/${publicRoute.id}`);
  await page.getByRole('textbox',{name:'Título em português',exact:true}).fill('Local against old base');
  const key='ecosdelisboa.editor-draft:v1:admin:route-narrative:route-e2e:pt';
  await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),key)).not.toBeNull();
  let writes=0;
  await page.route('**/api/v1/admin/routes',r=>r.fulfill({json:{data:[{...publicRoute,title_pt:'Changed remote',is_published:false,
    segments:publicRoute.segments.map(s=>({...s,bridge_content_pt:s.kind==='bridge'?s.content_pt:undefined}))}],meta:{}}}));
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,r=>{writes++;return r.fulfill({status:503,json:{detail:'Unexpected'}});});
  await page.reload();
  const recovery=page.getByRole('alert',{name:'Recuperação de rascunho: Narrativa e waypoints'});
  await expect(recovery).toContainText('A base no servidor mudou');
  await recovery.getByRole('button',{name:'Restaurar mesmo assim',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Título em português',exact:true})).toHaveValue('Local against old base');
  expect(writes).toBe(0);
});
test('saving narrative does not erase uncalculated waypoint recovery',async ({page})=>{
  await page.goto(`/?partial-narrative-save=1#/routes/${publicRoute.id}`);
  await addWaypoint(page);
  await page.getByRole('textbox',{name:'Título em português',exact:true}).fill('Only narrative saved');
  await page.route(`**/api/v1/admin/routes/${publicRoute.id}`,r=>r.fulfill({json:{data:{...publicRoute,...r.request().postDataJSON()},meta:{}}}));
  await page.getByRole('button',{name:'Guardar percurso',exact:true}).click();
  await expect(page.locator('.route-status-line')).toContainText('Percurso guardado');
  const key='ecosdelisboa.editor-draft:v1:admin:route-narrative:route-e2e:pt';
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)??'null')?.value.waypoints[0]?.waypoints.length,key)).toBe(1);
  await expect(page.locator('.route-status-line')).toContainText('Waypoints por guardar');
});
test('route reload restores uncalculated waypoints only after explicit confirmation', async ({page}) => {
  await page.getByRole('button',{name:'Percursos',exact:true}).click();
  await addWaypoint(page);
  await expect(page.locator('.waypoint-row')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('ecosdelisboa.editor-draft:v1:admin:route-narrative:')))).toBe(true);
  await page.reload();
  await page.getByRole('alert',{name:'Recuperação de rascunho: Narrativa e waypoints'}).getByRole('button',{name:'Restaurar rascunho',exact:true}).click();
  await expect(page.getByText('Rascunho local restaurado. Ainda não foi guardado no servidor.',{exact:true})).toBeVisible();
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
  let parentWrites=0;
  await page.route('**/api/v1/admin/points/point-1',route=>{parentWrites++;return route.fulfill({status:503,json:{detail:'Unexpected parent write'}});});
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
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  expect(parentWrites).toBe(0);
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
