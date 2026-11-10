import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

mkdirSync('tmp', { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });

const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

async function assertSearchFocus(label) {
  const activeId = await page.evaluate(() => document.activeElement?.id);
  if (activeId !== 'card-search') {
    throw new Error(`Le focus ne revient pas au champ de recherche (${label}) : ${activeId}`);
  }
}

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'tmp/01-home.png', fullPage: true });

const combobox = page.getByRole('combobox');
await combobox.fill('Foudre');
await page.getByRole('option').first().waitFor({ timeout: 15000 });

// L'option active doit être reliée au combobox pour être annoncée par les lecteurs d'écran.
const activeDescendant = await combobox.getAttribute('aria-activedescendant');
if (!activeDescendant) throw new Error('aria-activedescendant absent du combobox');
if ((await page.locator(`[id="${activeDescendant}"]`).count()) === 0) {
  throw new Error('aria-activedescendant ne pointe pas vers une option');
}

// Les options sont pilotées au clavier depuis le combobox : elles ne doivent pas être des tab stops.
const optionTabIndexes = await page
  .getByRole('option')
  .evaluateAll((options) => options.map((option) => option.tabIndex));
if (optionTabIndexes.some((tabIndex) => tabIndex !== -1)) {
  throw new Error(`Les options doivent être hors du flux de tabulation : ${optionTabIndexes}`);
}

console.log('--- FIRST RESULT ---');
console.log(await page.getByRole('option').first().innerText());
await page.screenshot({ path: 'tmp/02-results.png', fullPage: true });

await page.getByRole('option', { name: /^Foudre/ }).first().click();
await page.locator('.mtg-card').waitFor();
await page.waitForTimeout(600);
await assertSearchFocus('sélection souris');
await page.screenshot({ path: 'tmp/03-card.png', fullPage: true });

const cardText = await page.locator('.mtg-card').innerText();
console.log('--- CARD TEXT ---');
console.log(cardText);

async function readLayout() {
  return page.evaluate(() => {
    const card = document.querySelector('.mtg-card');
    const pos = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        top: element.offsetTop,
        left: element.offsetLeft,
        width: element.offsetWidth,
        height: element.offsetHeight,
        fontSize: style.fontSize,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    };

    return {
      card: { width: card?.offsetWidth, height: card?.offsetHeight },
      title: pos('.mtg-title'),
      art: pos('.mtg-art'),
      type: pos('.mtg-type'),
      text: pos('.mtg-text'),
      oracle: pos('.mtg-oracle'),
      bottom: pos('.mtg-bottom'),
      manaPips: document.querySelectorAll('.mtg-mana .ms-cost').length,
      oraclePips: document.querySelectorAll('.mtg-oracle .ms-cost').length,
      artImage: document.querySelector('.mtg-art-img')
        ? {
            width: document.querySelector('.mtg-art-img').offsetWidth,
            height: document.querySelector('.mtg-art-img').offsetHeight,
          }
        : null,
    };
  });
}

function assertLayout(layout, label) {
  if (layout.card.width !== 750 || layout.card.height !== 1050) {
    throw new Error(`${label} : mauvaise taille ${layout.card.width}x${layout.card.height}`);
  }
  if (layout.title.top + layout.title.height > layout.art.top) {
    throw new Error(`${label} : titre / art overlap`);
  }
  if (layout.art.top + layout.art.height > layout.type.top) {
    throw new Error(`${label} : art / type overlap`);
  }
  if (layout.type.top + layout.type.height > layout.text.top) {
    throw new Error(`${label} : type / texte overlap`);
  }
  if (layout.text.top + layout.text.height > layout.bottom.top) {
    throw new Error(`${label} : texte / bas overlap`);
  }
  if (layout.oracle.scrollHeight > layout.oracle.clientHeight + 1) {
    throw new Error(`${label} : texte déborde`);
  }
}

const layout = await readLayout();
console.log('--- LAYOUT ---');
console.log(JSON.stringify(layout, null, 2));

const name = await page.locator('.mtg-name').innerText();
if (!name.includes('Foudre')) throw new Error(`Mauvais classement : ${name}`);
assertLayout(layout, 'Signature');
if (layout.manaPips !== 1) throw new Error(`Symboles de mana : ${layout.manaPips}`);

