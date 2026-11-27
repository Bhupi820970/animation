import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

describe('SVG paper backdrop fallback', () => {
  it('writes a JPEG even when image APIs are unavailable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'svg-bg-'));
    const dest = join(dir, 'bg.jpg');
    try {
      execFileSync('python3', ['scripts/svg_background.py', '--out', dest, '--seed', '7', '--prompt', 'A plaster city wall, no people'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const buf = readFileSync(dest);
      assert.ok(buf.length > 8000, `backdrop too small (${buf.length})`);
      assert.equal(buf[0], 0xff);
      assert.equal(buf[1], 0xd8);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
