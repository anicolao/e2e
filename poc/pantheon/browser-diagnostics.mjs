import { writeFileSync } from 'node:fs';

/** Keep transport and main-thread evidence when a real browser check fails. */
export async function observeBrowser(context, info) {
  const requests = [], failures = [];
  const pending = new Map();
  const cleanUrl = value => { const url = new URL(value); return url.origin + url.pathname; };
  context.on('request', request => {
    const row = { url: cleanUrl(request.url()), type: request.resourceType(), startedMs: performance.now() };
    if (requests.length === 2000) requests.shift();
    requests.push(row); pending.set(request, row);
  });
  context.on('response', response => {
    const row = pending.get(response.request());
    if (row) { row.status = response.status(); row.headersMs = performance.now() - row.startedMs; }
  });
  context.on('requestfinished', request => {
    const row = pending.get(request);
    if (row) row.finishedMs = performance.now() - row.startedMs;
    pending.delete(request);
  });
  context.on('requestfailed', request => {
    const row = pending.get(request);
    if (row) row.failure = request.failure()?.errorText;
    pending.delete(request);
  });
  context.on('page', page => page.on('pageerror', error => failures.push(error.message)));
  await context.addInitScript(() => {
    const tasks = [];
    window.__e2eLongTasks = tasks;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (tasks.length === 200) tasks.shift();
        tasks.push({ startMs: entry.startTime, durationMs: entry.duration });
      }
    }).observe({ type: 'longtask', buffered: true });
  });
  return async () => {
    if (info.status === info.expectedStatus) return;
    const pages = await Promise.all(context.pages().map(page => Promise.race([
      page.evaluate(() => ({ path: location.pathname, status: document.querySelector('[data-status]')?.getAttribute('data-status'),
        tasks: window.__e2eLongTasks, stages: performance.getEntriesByType('mark').map(entry => ({name:entry.name,startMs:entry.startTime})), navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()) })),
      new Promise(resolve => { const timer = setTimeout(() => resolve({ error: 'Diagnostic page read timed out' }), 2000); timer.unref(); })
    ]).catch(error => ({ error: String(error) }))));
    const path = info.outputPath('browser-diagnostics.json');
    writeFileSync(path, JSON.stringify({ requests, failures, pages }, null, 2) + '\n');
    await info.attach('browser-diagnostics', { path, contentType: 'application/json' });
  };
}
