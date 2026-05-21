import { spawn } from 'node:child_process';

export function parseOutfitsFromOutput(raw) {
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr.trim());
    return parsed.outfits ?? [];
  } catch {
    return [];
  }
}

export function runAI(prompt, engine = 'claude', timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const args = engine === 'claude' ? ['-p', prompt] : [prompt];
    const proc = spawn(engine, args, { shell: false });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`AI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`AI process exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', err => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error(`AI engine '${engine}' not found. Install Claude Code: https://claude.ai/code or Codex: https://platform.openai.com/docs/guides/code`));
      } else {
        reject(err);
      }
    });
  });
}
