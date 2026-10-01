/** An error carrying an HTTP status — thrown from services/handlers and mapped by
 *  `handle()` to `{ error: { message } }` with that status. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
