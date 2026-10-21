// The demo page: pick a clip, choose how smooth and how much to crop, watch the passes, compare.
import type { SteadyRequest, SteadyResult } from './protocol';

const PERCENT = 100;

function element(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`#${id}`);
  if (found === null) throw new Error(`the page has no #${id}`);
  return found;
}

const form = element('form') as HTMLFormElement;
const status = element('status') as HTMLPreElement;
const bar = element('progress') as HTMLProgressElement;
const original = element('original') as HTMLVideoElement;
const result = element('result') as HTMLVideoElement;
const download = element('download') as HTMLAnchorElement;

function request(): SteadyRequest | undefined {
  const data = new FormData(form);
  const file = data.get('file');
  const isPicked = file instanceof File && file.size > 0;
  return isPicked
    ? { file, smoothing: Number(data.get('smoothing')), crop: Number(data.get('crop')) }
    : undefined;
}

function done(message: Extract<SteadyResult, { type: 'done' }>, name: string): void {
  const url = URL.createObjectURL(new Blob([message.mp4], { type: 'video/mp4' }));
  result.src = url;
  download.href = url;
  download.download = name.replace(/\.[^.]+$/u, '') + '-steady.mp4';
  download.hidden = false;
  status.textContent = [
    `Analyse: ${message.analyseMsPerFrame.toFixed(1)} ms per frame`,
    `Render and encode: ${message.renderMsPerFrame.toFixed(1)} ms per frame`,
    `Frames with reliable motion: ${(message.reliableShare * PERCENT).toFixed(0)}%`,
    `ITF before: ${message.itfBefore.toFixed(2)} dB, after: ${message.itfAfter.toFixed(2)} dB`,
    'Done.',
  ].join('\n');
}

function show(message: SteadyResult, name: string): void {
  if (message.type === 'error') {
    status.textContent = `Failed: ${message.message}`;
    return;
  }
  if (message.type === 'done') {
    done(message, name);
    return;
  }
  bar.max = message.totalFrames;
  bar.value = message.framesDone;
  status.textContent = `${message.pass === 'analyse' ? 'Analysing' : 'Rendering'}: ${message.framesDone} of ${message.totalFrames} frames`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const asked = request();
  if (asked === undefined) return;
  original.src = URL.createObjectURL(asked.file);
  download.hidden = true;
  const worker = new Worker(new URL('worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (message: MessageEvent<SteadyResult>) => {
    show(message.data, asked.file.name);
    if (message.data.type !== 'progress') worker.terminate();
  });
  worker.postMessage(asked);
});
