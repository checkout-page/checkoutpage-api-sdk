// Polyfill `File` for Node versions where it isn't a global (Node 18.x).
// `File` was added to `globalThis` in Node 20+; on 18, only `Blob` is global,
// so tests that construct `new File(...)` throw `ReferenceError: File is not defined`.
// Engines is `>=18.0.0` so we keep both versions working.
if (typeof globalThis.File === 'undefined') {
  // @ts-expect-error: assigning a Blob-extending class to the global File slot
  globalThis.File = class File extends Blob {
    readonly name: string;
    readonly lastModified: number;

    constructor(
      parts: BlobPart[],
      name: string,
      options: BlobPropertyBag & { lastModified?: number } = {}
    ) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified ?? Date.now();
    }
  };
}
