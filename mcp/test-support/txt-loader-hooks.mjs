// Makes `import txt from './file.txt'` resolve under plain Node the same
// way Wrangler's `{ "type": "Text" }` module rule (see wrangler.jsonc)
// resolves it when esbuild bundles the actual Worker: a default export of
// the file's full text content. Node's ESM loader has no built-in notion
// of a .txt module and throws ERR_UNKNOWN_FILE_EXTENSION without this,
// which is what broke `npm test` after src/watchlist.js started importing
// mcp/config/radar-tickers.txt directly. Only used for `node --test` via
// test-support/register-txt-loader.mjs; never touches the deployed Worker.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.txt')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    return { format: 'module', source: `export default ${JSON.stringify(source)};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
