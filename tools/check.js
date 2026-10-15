// 커밋 전 검사: index.html · tests/selftest.html 의 <script>가 문법 오류 없이 읽히는지,
// 이모지가 들어가지 않았는지 확인한다.  실행: node tools/check.js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let failed = false;

for (const file of ["index.html", "tests/selftest.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((code, i) => {
    try {
      new Function(code);
    } catch (e) {
      failed = true;
      console.error(`[실패] ${file} <script #${i + 1}> 문법 오류: ${e.message}`);
    }
  });
  const emoji = html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/u);
  if (emoji) {
    failed = true;
    console.error(`[실패] ${file} 이모지 발견: ${emoji[0]}`);
  }
  if (!failed) console.log(`[통과] ${file} (script ${scripts.length}개)`);
}

process.exit(failed ? 1 : 0);
