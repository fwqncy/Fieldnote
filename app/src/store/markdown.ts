// Lightweight Markdown scanning for links, tags, tasks and headings. The
// preview renderer lives in views/Preview.tsx; these helpers feed the index.

const FENCE = /```[\s\S]*?(```|$)/g;
const LINK = /(!?)\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g;
const TAG = /(^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;
const TASK = /^(\s*)[-*+] \[( |x|X)\] (.*)$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;

const stripCode = (body: string) => body.replace(FENCE, (m) => m.replace(/[^\n]/g, ' '));

export function links(body: string): { target: string; embed: boolean }[] {
  const out: { target: string; embed: boolean }[] = [];
  for (const m of stripCode(body).matchAll(LINK)) out.push({ target: m[2].trim(), embed: m[1] === '!' });
  return out;
}

export function tags(body: string): string[] {
  const set = new Set<string>();
  for (const m of stripCode(body).matchAll(TAG)) set.add(m[2].toLowerCase());
  return [...set];
}

export type Task = { line: number; offset: number; done: boolean; text: string; depth: number };

export function tasks(body: string): Task[] {
  const out: Task[] = [];
  let offset = 0;
  stripCode(body)
    .split('\n')
    .forEach((line, i) => {
      const m = TASK.exec(line);
      if (m) out.push({ line: i, offset: offset + line.indexOf('[') + 1, done: m[2] !== ' ', text: m[3], depth: m[1].length });
      offset += line.length + 1;
    });
  return out;
}

export type Heading = { level: number; text: string; line: number };

export function headings(body: string): Heading[] {
  const out: Heading[] = [];
  stripCode(body)
    .split('\n')
    .forEach((line, i) => {
      const m = HEADING.exec(line);
      if (m) out.push({ level: m[1].length, text: m[2], line: i });
    });
  return out;
}

/** First meaningful line, stripped of Markdown syntax. */
export function excerpt(body: string, max = 120): string {
  const line =
    stripCode(body)
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !HEADING.test(l) && l !== '---') ?? '';
  const plain = line
    .replace(/^[-*+>]\s*(\[[ xX]\]\s*)?/, '')
    .replace(/^\[!\w+\]\s*/, '')
    .replace(LINK, (_m, _e, t, alias) => alias ?? t)
    .replace(/[*_`~=]/g, '');
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain;
}

export function wordCount(body: string): number {
  return (body.match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;
}

/** Lines of `body` mentioning `needle`, for backlink context. */
export function contextLines(body: string, needle: RegExp): string[] {
  return body
    .split('\n')
    .filter((l) => needle.test(l))
    .map((l) => l.trim())
    .slice(0, 3);
}

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
