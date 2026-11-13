import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ViewerOptions = { title: string; indexUrl?: string; emptyMessage?: string };
export type ViewerStory = { title: string; manifest: string; readme?: string; platform?: string };
export type ViewerView = { name: string; image: string; dom?: string; expected?: string; diff?: string };
export type ViewerStep = { number?: number; description: string; actor?: string; status?: 'captured' | 'passed' | 'failed'; assertions?: string[]; views: ViewerView[] };
export type ViewerWalkthrough = { id: string; title?: string; platform?: string; steps: ViewerStep[] };
const html = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** A portable, dependency-free review page. An empty collection makes no verification claim. */
export function createViewer(options: ViewerOptions): string {
  if (!options.title.trim()) throw Error('Viewer title is required');
  const config = JSON.stringify({ title: options.title, indexUrl: options.indexUrl ?? 'walkthroughs/index.json', emptyMessage: options.emptyMessage ?? 'No walkthroughs have been recorded yet.' }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(options.title)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#162a24;color:#f6edda;font:15px/1.5 system-ui,sans-serif}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;flex-wrap:wrap;gap:14px;padding:15px 22px;background:#233b30;border-bottom:1px solid #73806c}h1{font-size:21px;margin:0}select,button,input{font:inherit}select,button{background:#314d3e;border:1px solid #95a38c;border-radius:5px;color:inherit;min-height:44px;padding:8px 13px}select{max-width:100%}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}:focus-visible{outline:3px solid #f5c25f;outline-offset:3px}.toolbar{display:flex;gap:12px;align-items:center;flex:1;min-width:min(100%,250px)}input{width:100%;min-width:60px}a{color:#f6cb75}main{padding:22px}h2{font-size:23px;margin:0 0 8px}.muted{color:#c0caba}.views{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:20px}.view{background:#233b30;padding:14px;border:1px solid #52694f;border-radius:6px;min-width:0}.view h3{margin:0 0 12px;font-size:15px}.view img{width:100%;height:auto;display:block}.view.full{grid-column:1/-1;overflow:auto}.view.full img{width:auto;max-width:none}details{margin-top:12px}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:500px;overflow:auto;font:12px/1.5 monospace}.image-tools{display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap}.status-failed,#error{color:#ffc9b3}#position{min-width:60px;text-align:center}.empty{max-width:700px;padding:30px 0}#assertions:empty{display:none}</style>
<header><h1>${html(options.title)}</h1><select id="story" aria-label="Walkthrough" hidden></select><a id="readme" hidden>Story notes</a><div class="toolbar" id="toolbar" hidden><button id="prev" aria-label="Previous step">←</button><input id="step" type="range" min="0" value="0" aria-label="Step"><span id="position"></span><button id="next" aria-label="Next step">→</button></div></header><main><h2 id="title">Loading walkthroughs…</h2><p id="description" class="muted"></p><p id="error" role="status"></p><ul id="assertions"></ul><div id="views" class="views"></div></main>
<script type="module">
const config=${config},$=s=>document.querySelector(s);let stories=[],current,index=0,loadId=0;
const base=new URL('.',location.href);
function url(path){const result=new URL(path,base);if(!['http:','https:'].includes(result.protocol))throw Error('Unsupported review URL');return result.href;}
async function json(path){const response=await fetch(url(path));if(!response.ok)throw Error('Unable to load '+path+' ('+response.status+')');return response.json();}
function empty(){ $('#title').textContent='Walkthroughs will appear here';$('#description').textContent=config.emptyMessage;$('#toolbar').hidden=true; }
function show(){
 const step=current.steps[index];if(!step){empty();return;}
 $('#title').textContent=(step.number??index+1)+'. '+step.description;
 const status=step.status==='passed'?'Verified':step.status==='failed'?'Failed':'Captured — awaiting verification';
 $('#description').textContent=[step.actor,status,current.platform].filter(Boolean).join(' · ');$('#description').className=step.status==='failed'?'status-failed':'muted';
 $('#step').max=String(current.steps.length-1);$('#step').value=String(index);$('#position').textContent=(index+1)+' / '+current.steps.length;$('#prev').disabled=index===0;$('#next').disabled=index===current.steps.length-1;
 $('#views').replaceChildren();$('#assertions').replaceChildren();
 for(const text of step.assertions??[]){const li=document.createElement('li');li.textContent=text;$('#assertions').append(li);}
 for(const view of step.views){
  const panel=document.createElement('section');panel.className='view';const heading=document.createElement('h3');heading.textContent=view.name;panel.append(heading);
  const link=document.createElement('a');link.href=url(view.image);link.target='_blank';link.rel='noopener';const img=document.createElement('img');img.src=link.href;img.alt=view.name+': '+step.description;img.loading='lazy';link.append(img);panel.append(link);
  const tools=document.createElement('div');tools.className='image-tools';const zoom=document.createElement('button');zoom.textContent='Actual size';zoom.setAttribute('aria-pressed','false');zoom.onclick=()=>{const full=panel.classList.toggle('full');zoom.textContent=full?'Fit view':'Actual size';zoom.setAttribute('aria-pressed',String(full));};tools.append(zoom);
  for(const [label,path]of [['Expected',view.expected],['Diff',view.diff]])if(path){const a=document.createElement('a');a.href=url(path);a.textContent=label;a.target='_blank';a.rel='noopener';tools.append(a);}panel.append(tools);
  if(view.dom){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Accessible DOM';details.append(summary,pre);details.addEventListener('toggle',async()=>{if(!details.open||pre.textContent)return;try{const response=await fetch(url(view.dom));if(!response.ok)throw Error('DOM evidence unavailable');pre.textContent=await response.text();}catch(error){pre.textContent=error.message;}});panel.append(details);}$('#views').append(panel);
 }
 history.replaceState(null,'','#'+encodeURIComponent(current.id)+'/'+encodeURIComponent(current.platform??'')+'/'+index);
}
async function load(story,position=0){const request=++loadId;try{const next=await json(story.manifest);if(request!==loadId)return;if(!Array.isArray(next.steps))throw Error('Invalid walkthrough manifest');current=next;index=Math.max(0,Math.min(position,next.steps.length-1));$('#readme').hidden=!story.readme;if(story.readme)$('#readme').href=url(story.readme);$('#toolbar').hidden=!next.steps.length;show();}catch(error){$('#error').textContent=error.message;}}
$('#story').onchange=()=>load(stories[Number($('#story').value)]);$('#step').oninput=()=>{index=Number($('#step').value);show();};$('#prev').onclick=()=>{if(index>0){index--;show();}};$('#next').onclick=()=>{if(current&&index<current.steps.length-1){index++;show();}};
document.addEventListener('keydown',event=>{if(event.target.matches('input,select,textarea'))return;if(event.key==='ArrowLeft')$('#prev').click();if(event.key==='ArrowRight')$('#next').click();});
try{stories=await json(config.indexUrl);if(!Array.isArray(stories))throw Error('Invalid walkthrough index');if(!stories.length)empty();else{for(const [i,story]of stories.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=story.title+(story.platform?' · '+story.platform:'');$('#story').append(option);}$('#story').hidden=false;const [id,platform,position]=location.hash.slice(1).split('/').map(decodeURIComponent);let selected=stories.findIndex(story=>story.manifest.includes(id+'/'+platform+'/'));if(selected<0)selected=0;$('#story').value=String(selected);await load(stories[selected],Number(position)||0);}}catch(error){$('#title').textContent='Walkthroughs unavailable';$('#error').textContent=error.message;}
</script></html>`;
}

export async function writeViewer(directory: string, options: ViewerOptions): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'index.html'), createViewer(options));
}
