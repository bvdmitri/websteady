/**
 * Why websteady could not do what it was asked, as a code an application can act on.
 *
 * @remarks `canvas-unavailable`: the browser (or the worker) has no `OffscreenCanvas` with a 2D
 * context, which both the analysis and the rendering draw on.
 */
export type WebsteadyErrorCode = 'canvas-unavailable';

/** A failure with its {@link WebsteadyErrorCode}. */
export class WebsteadyError extends Error {
  public override readonly name = 'WebsteadyError';
  public readonly code: WebsteadyErrorCode;

  public constructor(code: WebsteadyErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
