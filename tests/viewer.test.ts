import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createViewer, writeViewer } from '../src/viewer.ts';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('viewer safely embeds caller text and does not claim captures passed by default',()=>{
 const text=createViewer({title:'Game </title><script>alert(1)</script>',emptyMessage:'Awaiting </script><script>alert(2)</script>'});
 assert.ok(text.includes('&lt;/title&gt;'));
 assert.ok(!text.includes('</script><script>alert(2)'));
 assert.ok(text.includes('Captured — awaiting verification'));
 assert.ok(text.includes('Accessible DOM'));
});
test('viewer can be written to a build output without application-specific dependencies',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'e2e-viewer-'));
 try{await writeViewer(join(directory,'review'),{title:'Game walkthroughs'});assert.ok((await readFile(join(directory,'review/index.html'),'utf8')).includes('Game walkthroughs'));}finally{await rm(directory,{recursive:true});}
});
