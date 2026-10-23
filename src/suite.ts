export type RequiredCase = { id: string; excluded?: boolean };
export type CaseResult = { id: string; status: string; attempts: number };

/** A complete check includes nonvisual tests and treats exclusions as declared inputs. */
export function checkSuite(expected: readonly RequiredCase[], actual: readonly CaseResult[]) {
  const errors: string[] = [], required = new Map(expected.map(item => [item.id, item]));
  if (!expected.length || required.size !== expected.length) errors.push('Required test list is empty or contains duplicates');
  const seen = new Set<string>();
  for (const result of actual) {
    const item = required.get(result.id);
    if (!item) errors.push(`Unexpected test: ${result.id}`);
    if (seen.has(result.id)) errors.push(`Duplicate test: ${result.id}`);
    seen.add(result.id);
    if (result.attempts !== 1) errors.push(`Expected one attempt: ${result.id}`);
    if (item && (item.excluded ? !['passed', 'skipped'].includes(result.status) : result.status !== 'passed')) {
      errors.push(`${result.status}: ${result.id}`);
    }
  }
  for (const id of required.keys()) if (!seen.has(id)) errors.push(`Missing test: ${id}`);
  return { ok: errors.length === 0, errors };
}

export type ReportCase = CaseResult & { expectedStatus: string };
/** Read Playwright JSON without taking a runtime dependency on Playwright. */
export function reportCases(report: { suites: unknown[] }): ReportCase[] {
  const cases: ReportCase[] = [];
  function visit(suites: any[], parents: string[] = []) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) for (const test of spec.tests) {
        cases.push({ id: JSON.stringify([...parents, suite.title, spec.file, spec.line, spec.column, spec.title, test.projectName]),
          expectedStatus: test.expectedStatus, status: test.results.at(-1)?.status ?? 'missing', attempts: test.results.length });
      }
      visit(suite.suites ?? [], [...parents, suite.title]);
    }
  }
  visit(report.suites);
  return cases;
}
