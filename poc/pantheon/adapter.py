"""Install the experiment in a disposable Pantheon checkout."""
from pathlib import Path
import shutil
import sys

framework = Path(__file__).resolve().parents[2]
root = Path(sys.argv[1]).resolve()
target = root / '.e2e-poc'
shutil.copytree(framework / 'src', target / 'src', dirs_exist_ok=True)
(target / 'poc/pantheon').mkdir(parents=True, exist_ok=True)
shutil.copyfile(framework / 'poc/pantheon/runtime.ts', target / 'poc/pantheon/runtime.ts')
shutil.copyfile(framework / 'poc/pantheon/browser-diagnostics.mjs', target / 'poc/pantheon/browser-diagnostics.mjs')
shutil.copyfile(framework / 'poc/pantheon/baselines.json', target / 'baselines.json')
shutil.copyfile(framework / 'poc/pantheon/source.json', target / 'source.json')

def replace(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f'Expected one patch anchor in {path}: {old[:80]}')
    path.write_text(text.replace(old, new))

helper = root / 'tests/e2e/helpers/test-step-helper.ts'
replace(helper, "import { identicalPixels, preparePixels } from './exact-pixels';", "import { recordCapture } from '../../../.e2e-poc/poc/pantheon/runtime';")
replace(helper, 'const reference=!updating&&existsSync(baseline)?preparePixels(readFileSync(baseline)):undefined;', "if(updating)throw new Error('POC uses its own explicit candidate mode');")
text = helper.read_text()
start = text.index('        if(updating){')
end = text.index('        expect(performance.now()-start', start)
text = text[:start] + '''        recordCapture(capture, { baseline, file:this.info.file, story:story.slug, title:this.info.title,
          stepId:id, caption:description, assertions:verifications.map(v=>v.spec), player:view.player,
          project:this.info.project.name, elapsedMs:performance.now()-start });
''' + text[end:]
# Preserve diagnostic state after the timed failure, while observer pages still exist.
text = text.replace("      },{timeout:OPERATION_BUDGET});\n      const views=", """      },{timeout:OPERATION_BUDGET}).catch(async error=>{
        try {
          const state=await page.evaluate(()=>({
            resources:[...document.querySelectorAll('.resource-icon')].map(node=>({label:node.getAttribute('aria-label'),value:node.getAttribute('data-value'),rect:node.getBoundingClientRect().toJSON()})),
            market:[...document.querySelectorAll('.supply-face')].map(node=>({text:node.textContent,transform:getComputedStyle(node).transform,rect:node.getBoundingClientRect().toJSON()})),
            logs:[...document.querySelectorAll('.log-entry')].slice(0,3).map(node=>node.textContent)
          }));
          await this.info.attach('capture-state',{body:JSON.stringify(state),contentType:'application/json'});
          const camera=cameras.get(page);
          if(camera){const next=await camera.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true});await this.info.attach('diagnostic-followup',{body:Buffer.from(next.data,'base64'),contentType:'image/png'});}
        }catch{/* The failed verification and its original PNG remain authoritative. */}
        throw error;
      });
      const views=""")
helper.write_text(text)
fixtures = root / 'tests/e2e/helpers/fixtures.ts'
replace(fixtures, "import { finishStory } from './test-step-helper';", "import { recordTest } from '../../../.e2e-poc/poc/pantheon/runtime';")
replace(fixtures, 'await use();finishStory(info);', 'await use();recordTest(info);')
replace(fixtures, "import { prepareCaptureContext } from './capture-context';", "import { prepareCaptureContext } from './capture-context';\nimport { observeBrowser } from '../../../.e2e-poc/poc/pantheon/browser-diagnostics.mjs';\nconst diagnostics=new WeakMap<object,()=>Promise<void>>();")
replace(fixtures, 'context:async({context},use)=>{await prepareCaptureContext(context);await use(context);},', 'context:async({context},use,info)=>{await prepareCaptureContext(context);diagnostics.set(context,await observeBrowser(context,info));await use(context);},\n  page:async({page,context},use)=>{await use(page);await diagnostics.get(context)?.();},')
print(f'Installed POC adapter in {root}; application UI and capture options unchanged')

config = root / 'playwright.config.ts'
replace(config, "reporter: [['list'], ['html', { open: 'never' }]],", "reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: process.env.E2E_POC_OUTPUT + '/playwright.json' }]],")

active = framework / 'poc/pantheon/active-inventory.json'
if active.exists():
    shutil.copyfile(active, target / 'active-inventory.json')

# Profile connection stages without changing UI state or network behavior.
page = root / 'src/routes/play/+page.svelte'
replace(page, 'const connected = await connectFirebase();', "performance.mark('connect:auth:start');const connected = await connectFirebase();performance.mark('connect:auth:ready');")
replace(page, 'const room = await inspectRoom(connected.db, roomId);', "performance.mark('connect:room:start');const room = await inspectRoom(connected.db, roomId);performance.mark('connect:room:ready');")
repository = root / 'src/lib/backend/setup-repository.ts'
replace(repository, 'const state = replaySetup(events);\n      if (!snapshot.metadata.fromCache)', "performance.mark('connect:replay:start');const state = replaySetup(events);performance.mark('connect:replay:ready');\n      if (!snapshot.metadata.fromCache)")
