// The demo's worker: decodes the picked clip with Mediabunny twice (analyse, then render),
// stabilizes it with websteady, and encodes an H.264 MP4 in memory. Audio is left out.
import {
  analyzeMotion,
  browserPlatform,
  planStabilization,
  stabilize,
  type GrayImage,
  type MotionTrack,
  type Platform,
} from '@bvdmitri/websteady';
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  VideoSample,
  VideoSampleSink,
  VideoSampleSource,
  type InputVideoTrack,
} from 'mediabunny';

import { runningItf, type RunningItf } from './fidelity';
import type { SteadyProgress, SteadyRequest, SteadyResult } from './protocol';

function post(message: SteadyResult, transfer: Transferable[] = []): void {
  (globalThis as unknown as Worker).postMessage(message, transfer);
}

async function videoTrack(file: File): Promise<InputVideoTrack> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  const track = await input.getPrimaryVideoTrack();
  if (track === null) throw new Error('the clip has no video');
  return track;
}

async function* decoded(track: InputVideoTrack): AsyncGenerator<VideoFrame> {
  const samples = new VideoSampleSink(track).samples();
  for await (const sample of samples) {
    yield sample.toVideoFrame();
    sample.close();
  }
}

function reporter(pass: SteadyProgress['pass'], totalFrames: number): (done: number) => void {
  const started = performance.now();
  return (framesDone) => {
    post({
      type: 'progress',
      pass,
      framesDone,
      totalFrames,
      elapsedMs: performance.now() - started,
    });
  };
}

/** The browser platform, with each thumbnail it draws also scored for fidelity. */
function scoring(base: Platform, fidelity: RunningItf): Platform {
  return {
    ...base,
    thumbnail: async (frame): Promise<GrayImage> => {
      const image = await base.thumbnail(frame);
      fidelity.add(image);
      return image;
    },
  };
}

async function encode(
  frames: AsyncIterable<VideoFrame>,
  frameRate: number,
  after: (frame: VideoFrame) => Promise<void>,
): Promise<ArrayBuffer> {
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const video = new VideoSampleSource({ codec: 'avc', bitrate: new Quality('high') });
  output.addVideoTrack(video, { frameRate });
  await output.start();
  for await (const frame of frames) {
    await after(frame);
    const sample = new VideoSample(frame);
    await video.add(sample);
    sample.close();
    frame.close();
  }
  await output.finalize();
  if (output.target.buffer === null) throw new Error('the encoder wrote nothing');
  return output.target.buffer;
}

async function analysed(
  track: InputVideoTrack,
  total: number,
  before: RunningItf,
): Promise<{ motion: MotionTrack; ms: number }> {
  const started = performance.now();
  const motion = await analyzeMotion(decoded(track), {
    platform: scoring(browserPlatform(), before),
    onProgress: reporter('analyse', total),
  });
  return { motion, ms: performance.now() - started };
}

async function steady(request: SteadyRequest): Promise<void> {
  const track = await videoTrack(request.file);
  const stats = await track.computePacketStats();
  const [before, after, base] = [runningItf(), runningItf(), browserPlatform()];
  const { motion, ms: analyseMs } = await analysed(track, stats.packetCount, before);
  const plan = planStabilization(motion, { smoothing: request.smoothing, crop: request.crop });
  const renderStart = performance.now();
  const steadyFrames = stabilize(decoded(track), plan, {
    onProgress: reporter('render', stats.packetCount),
  });
  const mp4 = await encode(steadyFrames, stats.averagePacketRate, async (frame) => {
    after.add(await base.thumbnail(frame));
  });
  const frames = Math.max(motion.frames.length, 1);
  post(
    {
      type: 'done',
      mp4,
      analyseMsPerFrame: analyseMs / frames,
      renderMsPerFrame: (performance.now() - renderStart) / frames,
      reliableShare: motion.frames.filter((f) => f.reliable).length / frames,
      itfBefore: before.value(),
      itfAfter: after.value(),
    },
    [mp4],
  );
}

globalThis.addEventListener('message', (event: MessageEvent<SteadyRequest>) => {
  void (async (): Promise<void> => {
    try {
      await steady(event.data);
    } catch (error) {
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  })();
});