// Chaque template doit conserver une mise en page sans chevauchement.
for (const [label, pattern] of [
  ['1993', /1993/],
  ['2026', /2026/],
  ['Signature', /Signature/],
]) {
  await page.getByRole('button', { name: pattern }).click();
  await page.waitForTimeout(250);
  const templateLayout = await readLayout();
  assertLayout(templateLayout, label);
  console.log(`--- TEMPLATE ${label} --- ${templateLayout.card.width}x${templateLayout.card.height}`);
}

// Couleur de cadre indépendante + dégradé bicolore (2026) + relief 1993.
await combobox.fill("Dovin's Veto");
await page.getByRole('option').first().waitFor({ timeout: 15000 });
await page.getByRole('option').first().click();
await page.waitForTimeout(500);

await page.getByRole('button', { name: /2026/ }).click();
await page.waitForTimeout(300);
const dualColor = await page.evaluate(() => {
  const style = getComputedStyle(document.querySelector('.mtg-card'));
  return {
    accent: style.getPropertyValue('--frame-accent').trim(),
    accent2: style.getPropertyValue('--frame-accent-2').trim(),
    name: document.querySelector('.mtg-name')?.textContent,
  };
});
console.log('--- DUAL COLOR 2026 ---');
console.log(JSON.stringify(dualColor));
if (dualColor.accent === dualColor.accent2) throw new Error('Dégradé bicolore absent');

await page.getByRole('button', { name: 'Couleur de cadre : Rouge' }).click();
await page.waitForTimeout(250);
const forcedColor = await page.evaluate(() => {
  const style = getComputedStyle(document.querySelector('.mtg-card'));
  return {
    accent: style.getPropertyValue('--frame-accent').trim(),
    accent2: style.getPropertyValue('--frame-accent-2').trim(),
    stored: localStorage.getItem('proxysmith:accent'),
  };
});
console.log('--- FORCED COLOR ---');
console.log(JSON.stringify(forcedColor));
if (forcedColor.accent !== '#ff8a68' || forcedColor.accent2 !== '#ff8a68') {
  throw new Error('Couleur de cadre imposée non appliquée');
}
if (forcedColor.stored !== 'R') throw new Error('Couleur de cadre non persistée');

await page.getByRole('button', { name: 'Couleur automatique' }).click();
await page.waitForTimeout(250);

await page.getByRole('button', { name: /1993/ }).click();
await page.waitForTimeout(300);
const classicFrame = await page.evaluate(() => {
  const card = document.querySelector('.mtg-card');
  const cardStyle = getComputedStyle(card);
  const titleStyle = getComputedStyle(document.querySelector('.mtg-title'));
  const textStyle = getComputedStyle(document.querySelector('.mtg-text'));
  return {
    accent: cardStyle.getPropertyValue('--frame-accent').trim(),
    accent2: cardStyle.getPropertyValue('--frame-accent-2').trim(),
    titleInk: cardStyle.getPropertyValue('--frame-title-ink').trim(),
    cardShadow: cardStyle.boxShadow,
    titleShadow: titleStyle.boxShadow,
    textBackground: textStyle.backgroundImage,
    artBorder: getComputedStyle(document.querySelector('.mtg-art-frame')).borderTopWidth,
  };
});
console.log('--- CLASSIC EMBOSS ---');
console.log(
  JSON.stringify({
    ...classicFrame,
    cardShadow: classicFrame.cardShadow.slice(0, 120),
    titleShadow: classicFrame.titleShadow.slice(0, 120),
    textBackground: classicFrame.textBackground.slice(0, 120),
  }),
);
if (classicFrame.accent !== '#dfc47c') throw new Error('Cadre 1993 multicolore non doré');
if (!classicFrame.cardShadow.includes('inset')) throw new Error('Relief du cadre 1993 absent');
if (!classicFrame.titleShadow.includes('inset')) throw new Error('Plaque de titre non embossée');
if (!classicFrame.textBackground.includes('repeating-linear-gradient')) {
  throw new Error('Texture parchemin absente');
}
if (classicFrame.artBorder !== '2px') throw new Error('Liseré intérieur 1993 absent');

// Retour au template Signature pour la suite du parcours.
await page.getByRole('button', { name: /Signature/ }).click();
await page.waitForTimeout(250);

// Generate an original abstract illustration with Chrome itself.
const artPage = await browser.newPage({ viewport: { width: 800, height: 1200 } });
await artPage.setContent(`
  <div id="art" style="width:800px;height:1200px;background:
    radial-gradient(circle at 30% 25%, #f4c56a 0 6%, transparent 34%),
    radial-gradient(circle at 68% 55%, #5b8ec9 0 8%, transparent 40%),
    radial-gradient(circle at 40% 80%, #b35a3c 0 10%, transparent 45%),
    linear-gradient(160deg, #151d2a 0%, #263243 45%, #0d1117 100%);">
    <div style="width:100%;height:100%;opacity:.35;background:repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.08) 22px 23px)"></div>
  </div>
`);
await artPage.locator('#art').screenshot({ path: 'tmp/art.png' });
await artPage.close();

