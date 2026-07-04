import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');

export function registerThunderclapFireIPC(): void {
  ipcMain.handle('thunderclap:fire-trial-02', async (event, options: { flagshipTier: 'claude' | 'gemma' }) => {
    const { flagshipTier } = options;

    const gatesResult = await new Promise<{ allGreen: boolean; output: string }>((resolve) => {
      const gatesProc = spawn('node', [
        path.join(WORKSPACE_ROOT, 'tools', 'mesh-validation', 'gates_check.mjs'),
      ], { cwd: WORKSPACE_ROOT });
      let output = '';
      gatesProc.stdout.on('data', (d: Buffer) => {
        const line = d.toString();
        output += line;
        event.sender.send('thunderclap:log', line);
      });
      gatesProc.stderr.on('data', (d: Buffer) => {
        const line = d.toString();
        output += line;
        event.sender.send('thunderclap:log', line);
      });
      gatesProc.on('close', (code: number | null) => {
        resolve({ allGreen: code === 0, output });
      });
    });

    if (!gatesResult.allGreen) {
      event.sender.send('thunderclap:gates-failed', gatesResult.output);
      return { status: 'gates-failed' as const };
    }

    return await new Promise<{ status: string; accuracy?: string; receiptPath?: string }>((resolve) => {
      const fireProc = spawn('node', [
        path.join(WORKSPACE_ROOT, 'tools', 'mesh-validation', 'validate-relay.mjs'),
        '--routing=staggered-then-connected',
        '--mode=full',
        '--questions=70',
        '--wire=hex-mcode',
        '--plow=mesh-12-blade',
        '--andon-escalate=star-chamber',
        `--flagship-tier=${flagshipTier}`,
      ], { cwd: WORKSPACE_ROOT });

      let lastLine = '';
      fireProc.stdout.on('data', (d: Buffer) => {
        const line = d.toString();
        lastLine = line;
        event.sender.send('thunderclap:log', line);
      });
      fireProc.stderr.on('data', (d: Buffer) => {
        event.sender.send('thunderclap:log', d.toString());
      });
      fireProc.on('close', (exitCode: number | null) => {
        const accuracyMatch = lastLine.match(/accuracy[:\s]+(\d+\/\d+|\d+\.?\d*%)/i);
        const accuracy = accuracyMatch ? accuracyMatch[1] : 'unknown';
        const receiptPath = '';
        event.sender.send('thunderclap:complete', { accuracy, receiptPath, exitCode: exitCode ?? -1 });
        resolve({ status: 'complete', accuracy, receiptPath });
      });
    });
  });

  ipcMain.handle('thunderclap:check-gates', async (event) => {
    return new Promise<{ allGreen: boolean; output: string }>((resolve) => {
      const gatesProc = spawn('node', [
        path.join(WORKSPACE_ROOT, 'tools', 'mesh-validation', 'gates_check.mjs'),
      ], { cwd: WORKSPACE_ROOT });
      let output = '';
      gatesProc.stdout.on('data', (d: Buffer) => {
        const line = d.toString();
        output += line;
        event.sender.send('thunderclap:log', line);
      });
      gatesProc.stderr.on('data', (d: Buffer) => {
        const line = d.toString();
        output += line;
        event.sender.send('thunderclap:log', line);
      });
      gatesProc.on('close', (code: number | null) => {
        resolve({ allGreen: code === 0, output });
      });
    });
  });
}
