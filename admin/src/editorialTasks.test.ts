import assert from 'node:assert/strict';
import test from 'node:test';
import { batchTasks, localDraftTasks, reviewTasks, routeTasks } from './tasks/editorialTasks.ts';
import { DRAFT_MAX_AGE, localDraftKey, writeLocalDraft, type DraftStorage } from './localDraftStore.ts';
import type { AdminPoint, AdminRouteReadiness, AdminText, ContentGenerationBatch } from '@ecosdelisboa/shared';

test('pending translations link to exact item and language; approved versions are not pending', () => {
  const texts = [{ id: 'text /1', content_pt: 'Original', translations: [{lang:'en',status:'pending'},{lang:'fr',status:'approved'}] }] as AdminText[];
  const points = [{ id:'point-1',title_pt:'Ponto', translations:[{lang:'fr',status:'pending'}] }] as AdminPoint[];
  const tasks=reviewTasks(texts,points);
  assert.deepEqual(tasks.map(task=>task.hash),['#/texts/text%20%2F1?lang=en','#/points/point-1?lang=fr']);
  assert.equal(tasks.length,2);
});
test('authoritative route issues resolve text, point, bridge or route without inferring readiness',()=>{
  const route: AdminRouteReadiness={id:'route',title_pt:'Percurso',is_published:false,segments:[{id:'s',text_id:'text',point_id:'point'},{id:'bridge',text_id:null,point_id:null}],
    readiness:[{lang:'en',ready:false,issues:[
      {code:'missing_text_translation',path:'segments.0',message:'Text',segment_id:'s'},
      {code:'invalid_coordinates',path:'segments.0.point',message:'Point',segment_id:'s'},
      {code:'missing_bridge_translation',path:'segments.1',message:'Bridge',segment_id:'bridge'},
      {code:'new_server_rule',path:'other',message:'New server message'}]}]};
  const tasks=routeTasks([route]);
  assert.deepEqual(tasks.map(task=>task.hash),['#/texts/text?lang=en','#/points/point','#/routes/route?lang=en&segment=bridge','#/routes/route?lang=en']);
  assert.ok(tasks[3].detail.includes('New server message'));
  assert.deepEqual(routeTasks([{...route,readiness:[{lang:'en',ready:true,issues:[]}]}]),[]);
});
test('batch failures retain scope and never schedule retries',()=>{
  const batch={id:'batch',created_at:'2026-10-01T00:00:00Z',errors:[{kind:'audio',target_kind:'text',target_id:'text',lang:'en'},
    {kind:'translation',target_kind:'point',target_id:'point',lang:'fr'}]} as ContentGenerationBatch;
  assert.deepEqual(batchTasks([batch]).map(task=>task.hash),['#/texts/text?lang=en','#/points/point?lang=fr']);
});
test('local inventory is read-only, isolated, validated and expiry-aware',()=>{
  const data=new Map<string,string>();
  const storage:DraftStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value);},removeItem:()=>{throw new Error('Inventory must never delete');},key:i=>[...data.keys()][i]??null,get length(){return data.size;}};
  const identity={userId:'admin:one',entity:'route-bridge:route',id:'segment',language:'en'};
  writeLocalDraft(storage,identity,{content:'Original'},{content:'Draft'},1000);
  writeLocalDraft(storage,{...identity,userId:'admin:other'},{content:'Original'},{content:'Other account'},1000);
  writeLocalDraft(storage,{...identity,id:'expired'},{content:'Old'},{content:'Expired'},1);
  data.set(localDraftKey({...identity,id:'corrupt'}),'not-json');
  data.set(localDraftKey({...identity,entity:'users',id:'unsafe'}),JSON.stringify({version:1,identity:{...identity,entity:'users',id:'unsafe'},savedAt:1000,baseline:{password:''},value:{password:'never'}}));
  const before=[...data];
  const tasks=localDraftTasks(storage,'admin:one',DRAFT_MAX_AGE+500);
  assert.equal(tasks.length,1);
  assert.equal(tasks[0].hash,'#/routes/route?lang=en&segment=segment');
  assert.deepEqual([...data],before);
  assert.ok(!JSON.stringify(tasks).includes('Other account'));
  assert.ok(!JSON.stringify(tasks).includes('never'));
});
