// Release version SSOT for /health and the OpenAPI document.
//
// Compiled binaries get the version injected at build time from the release
// git tag (see `scripts/build-binary.ts` define — ship-server-binary design
// D2: the tag is the version authority). Source/dev runs fall back to the
// workspace package version.
export const SERVER_VERSION: string = process.env.CL_BUILD_VERSION ?? '2.0.0-dev';
