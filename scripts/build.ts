import { build, Glob, $ } from "bun";

await build({
  entrypoints: Array.from(new Glob("./src/index.*.ts").scanSync()),
  minify: true,
  outdir: "./dist",
  target: "node",
  splitting: true,
  packages: "external",
});

await $`bun tsc`;
