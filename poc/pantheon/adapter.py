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
helper.write_text(text)
fixtures = root / 'tests/e2e/helpers/fixtures.ts'
replace(fixtures, "import { finishStory } from './test-step-helper';", "import { recordTest } from '../../../.e2e-poc/poc/pantheon/runtime';")
replace(fixtures, 'await use();finishStory(info);', 'await use();recordTest(info);')
replace(fixtures, "import { prepareCaptureContext } from './capture-context';", "import { prepareCaptureContext } from './capture-context';\nimport { observeBrowser } from '../../../.e2e-poc/poc/pantheon/browser-diagnostics.mjs';")
replace(fixtures, 'context:async({context},use)=>{await prepareCaptureContext(context);await use(context);},', 'context:async({context},use,info)=>{await prepareCaptureContext(context);const diagnose=await observeBrowser(context,info);await use(context);await diagnose();},')
print(f'Installed POC adapter in {root}; application UI and capture options unchanged')

config = root / 'playwright.config.ts'
replace(config, "reporter: [['list'], ['html', { open: 'never' }]],", "reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: process.env.E2E_POC_OUTPUT + '/playwright.json' }]],")

active = framework / 'poc/pantheon/active-inventory.json'
if active.exists():
    shutil.copyfile(active, target / 'active-inventory.json')
