// Single source of truth for the configured Stock Entry Radar watchlist.
// Bundled into the Worker at deploy time via the "Text" module rule in
// wrangler.jsonc, from the exact same file the SEC companyfacts sync
// GitHub Action (.github/workflows/sec-companyfacts-sync.yml) reads at
// checkout time - so the Worker and the SEC mirror pipeline can never
// silently drift onto two different lists. Parsing mirrors that workflow's
// Python one-liner: strip blank lines and lines starting with '#', trim,
// uppercase.
import RADAR_TICKERS_TXT from '../config/radar-tickers.txt';

export function getConfiguredTickers() {
  return RADAR_TICKERS_TXT
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => line.toUpperCase());
}
