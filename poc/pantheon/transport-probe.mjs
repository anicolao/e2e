import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { observeBrowser } from './browser-diagnostics.mjs';

const application = process.cwd(), output = resolve(process.env.E2E_POC_OUTPUT), clients = Number(process.env.PROBE_CLIENTS ?? 100);
if (!Number.isInteger(clients) || clients < 1 || clients > 1000) throw new Error('Invalid probe client count');
await mkdir(output,{recursive:true});
const require = createRequire(resolve(application,'package.json'));
const {chromium} = require('@playwright/test');
const config = (await import(pathToFileURL(resolve(application,'playwright.config.ts')).href)).default;
const bundle = await readFile(resolve(application,'.e2e-poc/transport-client.js'));
const server = createServer((request,response)=>{
  response.setHeader('Content-Type',request.url==='/client.js'?'application/javascript':'text/html');
  response.end(request.url==='/client.js'?bundle:'<!doctype html><main data-status="connecting">Transport diagnostic</main><script src="/client.js"></script>');
});
await new Promise(resolve=>server.listen(4193,'127.0.0.1',resolve));
const seeded = await fetch('http://127.0.0.1:8193/v1/projects/demo-pantheon/databases/(default)/documents/games/TRANSPORT',{
  method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},
  body:JSON.stringify({fields:{owner:{stringValue:'probe-owner'},members:{arrayValue:{values:[{stringValue:'probe-owner'}]}},playerCount:{integerValue:'2'},revision:{integerValue:'1'},phase:{stringValue:'gathering'}}})
});
if (!seeded.ok) throw new Error(`Probe seed failed: ${seeded.status}`);
const browser = await chromium.launch({headless:true,...config.use.launchOptions});
const results=[];
try {
  for(let index=0;index<clients;index++) {
    const folder=resolve(output,`client-${index}`);await mkdir(folder,{recursive:true});
    const info={title:`client-${index}`,project:{name:'transport'},status:'passed',expectedStatus:'passed',outputPath:name=>resolve(folder,name),attach:async()=>{}};
    const context=await browser.newContext({viewport:{width:393,height:852},locale:'en-CA',timezoneId:'America/Toronto',reducedMotion:'reduce',serviceWorkers:'block'});
    const diagnose=await observeBrowser(context,info), page=await context.newPage();
    const row={client:index,stages:[]};
    try {
      await page.goto('http://127.0.0.1:4193/',{timeout:2000});
      for(const stage of ['authenticate','listen','transaction']) {
        const start=performance.now(), operation=page.evaluate(stage=>window.probe[stage](),stage);
        let timer;
        const result=await Promise.race([
          operation.then(()=>({completed:true}),error=>({error:String(error)})),
          new Promise(resolve=>{timer=setTimeout(()=>resolve({timedOut:true}),2000);})
        ]);
        clearTimeout(timer);
        row.stages.push({stage,startedUtc:new Date(Date.now()-(performance.now()-start)).toISOString(),elapsedMs:performance.now()-start,...result});
        if(!result.completed) {
          info.status='failed';
          await diagnose();
          let recoveryTimer;
          const recovery = await Promise.race([operation.then(()=>({completed:true}),error=>({error:String(error)})),new Promise(resolve=>{recoveryTimer=setTimeout(()=>resolve({timedOut:true}),10000);})]);
          clearTimeout(recoveryTimer);
          row.stages.at(-1).recovery={elapsedMs:performance.now()-start,...recovery};
          break;
        }
      }
      if(info.status==='passed')await diagnose();
    } catch(error) {
      info.status='failed';row.error=String(error);await diagnose();
    } finally { await context.close(); }
    row.status=info.status;results.push(row);
    await writeFile(resolve(output,'results.json'),JSON.stringify({firestoreVersion:process.env.FIRESTORE_EMULATOR_VERSION,bundleDigest:'sha256:'+createHash('sha256').update(bundle).digest('hex'),clients:results},null,2)+'\n');
    if(index%10===0 || info.status!=='passed')console.log(JSON.stringify(row));
  }
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
const failures=results.filter(row=>row.status!=='passed');
console.log(JSON.stringify({clients:results.length,failed:failures.length}));
if(results.length!==clients || failures.length)process.exitCode=1;
