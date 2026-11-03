import { expect, test } from "bun:test";
import { lintFile } from "./lint.ts";

const messages = async (file: string, text: string): Promise<string[]> => (await lintFile(file, text)).map((f) => `${f.line}:${f.message.split(":")[0]}`);

test("a TypeScript comment is a finding", async () => {
  expect(await messages("a.ts", "const a = 1;\n// why\nconst b = 2; /* here */\n")).toEqual(["2:comment without a link to an outside source", "3:comment without a link to an outside source"]);
});

test("a TypeScript comment that links to an outside source stays", async () => {
  expect(await messages("a.ts", "// https://example.com/rfc\nconst a = 1;\n")).toEqual([]);
});

test("a string, a template and a regex that look like a comment are not findings", async () => {
  const text = 'const a = "// no"; const b = `/* no ${a} */`; const c = /\\/\\/ no/; const d = "#fff";\n';
  expect(await messages("a.ts", text)).toEqual([]);
});

test("the type any, an assertion and a non-null assertion are findings", async () => {
  const text = "const a: any = 1;\nconst b = a as string;\nconst c = <string>a;\nconst d = [1][0]!;\n";
  expect(await messages("a.ts", text)).toEqual([
    "1:the type any is not allowed",
    "2:a type assertion (as) is not allowed",
    "3:a type assertion (<T>) is not allowed",
    "4:a non-null assertion (!) is not allowed",
  ]);
});

test("as const and satisfies are allowed", async () => {
  expect(await messages("a.ts", "const a = [1] as const;\nconst b = { c: 1 } satisfies object;\n")).toEqual([]);
});

test("JSON.parse is a finding unless it is the value of a variable of type unknown", async () => {
  expect(await messages("a.ts", "const a = JSON.parse('1');\nconst b: unknown = JSON.parse('1');\n")).toEqual(["1:JSON.parse must be the value of a variable of type unknown, then narrowed"]);
});

test("a Rust comment is a finding and a string, a raw string, a char and a lifetime are not", async () => {
  const text = [
    "//! doc",
    'const A: &str = "// no";',
    'const B: &str = r#"/* no */"#;',
    "fn f<'a>(x: &'a str) -> char { let _ = x; '/' }",
    "/* outer /* nested */ still */",
    "",
  ].join("\n");
  expect(await messages("a.rs", text)).toEqual(["1:comment without a link to an outside source", "5:comment without a link to an outside source"]);
});

test("an HTML comment, a CSS comment and a script comment are findings", async () => {
  const html = "<!doctype html>\n<!-- x -->\n<style>\na { color: #fff; content: '/* no */'; } /* y */\n</style>\n<script>\nconst a = 1; // z\n</script>\n";
  const found = await lintFile("a.html", html);
  expect(found.map((f) => f.line).sort()).toEqual([0, 4, 7]);
});
