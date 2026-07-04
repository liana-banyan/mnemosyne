import { ipcMain } from 'electron';

export function registerGemmaMultiSegIPC(): void {
  ipcMain.handle('gemma:multi-seg-dispatch', async (_event, options: {
    question: string;
    workerCount?: number;
    model?: string;
  }) => {
    const { question, workerCount = 3, model = 'gemma4:12b' } = options;
    const ollamaUrl = 'http://localhost:11434/api/generate';

    const workerPromises = Array.from({ length: workerCount }, () =>
      fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: question, stream: false }),
      })
        .then((r) => r.json() as Promise<{ response: string }>)
        .then((d) => d.response)
        .catch((e: unknown) => `ERROR: ${String(e)}`),
    );

    const settled = await Promise.allSettled(workerPromises);
    const responses = settled.map((r) =>
      r.status === 'fulfilled' ? r.value : `ERROR: ${r.reason}`,
    );

    const uniqueResponses = [...new Set(responses)];
    const variance = (uniqueResponses.length - 1) / Math.max(workerCount - 1, 1);

    let synthesized: string;
    if (uniqueResponses.length === 1) {
      synthesized = responses[0];
    } else {
      const frequency = new Map<string, number>();
      for (const r of responses) {
        frequency.set(r, (frequency.get(r) ?? 0) + 1);
      }
      synthesized = [...frequency.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    return { synthesized, variance, workerResponses: responses, model, workerCount };
  });
}