await page.locator('input[type="file"]').setInputFiles('tmp/art.png');
await page.waitForTimeout(500);
const artState = await page.evaluate(() => {
  const image = document.querySelector('.mtg-art-img');
  if (!image) return null;
  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    offsetWidth: image.offsetWidth,
    offsetHeight: image.offsetHeight,
  };
});
console.log('--- ART ---', JSON.stringify(artState));
if (!artState || artState.naturalWidth === 0) throw new Error('Illustration non chargée');
if (artState.offsetWidth === 0 || artState.offsetHeight === 0) {
  throw new Error('Illustration sans dimensions');
}
await page.screenshot({ path: 'tmp/04-art.png', fullPage: true });

// Erreur d'import : le message doit être relié au déclencheur pour être annoncé avec lui.
await page.locator('input[type="file"]').setInputFiles({
  name: 'note.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('not an image'),
});
await page.locator('#art-upload-error').waitFor({ timeout: 5000 });
const uploadError = await page.evaluate(() => {
  const trigger = [...document.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-describedby') === 'art-upload-error',
  );
  return {
    text: document.querySelector('#art-upload-error')?.textContent?.trim() ?? '',
    describedBy: trigger?.getAttribute('aria-describedby') ?? null,
  };
});
console.log('--- UPLOAD ERROR ---', JSON.stringify(uploadError));
if (!uploadError.text.includes('Format')) throw new Error("Message d'erreur d'import absent");
if (uploadError.describedBy !== 'art-upload-error') {
  throw new Error("L'erreur d'import n'est pas reliée au bouton d'upload");
}

// Export 1993 : la classe d'export retire l'ombre portée mais garde les reliefs internes.
await page.getByRole('button', { name: /1993/ }).click();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const card = document.querySelector('.mtg-card');
  window.__classicExport = { sawClass: false, shadow: null };
  const observer = new MutationObserver(() => {
    if (card.classList.contains('is-exporting')) {
      window.__classicExport.sawClass = true;
      window.__classicExport.shadow = getComputedStyle(card).boxShadow;
    }
  });
  observer.observe(card, { attributes: true, attributeFilter: ['class'] });
  window.__classicExportObserver = observer;
});
const classicDownloadPromise = page.waitForEvent('download', { timeout: 30000 });
await page.getByRole('button', { name: /Télécharger le PNG/ }).click();
const classicDownload = await classicDownloadPromise;
await classicDownload.saveAs('tmp/export-classic.png');
const classicProbe = await page.evaluate(() => {
  window.__classicExportObserver?.disconnect();
  return window.__classicExport;
});
console.log('--- CLASSIC EXPORT ---');
console.log(
  JSON.stringify({
    sawClass: classicProbe.sawClass,
    shadow: classicProbe.shadow?.slice(0, 160) ?? null,
  }),
);
if (!classicProbe.sawClass) {
  throw new Error("Classe is-exporting absente pendant l'export 1993");
}
if (!classicProbe.shadow?.includes('inset')) {
  throw new Error("Relief du cadre 1993 perdu à l'export");
}
if (classicProbe.shadow?.includes('32px 80px')) {
  throw new Error("Ombre portée conservée à l'export 1993");
}
const classicPng = readFileSync('tmp/export-classic.png');
if (classicPng.readUInt32BE(16) !== 750 || classicPng.readUInt32BE(20) !== 1050) {
  throw new Error('Export 1993 de mauvaise taille');
}
await page.getByRole('button', { name: /Signature/ }).click();
await page.waitForTimeout(250);

await page.getByRole('button', { name: 'Sombre' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'tmp/05-dark.png', fullPage: true });

const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
await page.getByRole('button', { name: /Télécharger le PNG/ }).click();
const download = await downloadPromise;
await download.saveAs('tmp/export.png');

const png = readFileSync('tmp/export.png');
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
console.log(`--- EXPORT --- ${download.suggestedFilename()} ${width}x${height} (${png.length} bytes)`);
if (width !== 750 || height !== 1050) throw new Error(`Export ${width}x${height}`);

