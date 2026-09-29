import test from 'node:test';
import assert from 'node:assert/strict';
import { completeAddressBoundaries } from '../src/core/detection/address-boundaries.ts';
import { analyzeText, maskedText } from '../src/core/text.ts';
function seed(text, value, type='DIA_CHI') { const start=text.indexOf(value);return {start,end:start+value.length,type,priority:50,label:type,source:'Synthetic',reason:'Test'}; }
function result(text, values) {
 const ds=completeAddressBoundaries(text,values.map(v=>seed(text,v)));
 const a=analyzeText(text,'12345678',ds);
 return {a, output:maskedText(text,a,Object.fromEntries(a.findings.map(f=>[f.id,'mask'])))};
}
test('address prefixes and apartment components join without consuming preceding prose',()=>{
 const address='căn 1208, tòa B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội';
 const text=`Nhận thư tại ${address}.`;
 const {a,output}=result(text,['1208','B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội']);
 assert.equal(a.findings[0].value,address);
 assert.equal(output,`Nhận thư tại ${a.findings[0].alias}.`);
});
test('rural labels and decomposed administrative prefixes stay attached to their values',()=>{
 const address='thôn Đông, xã Bình Minh, huyện Thanh Oai, Hà Nội'.normalize('NFD');
 const text=`Địa chỉ: ${address}.`;
 assert.equal(result(text,['Đông'.normalize('NFD'),'Hà Nội'.normalize('NFD')]).a.findings[0].value,address);
});
test('street numbers can join a seeded ward only in address context',()=>{
 const address='12/7/3 Lê Văn Sỹ, Phường 13, Quận 3';
 assert.equal(result(`Cư trú tại ${address}.`,['Phường 13, Quận 3']).a.findings[0].value,address);
 assert.equal(result('Có 47 Hồ Sơ, Hà Nội.', ['Hà Nội']).a.findings[0].value,'Hà Nội');
});
test('missing model evidence cannot become an address through labels alone',()=>{
 const text='Địa chỉ: 36 Nguyễn Trãi, Hà Nội.';
 assert.deepEqual(completeAddressBoundaries(text,[]),[]);
 assert.deepEqual(completeAddressBoundaries(text,[seed(text,'Nguyễn Trãi','TEN')]),[seed(text,'Nguyễn Trãi','TEN')]);
});
test('address completion stops before contact fields, dates, money and ordinary prose',()=>{
 for(const suffix of ['; STK: 001122334455.', ', điện thoại 0912345678.', '\nSố tiền: 2.000.000 đồng.', ', sau 17 giờ.', '. Ngày 10/09/2026.', ', 25 giao dịch.']) {
  const text=`Địa chỉ: 31 Lê Lợi, Hà Nội${suffix}`;
  const {a,output}=result(text,['31 Lê Lợi','Hà Nội']);
  assert.equal(a.findings[0].value,'31 Lê Lợi, Hà Nội');
  assert.ok(output.endsWith(suffix));
 }
});
test('abbreviated wards and cities retain internal punctuation without including sentence end',()=>{
 const address='19 Trần Hưng Đạo, P.5, Q.5, TP.HCM';
 const {a}=result(`Đ/c: ${address}. Nhận giờ hành chính.`,['Trần','Q','TP','HCM']);
 assert.equal(a.findings[0].value,address);
});
test('new component prefixes cannot discard a tail already covered by the model',()=>{
 const text='Địa chỉ: 25 Lê Lợi, Thành Phố Mới, một phần chưa rõ.';
 const value='25 Lê Lợi, Thành Phố Mới, một phần chưa rõ';
 const {a}=result(text,[value]);
 for(let i=text.indexOf(value);i<text.indexOf(value)+value.length;i++)
  assert.ok(a.spans.some(s=>s.start<=i&&s.end>i));
});
test('a title-cased preposition or report heading is not a locality prefix',()=>{
 for(const prefix of ['Tại ','Đến ','Báo Cáo Tại ']) {
  const text=prefix+'Hải Phòng, 25 giao dịch.';
  assert.equal(result(text,['Hải Phòng']).a.findings[0].value,'Hải Phòng');
 }
});
test('a model-labelled room or floor number alone cannot pull ordinary building prose into an address',()=>{
 for(const text of ['Tầng 4.','Phòng 201.','Tòa 3 có 8 tầng.']) {
  const value=text.match(/\d+/)[0];
  assert.equal(result(text,[value]).a.findings[0].value,value);
 }
});
