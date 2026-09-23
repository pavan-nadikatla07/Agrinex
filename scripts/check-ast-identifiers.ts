import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const srcDir = path.resolve(process.cwd(), 'src');

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getAllFiles(srcDir);
console.log(`Analyzing ${files.length} files in src/...`);

const program = ts.createProgram(files, {
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  checkJs: true,
  noEmit: true,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  skipLibCheck: true,
});

const diagnostics = ts.getPreEmitDiagnostics(program);

let undeclaredCount = 0;
for (const diag of diagnostics) {
  if (diag.code === 2304) { // Cannot find name 'x'
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    if (diag.file) {
      const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start || 0);
      const relPath = path.relative(process.cwd(), diag.file.fileName);
      console.log(`⚠️  [UNDECLARED] ${relPath}:${line + 1}:${character + 1} - ${message}`);
      undeclaredCount++;
    }
  }
}

console.log(`\nScan complete. Total undeclared identifier diagnostics (TS2304): ${undeclaredCount}`);
