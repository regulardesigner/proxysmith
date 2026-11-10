import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const MANA_FONT_CSS = /mana-font[\\/]css[\\/]mana\.min\.css$/;
const MPLANTIN_FONT_FACE = /@font-face\{font-family:"MPlantin";[^}]*\}/g;
const MPLANTIN_FONT_FAMILY = /font-family:"MPlantin, Garamond/g;
const OFL_FONT_FAMILY = 'font-family:"EB Garamond", Garamond';

/**
 * mana-font declares a proprietary MPlantin @font-face and references it in its
 * mana symbol rules. Remove the @font-face and fall back to EB Garamond so no
 * proprietary font asset is bundled or used (AGENTS.md: OFL fonts only).
 */
function stripMplantin(): Plugin {
  return {
    name: 'proxysmith-strip-mplantin',
    enforce: 'pre',
    transform(code, id) {
      if (!MANA_FONT_CSS.test(id)) return null;

      const stripped = code
        .replace(MPLANTIN_FONT_FACE, '')
        .replace(MPLANTIN_FONT_FAMILY, OFL_FONT_FAMILY);

      return stripped === code ? null : { code: stripped, map: null };
    },
  };
}

export default defineConfig({
  plugins: [stripMplantin(), react(), tailwindcss()],
});