// Vérifie le rendu de l'export : la carte est sombre et l'illustration est bien incrustée.
const exported = await browser.newPage({ viewport: { width: 750, height: 1050 } });
await exported.setContent(`
  <img id="png" src="data:image/png;base64,${png.toString('base64')}" style="display:block;width:750px;height:1050px" />
`);
const pixels = await exported.evaluate(async () => {
  const img = document.querySelector('#png');
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 1050;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const sample = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
  const region = ctx.getImageData(120, 180, 80, 80).data;
  let min = 255;
  let max = 0;
  for (let index = 0; index < region.length; index += 4) {
    const lightness = (region[index] + region[index + 1] + region[index + 2]) / 3;
    min = Math.min(min, lightness);
    max = Math.max(max, lightness);
  }
  return {
    frame: sample(24, 520),
    artCenter: sample(375, 300),
    outsideCard: sample(2, 2),
    artSpread: max - min,
  };
});
console.log('--- PIXELS ---');
console.log(JSON.stringify(pixels));
const frameBrightness = pixels.frame[0] + pixels.frame[1] + pixels.frame[2];
if (frameBrightness > 220) throw new Error('Le cadre sombre ne semble pas exporté');
if (pixels.outsideCard[3] !== 0) throw new Error('Les coins ne sont pas transparents');
// Une zone d'art vide serait unie : l'illustration doit produire des variations.
if (pixels.artSpread < 15) throw new Error("L'illustration est absente de l'export PNG");
await exported.close();

// Planche PDF A4 9-up : format, métadonnées et poids (illustration embarquée).
const pdfDownloadPromise = page.waitForEvent('download', { timeout: 60000 });
await page.getByRole('button', { name: /Planche PDF A4/ }).click();
const pdfDownload = await pdfDownloadPromise;
await pdfDownload.saveAs('tmp/sheet.pdf');

const pdfBytes = readFileSync('tmp/sheet.pdf');
const sheet = await PDFDocument.load(pdfBytes);
const sheetPages = sheet.getPages();
if (sheetPages.length !== 1) throw new Error(`PDF : ${sheetPages.length} pages`);
const { width: sheetWidth, height: sheetHeight } = sheetPages[0].getSize();
const a4Width = (210 * 72) / 25.4;
const a4Height = (297 * 72) / 25.4;
if (Math.abs(sheetWidth - a4Width) > 1 || Math.abs(sheetHeight - a4Height) > 1) {
  throw new Error(`PDF ${sheetWidth}×${sheetHeight} pt au lieu de A4`);
}
if (!sheet.getTitle()?.includes('planche A4')) throw new Error('Titre PDF manquant');
if (pdfBytes.length < 50_000) throw new Error('PDF suspicieusement petit (image absente ?)');
console.log(
  `--- PDF --- ${pdfDownload.suggestedFilename()} ${sheetWidth.toFixed(1)}×${sheetHeight.toFixed(1)} pt (${pdfBytes.length} bytes)`,
);

// Carte à texte long : l'auto-fit doit rester dans la boîte sur chaque template.
await combobox.fill('Ice Cauldron');
await page.getByRole('option').first().waitFor({ timeout: 15000 });
await page.getByRole('option').first().click();
await page.waitForTimeout(500);
for (const [label, pattern] of [
  ['Signature', /Signature/],
  ['1993', /1993/],
  ['2026', /2026/],
]) {
  await page.getByRole('button', { name: pattern }).click();
  await page.waitForTimeout(300);
  const longText = await page.evaluate(() => {
    const oracle = document.querySelector('.mtg-oracle');
    return {
      name: document.querySelector('.mtg-name')?.textContent,
      fontSize: parseFloat(getComputedStyle(oracle).fontSize),
      scrollHeight: oracle.scrollHeight,
      clientHeight: oracle.clientHeight,
    };
  });
  console.log(`--- LONG TEXT ${label} ---`);
  console.log(JSON.stringify(longText));
  if (longText.fontSize < 15) throw new Error(`Texte long illisible (${label})`);
  if (longText.scrollHeight > longText.clientHeight + 1) {
    throw new Error(`Texte long déborde (${label})`);
  }
  assertLayout(await readLayout(), label);
}
await page.getByRole('button', { name: /Signature/ }).click();
await page.waitForTimeout(250);

