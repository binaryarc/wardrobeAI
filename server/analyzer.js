import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TMP_DIR = join(__dirname, '..', '.tmp', 'images');

export function detectEngine() {
  for (const engine of ['claude', 'codex']) {
    try {
      execFileSync('which', [engine], { timeout: 2000, stdio: 'ignore' });
      return engine;
    } catch {}
  }
  return null;
}

function runAIText(prompt, engine) {
  return new Promise((resolve, reject) => {
    const args = engine === 'claude' ? ['-p', '--model', 'sonnet', prompt] : [prompt];
    const proc = spawn(engine, args, { shell: false });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.stdin.end();
    const timer = setTimeout(() => { proc.kill(); reject(new Error('AI timeout')); }, 90000);
    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`AI exit ${code}: ${stderr.slice(0, 200)}`));
      else resolve(stdout);
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// 이미지 파일 경로를 프롬프트에 포함시켜 claude/codex가 Read 도구로 직접 읽도록 함.
// stdin으로 바이너리를 던지는 방식은 지원되지 않으므로 사용 금지.
function runAIWithImageFile(prompt, imagePath, engine) {
  return new Promise((resolve) => {
    const dir = dirname(imagePath);
    const args = engine === 'claude'
      ? ['-p', '--model', 'sonnet', '--add-dir', dir, '--permission-mode', 'bypassPermissions', prompt]
      : [prompt];
    const proc = spawn(engine, args, { shell: false });
    let stdout = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stdin.end();
    const timer = setTimeout(() => { proc.kill(); resolve(null); }, 90000);
    proc.on('close', () => { clearTimeout(timer); resolve(stdout); });
    proc.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

function parseJSON(raw) {
  if (!raw) return null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

export async function analyzeImage(imageUrl, engine = null) {
  const eng = engine || detectEngine();
  if (!eng) return null;

  // TMP_DIR 보장
  try { mkdirSync(TMP_DIR, { recursive: true }); } catch {}

  let tmpPath = null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    tmpPath = join(TMP_DIR, `img_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
    writeFileSync(tmpPath, buf);

    const prompt = `다음 이미지 파일을 Read 도구로 직접 읽어 옷을 분석한 뒤 아래 JSON만 출력하세요. 다른 텍스트·코드블록 없이 JSON만:\n파일 경로: ${tmpPath}\n\n{"name": "옷 이름 (예: 화이트 오버핏 셔츠)", "category": "상의 또는 하의 또는 아우터 또는 신발 또는 액세서리 중 하나", "style": "스타일 (예: 캐주얼, 미니멀, 스트릿, 포멀)", "texture": "소재 (예: 면, 린넨, 니트, 데님, 가죽)", "color": "주요 색상", "tags": ["태그1", "태그2"]}`;

    const raw = await runAIWithImageFile(prompt, tmpPath, eng);
    return parseJSON(raw);
  } catch {
    return null;
  } finally {
    if (tmpPath) try { unlinkSync(tmpPath); } catch {}
  }
}

export async function analyzePage(url, engine = null) {
  const eng = engine || detectEngine();
  if (!eng) return null;

  const prompt = `다음 쇼핑 페이지 URL을 분석해서 옷 정보를 JSON으로만 출력하세요. 다른 텍스트 없이 JSON만:\nURL: ${url}\n{"name": "상품명", "category": "상의/하의/아우터/신발/액세서리", "brand": "브랜드명", "price": "가격", "color": "색상", "material": "소재", "style": "스타일", "description": "한줄 설명", "tags": ["태그1"]}`;

  try {
    const raw = await runAIText(prompt, eng);
    return parseJSON(raw);
  } catch {
    return null;
  }
}

export async function runRecommendationAI(prompt, engine = null) {
  const eng = engine || detectEngine();
  if (!eng) throw new Error('claude 또는 codex가 설치되어 있지 않습니다');
  return runAIText(prompt, eng);
}

// 1시간 이상 된 임시 파일 삭제
export function cleanupTmpImages() {
  const now = Date.now();
  try {
    for (const f of readdirSync(TMP_DIR)) {
      const p = join(TMP_DIR, f);
      try {
        if (now - statSync(p).mtimeMs > 3600 * 1000) unlinkSync(p);
      } catch {}
    }
  } catch {}
}
