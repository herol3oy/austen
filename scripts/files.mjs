import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const hash = value => createHash('sha256').update(value).digest('hex');
export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, content, { flag: 'wx' }); await rename(temp, path); }
  finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
export const writeJson = (path, value) => atomicWrite(path, JSON.stringify(value, null, 2) + '\n');
export const isMain = url => process.argv[1] && fileURLToPath(url) === resolve(process.argv[1]);
export async function withLock(root, task) {
  const path = resolve(root, 'data/.maintenance.lock'); await mkdir(dirname(path), { recursive: true });
  const owner = JSON.stringify({ pid: process.pid, hostname: hostname(), startedAt: new Date().toISOString(), token: randomUUID() });
  try { await writeFile(path, owner, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Serialize stale-lock recovery, then recheck the owner. Never displace a live process.
    const recovery = `${path}.recovery`;
    try { await writeFile(recovery, owner, { flag: 'wx' }); }
    catch { throw new Error('Another maintenance process is recovering the lock. Retry when it finishes.'); }
    try {
      const previous = await readJson(path, null);
      if (previous) {
        if (!Number.isSafeInteger(previous.pid) || previous.pid <= 0 || (previous.hostname && previous.hostname !== hostname())) throw new Error('Maintenance lock has an unknown owner; inspect data/.maintenance.lock.');
        let alive = true;
        try { process.kill(previous.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
        if (alive) throw new Error(`Maintenance is already running (PID ${previous.pid}).`);
        await unlink(path);
      }
      try { await writeFile(path, owner, { flag: 'wx' }); }
      catch (error) { if (error.code === 'EEXIST') throw new Error('Another maintenance process acquired the lock.'); throw error; }
    } finally { await unlink(recovery); }
  }
  try { return await task(); }
  finally { if (await readFile(path, 'utf8').catch(() => null) === owner) await unlink(path); }
}
