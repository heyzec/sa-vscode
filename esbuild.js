// @ts-check: Show errors in this js file
const esbuild = require("esbuild");
const polyfillNode = require("esbuild-plugin-polyfill-node").polyfillNode;

async function main() {
  const extensionCtx = await esbuild.context({
    entryPoints: ["./src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: "./out/extension.js",
    sourcemap: true,
    external: ["vscode"],
  });

  // const webviewCtx = await esbuild.context({
  //   entryPoints: ["./src/webview/index.tsx"],
  //   bundle: true,
  //   format: "esm",
  //   platform: "browser",
  //   sourcemap: true,
  //   outfile: "./out/webview.js",
  //   plugins: [
  //     polyfillNode({
  //       polyfills: {
  //         fs: true,
  //       },
  //       // globals: {
  //       //   __filename: true,
  //       //   __dirname: true,
  //       // }
  //     }),
  //   ],
  //   define: {
  //     // Needed for the web environment
  //     // Inject these globals manually as esbuild-plugin-polyfill-node is not doing it so
  //     __filename: JSON.stringify("/index.js"),
  //     __dirname: JSON.stringify("/"),
  //   },
  // });

  // Run both configurations at the same time

  if (process.argv.includes("--watch")) {
    await extensionCtx.watch();
    // await webviewCtx.watch();
    console.log("Watching files...");
  } else {
    Promise.all([
      extensionCtx.rebuild(),
      // webviewCtx.rebuild(),
    ]).then(() => {
      console.log("Builds completed successfully.");
      process.exit(0);
    });
  }
}

main();
