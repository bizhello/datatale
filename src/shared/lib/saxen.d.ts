declare module "saxen" {
  export class Parser {
    constructor(options?: { proxy?: boolean });
    on(
      event: "openTag",
      listener: (element: {
        name: string;
        attrs: Record<string, string | undefined>;
      }) => void,
    ): void;
    on(event: "error", listener: () => void): void;
    write(value: string): void;
    end(): void;
  }
}
