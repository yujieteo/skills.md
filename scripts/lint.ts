import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const EXCLUDED_FILES = ["state-machine/examples/femahoy-chat/chat.html"];
const SOURCE_EXTENSIONS = [".ts", ".rs", ".html"];
const OUTSIDE_SOURCE = /https?:\/\//;

type Finding = { file: string; line: number; message: string };

const lineOf = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

function commentFinding(file: string, text: string, offset: number, comment: string, base = 0): Finding[] {
  if (OUTSIDE_SOURCE.test(comment)) return [];
  return [{ file, line: lineOf(text, offset) + base, message: `comment without a link to an outside source: ${comment.split("\n")[0]?.slice(0, 60) ?? ""}` }];
}

function leafTokens(root: ts.Node, sf: ts.SourceFile, out: ts.Node[]): void {
  const stack = [root];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) continue;
    const children = node.getChildren(sf);
    if (!children.length) out.push(node);
    stack.push(...children.toReversed());
  }
}

function lintTypeScript(file: string, text: string, base = 0): Finding[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const findings: Finding[] = [];
  const tokens: ts.Node[] = [];
  leafTokens(sf, sf, tokens);
  const seen = new Set<number>();
  for (const t of tokens) {
    for (const range of [...(ts.getLeadingCommentRanges(text, t.pos) ?? []), ...(ts.getTrailingCommentRanges(text, t.pos) ?? [])]) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      findings.push(...commentFinding(file, text, range.pos, text.slice(range.pos, range.end), base));
    }
  }
  const at = (n: ts.Node, message: string): void => {
    findings.push({ file, line: lineOf(text, n.getStart(sf)) + base, message });
  };
  const visit = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.AnyKeyword) at(n, "the type any is not allowed: use unknown and narrow it");
    if (ts.isAsExpression(n) && !(ts.isTypeReferenceNode(n.type) && n.type.typeName.getText(sf) === "const")) at(n, "a type assertion (as) is not allowed: narrow the value");
    if (ts.isTypeAssertionExpression(n)) at(n, "a type assertion (<T>) is not allowed: narrow the value");
    if (ts.isNonNullExpression(n)) at(n, "a non-null assertion (!) is not allowed: handle the missing value");
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(sf) === "JSON.parse" &&
      !(ts.isVariableDeclaration(n.parent) && n.parent.type?.kind === ts.SyntaxKind.UnknownKeyword)
    )
      at(n, "JSON.parse must be the value of a variable of type unknown, then narrowed");
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return findings;
}

function lintCssText(file: string, text: string, base: number): Finding[] {
  const findings: Finding[] = [];
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      findings.push(...commentFinding(file, text, i, text.slice(i, stop), base));
      i = stop - 1;
    }
  }
  return findings;
}

async function lintHtml(file: string, text: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const blocks: { kind: "style" | "script"; text: string; start: number }[] = [];
  let current = "";
  const collect = (kind: "style" | "script") => ({
    element(e: HTMLRewriterTypes.Element) {
      current = "";
      e.onEndTag(() => {
        const start = text.indexOf(current);
        blocks.push({ kind, text: current, start: Math.max(start, 0) });
      });
    },
    text(t: HTMLRewriterTypes.Text) {
      current += t.text;
    },
  });
  await new HTMLRewriter()
    .on("style", collect("style"))
    .on("script", collect("script"))
    .onDocument({
      comments(c) {
        findings.push(...commentFinding(file, text, 0, c.text).map((f) => ({ ...f, line: 0 })));
      },
    })
    .transform(new Response(text))
    .text();
  for (const b of blocks) {
    const base = lineOf(text, b.start) - 1;
    findings.push(...(b.kind === "style" ? lintCssText(file, b.text, base) : lintTypeScript(file, b.text, base)));
  }
  return findings;
}

function lintRust(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  let i = 0;
  const skipString = (from: number, hashes: number): number => {
    const close = '"' + "#".repeat(hashes);
    for (let j = from; j < text.length; j++) {
      if (hashes === 0 && text[j] === "\\") j++;
      else if (text.startsWith(close, j)) return j + close.length;
    }
    return text.length;
  };
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const stop = end < 0 ? text.length : end;
      findings.push(...commentFinding(file, text, i, text.slice(i, stop)));
      i = stop;
    } else if (c === "/" && text[i + 1] === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text.startsWith("/*", j)) {
          depth++;
          j += 2;
        } else if (text.startsWith("*/", j)) {
          depth--;
          j += 2;
        } else j++;
      }
      findings.push(...commentFinding(file, text, i, text.slice(i, j)));
      i = j;
    } else if (c === "r" || c === "b") {
      const raw = /^b?r(#*)"/.exec(text.slice(i));
      if (raw) i = skipString(i + raw[0].length, (raw[1] ?? "").length);
      else if (c === "b" && text[i + 1] === '"') i = skipString(i + 2, 0);
      else i++;
    } else if (c === '"') i = skipString(i + 1, 0);
    else if (c === "'") {
      const literal = /^'(?:\\.[^']*|[^\\'])'/.exec(text.slice(i));
      i += literal ? literal[0].length : 1;
    } else i++;
  }
  return findings;
}

function listFiles(): string[] {
  const done = Bun.spawnSync(["git", "ls-files", "--cached", "--others", "--exclude-standard"], { cwd: path.join(import.meta.dir, ".."), stdout: "pipe" });
  return done.stdout
    .toString()
    .split("\n")
    .filter((f) => f && SOURCE_EXTENSIONS.includes(path.extname(f)) && !EXCLUDED_FILES.includes(f));
}

export async function lintFile(file: string, text: string): Promise<Finding[]> {
  const ext = path.extname(file);
  if (ext === ".ts") return lintTypeScript(file, text);
  if (ext === ".rs") return lintRust(file, text);
  return lintHtml(file, text);
}

if (import.meta.main) {
  const root = path.join(import.meta.dir, "..");
  const all: Finding[] = [];
  for (const file of listFiles()) all.push(...(await lintFile(file, readFileSync(path.join(root, file), "utf8"))));
  for (const f of all) console.log(`${f.file}:${f.line}: ${f.message}`);
  const total = all.length;
  console.log(`lint: ${total} finding(s)`);
  process.exit(total ? 1 : 0);
}
