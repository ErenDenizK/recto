/**
 * Page-range problems in words (`components/07-sheets.md` S13, S16): Split's ranges and
 * Extract's pages share the parser (`stage/operation-plans.ts`) and these sentences.
 */
import { m } from '../i18n';
import type { RangeProblem } from '../stage/operation-plans';

export function rangeProblemMessage(problem: RangeProblem): string {
  switch (problem.kind) {
    case 'empty':
      return m.range_error_empty();
    case 'syntax':
      return m.range_error_syntax({ token: problem.token });
    case 'zero':
      return m.range_error_zero({ token: problem.token });
    case 'reversed':
      return m.range_error_reversed({ token: problem.token });
    case 'out-of-bounds':
      return m.range_error_out_of_bounds({ token: problem.token, count: problem.pageCount });
    case 'overlap':
      return m.range_error_overlap({ first: problem.first, second: problem.second });
  }
}
