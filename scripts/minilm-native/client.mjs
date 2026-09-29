import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
export const root = new URL('../../', import.meta.url);
export const work = new URL('artifacts/minilm-native/', root);
export const binary = fileURLToPath(new URL('target/release/offlinemask-minilm-tokenizer-prototype', work));
export const asset = fileURLToPath(new URL('artifacts/minilm-admission/pack/tokenizer.json', root));
export async function openNative() {
  const child = spawn(binary, [asset], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, TOKENIZERS_PARALLELISM:'false' } });
  let stderr=''; child.stderr.on('data', data=>{ stderr+=data; });
  const exited=once(child,'exit');
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  async function read() {
    let timer;
    try {
      const result=await Promise.race([lines.next(),new Promise((_,reject)=>{
        timer=setTimeout(()=>{child.kill();reject(Error('Native tokenizer timeout'));},30_000);
      })]);
      if(result.done) throw Error(`Native tokenizer exited: ${stderr}`);
      return JSON.parse(result.value);
    } finally { clearTimeout(timer); }
  }
  const ready=await read();
  if(!ready.ready) { child.kill(); throw Error('Missing native readiness'); }
  let id=0;
  return { ready,
    async encode(text,inference=false) {
      const requestId=id++;
      child.stdin.write(JSON.stringify({id:requestId,text,inference})+'\n');
      const response=await read();
      if(response.id!==requestId) throw Error('Native response mismatch');
      return response;
    },
    async close() {
      child.stdin.end();
      const [code]=await exited;
      if(code!==0 || stderr) throw Error(`Native tokenizer failed: ${stderr}`);
    },
  };
}
