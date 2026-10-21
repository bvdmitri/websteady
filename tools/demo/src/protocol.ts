// The messages between the demo page and its worker.

/** What the page asks for: a clip, how smooth, and how much to crop. */
export interface SteadyRequest {
  readonly file: File;
  readonly smoothing: number;
  readonly crop: number;
}

/** How far the worker is: the pass, frames done of all, and the time each pass took so far. */
export interface SteadyProgress {
  readonly type: 'progress';
  readonly pass: 'analyse' | 'render';
  readonly framesDone: number;
  readonly totalFrames: number;
  readonly elapsedMs: number;
}

/** The finished MP4 and its numbers, or why there is none. */
export type SteadyResult =
  | SteadyProgress
  | {
      readonly type: 'done';
      readonly mp4: ArrayBuffer;
      readonly analyseMsPerFrame: number;
      readonly renderMsPerFrame: number;
      readonly reliableShare: number;
      readonly itfBefore: number;
      readonly itfAfter: number;
    }
  | { readonly type: 'error'; readonly message: string };