// Symboles de mana dans le texte oracle + polices réellement chargées.
await page.mouse.move(0, 0);
await combobox.fill('Sol Ring');
await page.getByRole('option').first().waitFor({ timeout: 15000 });
await combobox.press('Enter');
await page.waitForTimeout(500);
await assertSearchFocus('sélection clavier');
const fontsAndSymbols = await page.evaluate(() => ({
  manaFont: document.fonts.check('16px Mana'),
  cinzel: document.fonts.check('16px Cinzel'),
  garamond: document.fonts.check('16px "EB Garamond"'),
  oraclePips: document.querySelectorAll('.mtg-oracle .ms-cost').length,
  tapPips: document.querySelectorAll('.mtg-oracle .ms-tap').length,
  tapWidth: document.querySelector('.mtg-oracle .ms-tap')?.getBoundingClientRect().width ?? 0,
  loyalty: document.querySelector('.mtg-loyalty')?.textContent ?? null,
}));
console.log('--- FONTS / SYMBOLS ---');
console.log(JSON.stringify(fontsAndSymbols));
if (!fontsAndSymbols.manaFont) throw new Error('Police Mana non chargée');
if (fontsAndSymbols.oraclePips < 2) throw new Error('Symboles de mana absents du texte');
if (fontsAndSymbols.tapPips < 1) throw new Error('Symbole {T} absent du texte');
if (fontsAndSymbols.tapWidth <= 4) throw new Error('Symbole {T} sans glyphe');

// Titre long + planeswalker : auto-fit du titre et bouclier de loyauté.
await combobox.fill('Jace, the Mind Sculptor');
await page.getByRole('option').first().waitFor({ timeout: 15000 });
await page.getByRole('option').first().click();
await page.waitForTimeout(500);
const planeswalker = await page.evaluate(() => {
  const name = document.querySelector('.mtg-name');
  const type = document.querySelector('.mtg-type-text');
  return {
    cardName: name?.textContent,
    nameFontSize: parseFloat(getComputedStyle(name).fontSize),
    nameFits: name.scrollWidth <= name.clientWidth + 1,
    typeFontSize: parseFloat(getComputedStyle(type).fontSize),
    typeFits: type.scrollWidth <= type.clientWidth + 1,
    loyalty: document.querySelector('.mtg-loyalty')?.textContent ?? null,
    powerToughness: document.querySelector('.mtg-pt')?.textContent ?? null,
  };
});
console.log('--- PLANESWALKER ---');
console.log(JSON.stringify(planeswalker));
if (!planeswalker.nameFits) throw new Error('Le nom déborde');
if (!planeswalker.typeFits) throw new Error('La ligne de type déborde');
if (planeswalker.loyalty !== '3') throw new Error('Loyauté manquante');
if (planeswalker.powerToughness !== null) throw new Error('P/T affiché sur un planeswalker');

// « Nouvelle carte » est démonté au reset : le focus doit revenir au champ de recherche.
await page.getByRole('button', { name: 'Nouvelle carte' }).click();
await page.waitForTimeout(300);
await assertSearchFocus('réinitialisation');

// États du combobox : replié tant qu'aucune listbox n'existe, déplié avec sa cible.
const collapsedSearch = await page.evaluate(() => {
  const input = document.querySelector('[role="combobox"]');
  return {
    expanded: input?.getAttribute('aria-expanded'),
    controls: input?.getAttribute('aria-controls'),
    listboxes: document.querySelectorAll('[role="listbox"]').length,
  };
});
console.log('--- COMBOBOX COLLAPSED ---', JSON.stringify(collapsedSearch));
if (
  collapsedSearch.expanded !== 'false' ||
  collapsedSearch.controls !== null ||
  collapsedSearch.listboxes !== 0
) {
  throw new Error(`Combobox replié incohérent : ${JSON.stringify(collapsedSearch)}`);
}

await combobox.fill('Sol Ring');
await page.getByRole('option').first().waitFor({ timeout: 15000 });
const expandedSearch = await page.evaluate(() => {
  const input = document.querySelector('[role="combobox"]');
  const controls = input?.getAttribute('aria-controls');
  return {
    expanded: input?.getAttribute('aria-expanded'),
    controls,
    controlsExists: controls ? Boolean(document.getElementById(controls)) : false,
  };
});
console.log('--- COMBOBOX EXPANDED ---', JSON.stringify(expandedSearch));
if (
  expandedSearch.expanded !== 'true' ||
  expandedSearch.controls !== 'card-search-results' ||
  !expandedSearch.controlsExists
) {
  throw new Error(`Combobox déplié incohérent : ${JSON.stringify(expandedSearch)}`);
}

console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n') : 'none');
if (errors.length) throw new Error('Erreurs navigateur détectées');

await browser.close();
console.log('SMOKE OK');
