/**
 * Feature envy detector.
 *
 * For every exported function in src/, count where its references live, grouped by the
 * module that owns them. A function whose callers are overwhelmingly in one *other*
 * module, and hardly at all in its own, is probably declared in the wrong place.
 *
 * Flagged when:  >50% of references come from one other module
 *            and <20% come from the function's own module
 *
 * Writes markdown to stdout. Advisory only: the quality gate records the output and never
 * fails on it, because a high-envy function is sometimes exactly right (a factory, a
 * shared constant, an adapter that exists precisely to serve one consumer).
 *
 * Usage: npx tsx scripts/feature-envy.ts
 */
import { Project, SyntaxKind, type ReferencedSymbolEntry, type SourceFile } from 'ts-morph';

const ENVY_THRESHOLD = 0.5;
const HOME_THRESHOLD = 0.2;

interface Finding {
  readonly name: string;
  readonly home: string;
  readonly envied: string;
  readonly enviedShare: number;
  readonly homeShare: number;
  readonly total: number;
}

/** The module a file belongs to: its directory, which is the unit our layer rules police. */
function moduleOf(file: SourceFile): string {
  const path = file.getFilePath();
  const relative = path.slice(path.indexOf('/src/') + 1);
  const dir = relative.slice(0, relative.lastIndexOf('/'));
  return dir === '' ? relative : dir;
}

function exportedFunctions(file: SourceFile) {
  return file.getFunctions().filter((fn) => fn.isExported() && fn.getName() !== undefined);
}

/**
 * The module a reference counts toward, or undefined when it is not a usage site.
 *
 * Tests are not callers, and neither is the import or re-export that merely names the
 * function -- counting those would score every function by how many modules mention it
 * rather than by how many actually use it.
 */
function usageModule(reference: ReferencedSymbolEntry): string | undefined {
  if (reference.isDefinition()) return undefined;
  const file = reference.getSourceFile();
  if (!file.getFilePath().includes('/src/')) return undefined;
  const node = reference.getNode();
  if (node.getFirstAncestorByKind(SyntaxKind.ExportDeclaration) !== undefined) return undefined;
  if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) !== undefined) return undefined;
  return moduleOf(file);
}

function countReferences(fn: ReturnType<typeof exportedFunctions>[number]): Map<string, number> {
  const counts = new Map<string, number>();
  const declaration = fn.getNameNode();
  if (declaration === undefined) return counts;

  for (const referencedSymbol of declaration.findReferences()) {
    for (const reference of referencedSymbol.getReferences()) {
      const owner = usageModule(reference);
      if (owner !== undefined) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
  }
  return counts;
}

function analyse(project: Project): Finding[] {
  const findings: Finding[] = [];

  for (const file of project.getSourceFiles('src/**/*.ts')) {
    const home = moduleOf(file);
    for (const fn of exportedFunctions(file)) {
      const counts = countReferences(fn);
      const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
      if (total === 0) continue;

      const homeCount = counts.get(home) ?? 0;
      const others = [...counts.entries()].filter(([owner]) => owner !== home);
      if (others.length === 0) continue;

      others.sort((a, b) => b[1] - a[1]);
      const [enviedModule, enviedCount] = others[0]!;
      const enviedShare = enviedCount / total;
      const homeShare = homeCount / total;

      if (enviedShare > ENVY_THRESHOLD && homeShare < HOME_THRESHOLD) {
        findings.push({
          name: fn.getName()!,
          home,
          envied: enviedModule,
          enviedShare,
          homeShare,
          total,
        });
      }
    }
  }
  return findings.sort((a, b) => b.enviedShare - a.enviedShare);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function report(findings: Finding[]): string {
  const lines: string[] = [
    '# Placement report — feature envy',
    '',
    'Exported functions in `src/` whose references cluster in a module other than their own.',
    `Flagged when more than ${percent(ENVY_THRESHOLD)} of references come from one other module`,
    `and less than ${percent(HOME_THRESHOLD)} come from the function's own module.`,
    '',
    '**This is advisory.** The quality gate never fails on it. A flagged function is a question,',
    'not a defect: sometimes a function genuinely belongs where it is. The reviewer judges each one.',
    '',
  ];

  if (findings.length === 0) {
    lines.push('No functions flagged.', '');
    return lines.join('\n');
  }

  lines.push(
    '| Function | Declared in | Most referenced from | Share there | Share at home | Refs |',
    '|---|---|---|---|---|---|',
  );
  for (const f of findings) {
    lines.push(
      `| \`${f.name}\` | \`${f.home}\` | \`${f.envied}\` | ${percent(f.enviedShare)} | ${percent(f.homeShare)} | ${f.total} |`,
    );
  }
  lines.push(
    '',
    '## How to read this',
    '',
    'For each row, decide one of:',
    '',
    '- **Move it.** The function belongs in the module that uses it. Check the layer rules first —',
    '  moving it must not create an import that `.dependency-cruiser.cjs` forbids.',
    '- **Leave it.** It is shared API, or a deliberate seam, and the concentration is incidental.',
    '- **Split it.** Part of it belongs elsewhere.',
    '',
  );
  return lines.join('\n');
}

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
process.stdout.write(report(analyse(project)));
