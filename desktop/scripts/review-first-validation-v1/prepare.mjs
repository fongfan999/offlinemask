import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,hash,readJson,verify} from '../single-model-decision-v1/common.mjs';
import {parseFixture} from '../model-comparison-metrics.mjs';
await verify();
const directory=join(root,'docs/evaluations/review-first-validation-v1');
const source=await readJson(join(directory,'source.json'));
const categories={person:'name',address:'address',organization:'other',customer:'banking',email:'email',phone:'phone',account:'banking',identity:'banking',passport:'banking',card:'other',cvv:'other',pin:'other',username:'other',password:'other',apikey:'other',birthdate:'other',ip:'other'};
assert.equal(source.length,24);assert.equal(new Set(source.map(r=>r.id)).size,24);assert.equal(new Set(source.map(r=>r.scenario)).size,24);
const cases=source.map((r,i)=>{
 assert.ok(!r.normalization||r.normalization==='NFD');
 const f=parseFixture({...r,group:r.types.length?'sensitive':'negative',annotated:r.annotated.normalize(r.normalization??'NFC')});
 assert.equal(f.entities.length,r.types.length);
 for(const[e,type]of f.entities.map((e,i)=>[e,r.types[i]])){
  assert.equal(e.category,categories[type]);assert.equal(f.text.slice(e.start,e.end),e.value);
  e.type=type;
 }
 return {...f,number:i+1,scenario:r.scenario,sourceSha256:hash(f.text),annotationSha256:hash(JSON.stringify(f.entities)),
  provenance:'Assistant-authored synthetic example, informed by previous errors; no model run and no human approval yet.'};
});
const paths=execFileSync('rg',['--files','tests/fixtures','docs/evaluations/single-model-owner-review-v1','docs/evaluations/single-model-owner-review-v2','artifacts/detector-corpus-v1','artifacts/detector-corpus-v2'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.json'));
const canonical=s=>s.normalize('NFC').toLocaleLowerCase('vi');
function strings(value){
 if(typeof value==='string')return[value];
 if(Array.isArray(value))return value.flatMap(strings);
 if(value&&typeof value==='object')return Object.values(value).flatMap(strings);
 return [];
}
const inventory={};const old=[];
for(const path of paths){const bytes=await readFile(join(root,path));inventory[path]=hash(bytes);old.push(...strings(JSON.parse(bytes)).map(text=>({path,text:canonical(text)})));}
const collisions=[];
for(const f of cases){
 if(old.some(s=>s.text===canonical(f.text)))throw Error(`Repeated whole example ${f.id}`);
 for(const e of f.entities){
  const value=canonical(e.value),matches=[...new Set(old.filter(s=>s.text.includes(value)).map(s=>s.path))];
  if(matches.length)collisions.push({id:f.id,type:e.type,value:e.value,files:matches});
 }
}
assert.ok(!collisions.some(c=>['person','organization'].includes(c.type)),'Principal name already seen in scanned evidence');
const composition={cases:cases.length,negativeCases:cases.filter(c=>!c.entities.length).length,values:cases.reduce((n,c)=>n+c.entities.length,0),
 byCategory:Object.fromEntries([...new Set(Object.values(categories))].map(category=>[category,cases.flatMap(c=>c.entities).filter(e=>e.category===category).length]))};
const protocol={createdAt:new Date().toISOString(),node:process.version,status:'FROZEN_PROPOSED_ANNOTATIONS_AWAITING_OWNER',
 files:Object.fromEntries(await Promise.all(['docs/evaluations/review-first-validation-v1/spec.md','docs/evaluations/review-first-validation-v1/source.json',
 'scripts/review-first-validation-v1/prepare.mjs','scripts/model-comparison-metrics.mjs'].map(async p=>[p,hash(await readFile(join(root,p)))]))),composition,
 priorEvidenceInventory:inventory,collisions,modelRuns:0,limits:'Exact NFC case-insensitive text/value scan only; not semantic or statistical independence. Short code collisions are disclosed. Prior assistant exposure and targeted authorship preclude independent-holdout claims.'};
await writeFile(join(directory,'cases.json'),JSON.stringify(cases,null,2)+'\n',{flag:'wx'});
protocol.casesSha256=hash(await readFile(join(directory,'cases.json')));
await writeFile(join(directory,'protocol.json'),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
await writeFile(join(directory,'review-ledger.json'),JSON.stringify({createdAt:new Date().toISOString(),protocolSha256:hash(await readFile(join(directory,'protocol.json'))),
 status:'PENDING',reviewer:null,cases:cases.map(c=>({id:c.id,number:c.number,textSha256:c.sourceSha256,annotationSha256:c.annotationSha256,status:'PENDING'}))},null,2)+'\n',{flag:'wx'});
const names={person:'Tên người',address:'Địa chỉ',organization:'Tổ chức',customer:'Mã khách hàng',email:'Email',phone:'Số điện thoại',account:'Số tài khoản',identity:'CCCD',passport:'Hộ chiếu',card:'Số thẻ',cvv:'CVV',pin:'PIN',username:'Tên đăng nhập',password:'Mật khẩu',apikey:'Khóa truy cập',birthdate:'Ngày sinh',ip:'Địa chỉ IP'};
const review=['# Rà soát kỳ vọng trước khi chạy mô hình\n',
 '24 ví dụ được soạn mới, dùng thông tin giả lập; tên và số có thể tình cờ trùng thực tế. Đây chưa phải dữ liệu đã được bạn duyệt. Chưa chạy mô hình nào trên các ví dụ này.\n',
 'Phần **Đề xuất ẩn** do trợ lý soạn, không phải kết quả nhận diện. Những phần không được liệt kê sẽ giữ nguyên. Hãy kiểm tra cả phần bỏ sót, ẩn thừa và loại thông tin. Có thể trả lời “Đồng ý 1–6” hoặc sửa từng mục. Mục chưa trả lời vẫn chờ duyệt.\n',
 'Với tên tổ chức, đề xuất bao gồm đầy đủ tiền tố như “Công ty TNHH” hoặc “Hợp tác xã”. Số tiền, ngày giao dịch và tiêu đề thông thường giữ nguyên. Đây là bộ ví dụ nhỏ để kiểm tra kỳ vọng, không chứng minh độ chính xác ngoài thực tế.\n'];
for(const f of cases){
 if((f.number-1)%6===0)review.push(`## Nhóm ${Math.ceil(f.number/6)} · Ví dụ ${f.number}–${f.number+5}\n`);
 review.push(`### ${f.number}\n\n\`\`\`text\n${f.text}\n\`\`\`\n\n**Đề xuất ẩn:**\n\n${f.entities.length?f.entities.map(e=>`- ${JSON.stringify(e.value)} — ${names[e.type]}`).join('\n'):'Không có. Giữ nguyên toàn bộ.'}\n`);
}
await writeFile(join(directory,'review.md'),review.join('\n'),{flag:'wx'});
await verify();
console.log(JSON.stringify({composition,collisionCount:collisions.length,collisions,review:'24 pending',modelRuns:0},null,2));
