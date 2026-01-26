import { build, Glob, $ } from "bun";
import { rmSync } from "fs";

rmSync("./dist", { recursive: true });

await build({
  entrypoints: Array.from(new Glob("./src/index.*.ts").scanSync()),
  minify: true,
  outdir: "./dist",
  target: "node",
  splitting: true,
  packages: "external",
});

await $`bun tsc`;
