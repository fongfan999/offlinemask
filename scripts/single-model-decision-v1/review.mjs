import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,output,fixtures,readJson,hash,verify} from './common.mjs';
import {productFixture} from '../pretrained-scope/common.mjs';
await verify();
const selections=[['model-comparison.json','name-lowercase'],['model-comparison.json','name-ethnic'],
 ['model-comparison.json','negative-upper'],['model-reliability.json','fresh-nfd'],
 ['model-decision.json','mixed-customer'],['model-decision.json','address-slash'],
 ['model-reliability.json','fresh-negative-unicode'],['release-challenge-v1.json','organization-extracted'],
 ['release-challenge-v1.json','person-short-extracted'],['model-comparison.json','other-card'],
 ['model-decision.json','negative-titles'],['address-validation.json','validation-lane']];
const all=(await fixtures()).map(productFixture),candidates=await readJson(join(output,'candidates.json'));
const cases=selections.map(([file,id],index)=>{
 const i=all.findIndex(f=>f.file===file&&f.id===id);if(i<0)throw Error(`Missing ${id}`);
 const f=all[i];return {number:index+1,id,file,text:f.text,textSha256:hash(f.text),reviewStatus:'PENDING',
  A:candidates.underthesea[i].canonical,B:candidates.bigmed[i].canonical};
});
const ledger={createdAt:new Date().toISOString(),reviewer:null,status:'PENDING',cases:cases.map(({A,B,...c})=>c),
 fixtureProtocolHash:hash(await readFile(join(root,'docs/evaluations/single-model-decision-v1/protocol.json'))),
 outputHash:hash(await readFile(join(output,'candidates.json')))};
await writeFile(join(root,'docs/evaluations/single-model-decision-v1/review-ledger.json'),JSON.stringify(ledger,null,2)+'\n',{flag:'wx'});
const render=rows=>rows.predictions.length?rows.predictions.map(p=>`- ${JSON.stringify(p.value)} → ${p.findingId.split('_').slice(0,-1).join('_')}`).join('\n'):'Không ẩn mục nào.';
const content=['# Rà soát 12 ví dụ nhận diện\n',
 'Các ví dụ dưới đây đều là dữ liệu giả lập đã được dùng trong kiểm thử. Chưa có ví dụ nào được bạn phê duyệt. Đây là rà soát kỳ vọng sản phẩm, không phải bộ kiểm định độc lập mới.\n',
 'Với mỗi ví dụ, hãy ghi các đoạn cần ẩn và loại thông tin trước khi mở kết quả A/B. Nếu không có thông tin riêng tư, ghi “Không cần ẩn”. Sau đó cho biết A/B bỏ sót hoặc ẩn thừa ở đâu. Không cần gửi dữ liệu thật.\n',
 'Có thể trả lời trong cuộc trò chuyện theo mẫu: **1. Cần ẩn: …; A: …; B: …**. Mục chưa trả lời vẫn chờ rà soát. A/B được giữ nhất quán giữa các ví dụ để tiện so sánh; đây không phải thử nghiệm ngẫu nhiên.\n',
 'Loại kết quả: TEN = tên người; DIA_CHI = địa chỉ; TO_CHUC = tổ chức; STK = tài khoản; THE = số thẻ; MA_BAO_MAT/CVV/PIN = mã bảo mật; các mã khác giữ tên gợi nghĩa.\n'];
for(const c of cases)content.push(`## ${c.number}\n\n\`\`\`text\n${c.text}\n\`\`\`\n\nCần ẩn và loại thông tin: _chờ bạn ghi_\n\n<details>\n<summary>Xem kết quả A/B sau khi tự đánh giá</summary>\n\n**A**\n\n${render(c.A)}\n\n**B**\n\n${render(c.B)}\n\n</details>\n`);
await writeFile(join(root,'docs/evaluations/single-model-decision-v1/review.md'),content.join('\n'),{flag:'wx'});
await writeFile(join(output,'review-key.json'),JSON.stringify({A:'underthesea',B:'bigmed',cases},null,2)+'\n',{flag:'wx'});
console.log('Created 12-case review, all pending.');
