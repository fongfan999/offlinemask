import test from 'node:test';
import assert from 'node:assert/strict';
import { contextual, productFixture, score, assertReplay } from '../scripts/pretrained-scope/common.mjs';
test('contextual responsibility split preserves complete original objects and excludes structured labels', () => {
  const rows = ['TEN','DIA_CHI','TO_CHUC','MAT_KHAU','NGAY_SINH','THE','STK'].map(type => ({type,start:1,end:5,priority:50}));
  assert.deepEqual(contextual(rows), rows.slice(0,3)); assert.equal(rows.length,7);
  assert.equal(contextual(rows)[0],rows[0]);
});
test('scope scoring keeps excluded private values in denominators and uniformly corrects card category', () => {
  const fixture={id:'test',text:'An 1234',entities:[{start:0,end:2,value:'An',category:'name'},{start:3,end:7,value:'1234',category:'banking',type:'card'}]};
  const target=productFixture(fixture); assert.equal(target.entities[1].category,'other'); assert.equal(fixture.entities[1].category,'banking');
  const result=score(target,[{type:'TEN',start:0,end:2,priority:50,label:'name',source:'unit',reason:'unit'}]);
  assert.equal(result.entities.length,2);assert.equal(result.entities[0].selectedFull,true);assert.equal(result.entities[1].full,false);
  assertReplay(result,result,'unit');
  assert.throws(()=>assertReplay({...result,selectedPredictions:{}},result,'unit'),/Selected saved/);
});
