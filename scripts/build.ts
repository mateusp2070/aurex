import { build, Glob, $ } from "bun";
import { existsSync, rmSync } from "fs";

if (existsSync("./dist")) rmSync("./dist", { recursive: true });

await build({
  entrypoints: Array.from(new Glob("./src/index{.*.ts,.ts}").scanSync()),
  minify: true,
  outdir: "./dist",
  target: "node",
  splitting: true,
  packages: "external",
});

await $`bun tsc`;
