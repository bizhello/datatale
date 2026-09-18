export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly sheetNames?: string[],
  ) {
    super(message);
    this.name = "ImportError";
  }
}
