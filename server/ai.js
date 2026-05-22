import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MODEL = 'sonnet';

// 코드 블록(```json ... ```) 또는 첫 { ... } 블록에서 JSON 객체 추출.
export function extractJSON(raw) {
  if (!raw) return null;
  try {
    const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    return JSON.parse((match ? match[1] : raw).trim());
  } catch {
    return null;
  }
}

export function parseOutfitsFromOutput(raw) {
  return extractJSON(raw)?.outfits ?? [];
}

// claude/codex CLI를 spawn해 prompt를 보내고 stdout을 반환.
// options.extraArgs: claude에 추가로 넘길 인자 (예: --add-dir, --permission-mode)
// options.swallow: true면 에러를 throw하지 않고 null 반환 (이미지 분석용)
export function runAI(prompt, engine = 'claude', options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, extraArgs = [], swallow = false } = options;
  return new Promise((resolve, reject) => {
    const args = engine === 'claude'
      ? ['-p', '--model', DEFAULT_MODEL, ...extraArgs, prompt]
      : [prompt];
    const proc = spawn(engine, args, { shell: false });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill();
      if (swallow) resolve(null);
      else reject(new Error(`AI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        if (swallow) resolve(null);
        else reject(new Error(`AI process exited with code ${code}: ${stderr.slice(0, 300)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      if (swallow) return resolve(null);
      if (err.code === 'ENOENT') {
        reject(new Error(`AI engine '${engine}' not found. Install Claude Code: https://claude.ai/code or Codex: https://platform.openai.com/docs/guides/code`));
      } else {
        reject(err);
      }
    });
  });
}
