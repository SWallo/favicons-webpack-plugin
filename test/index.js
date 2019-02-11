/* eslint-env es6 */
import test from 'ava';
import path from 'path';
import fs from 'fs';
import rimraf from 'rimraf';
import FaviconsWebpackPlugin from '..';
import denodeify from 'denodeify';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import dircompare from 'dir-compare';
import packageJson from '../package.json';

const webpack = denodeify(require('webpack'));
const readFile = denodeify(require('fs').readFile);
const writeFile = denodeify(require('fs').writeFile);
const mkdirp = denodeify(require('mkdirp'));

const compareOptions = {compareSize: true};
let outputId = 0;
const LOGO_PATH = path.resolve(__dirname, 'fixtures/logo.png');
const ICON_FOLDER_NAME = 'icons-366a3768de05f9e78c392fa62b8fbb80';

rimraf.sync(path.resolve(__dirname, '../dist'));

function baseWebpackConfig (plugin) {
  return {
    devtool: 'eval',
    entry: path.resolve(__dirname, 'fixtures/entry.js'),
    output: {
      path: path.resolve(__dirname, '../dist', 'test-' + (outputId++))
    },
    plugins: [].concat(plugin)
  };
}

test('should throw error when called without arguments', async t => {
  t.plan(2);
  let plugin;
  try {
    plugin = new FaviconsWebpackPlugin();
  } catch (err) {
    t.is(err.message, 'FaviconsWebpackPlugin options are required');
  }
  t.is(plugin, undefined);
});

test('should take a string as argument', async t => {
  var plugin = new FaviconsWebpackPlugin(LOGO_PATH);
  t.is(plugin.options.logo, LOGO_PATH);
});

test('should take an object with just the logo as argument', async t => {
  var plugin = new FaviconsWebpackPlugin({logo: LOGO_PATH});
  t.is(plugin.options.logo, LOGO_PATH);
});

test('should generate the expected default result', async t => {
  const stats = await webpack(baseWebpackConfig(new FaviconsWebpackPlugin({
    logo: LOGO_PATH
  })));
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, 'fixtures/expected/default');
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should generate a configured JSON file', async t => {
  const stats = await webpack(baseWebpackConfig(new FaviconsWebpackPlugin({
    logo: LOGO_PATH,
    emitStats: true,
    persistentCache: false,
    statsFilename: 'iconstats.json'
  })));
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, 'fixtures/expected/generate-json');
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should work together with the html-webpack-plugin', async t => {
  const stats = await webpack(baseWebpackConfig([
    new HtmlWebpackPlugin(),
    new FaviconsWebpackPlugin({
      logo: LOGO_PATH,
      emitStats: true,
      statsFilename: 'iconstats.json',
      persistentCache: false
    })
  ]));
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, 'fixtures/expected/generate-html');
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should not recompile if there is a cache file', async t => {
  const options = baseWebpackConfig([
    new HtmlWebpackPlugin(),
    new FaviconsWebpackPlugin({
      logo: LOGO_PATH,
      emitStats: false,
      persistentCache: true
    })
  ]);

  // Bring cache file in place
  const cacheFile = 'icons-366a3768de05f9e78c392fa62b8fbb80/.cache';
  const cacheFileExpected = path.resolve(__dirname, 'fixtures/expected/from-cache/', cacheFile);
  const cacheFileDist = path.resolve(__dirname, options.output.path, cacheFile);
  await mkdirp(path.dirname(cacheFileDist));
  const cache = JSON.parse(await readFile(cacheFileExpected));
  cache.version = packageJson.version;
  await writeFile(cacheFileDist, JSON.stringify(cache));

  const stats = await webpack(options);
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, 'fixtures/expected/from-cache');
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should generate the expected manifest.json file with the correct data', async t => {
  const stats = await webpack(baseWebpackConfig(new FaviconsWebpackPlugin({
    logo: LOGO_PATH,
    inject: false,
    manifest: {
      appName: 'Favicon PWA App',
      appShortName: 'Favicon PWA',
      appDescription: 'This is the app description',
      developerName: 'this is the developer name',
      developerURL: 'https://github.com',
      dir: 'auto',
      lang: 'de-DE',
      background: '#000',
      theme_color: '#aaa',
      appleStatusBarStyle: 'black-translucent',
      display: 'standalone',
      orientation: 'landscape',
      scope: '/app',
      start_url: '/app/index',
      version: '1.5'
    }
  })));

  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, 'fixtures/expected/generate-manifest');
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);

  const generatedManifest = JSON.parse(fs.readFileSync(`${outputPath}/${ICON_FOLDER_NAME}/manifest.json`));
  const expectedManifest = JSON.parse(fs.readFileSync(`${expected}/${ICON_FOLDER_NAME}/manifest.json`));

  t.is(expectedManifest['appName'], generatedManifest['appName'], 'Wrong appName');
  t.is(expectedManifest['appShortName'], generatedManifest['appShortName'], 'Wrong appShortName');
  t.is(expectedManifest['appDescription'], generatedManifest['appDescription'], 'Wrong appDescription');
  t.is(expectedManifest['developerName'], generatedManifest['developerName'], 'Wrong developerName');
  t.is(expectedManifest['developerURL'], generatedManifest['developerURL'], 'Wrong developerURL');
  t.is(expectedManifest['dir'], generatedManifest['dir'], 'Wrong dir');
  t.is(expectedManifest['lang'], generatedManifest['lang'], 'Wrong lang');
  t.is(expectedManifest['background'], generatedManifest['background'], 'Wrong background');
  t.is(expectedManifest['theme_color'], generatedManifest['theme_color'], 'Wrong theme_color');
  t.is(expectedManifest['appleStatusBarStyle'], generatedManifest['appleStatusBarStyle'], 'Wrong appleStatusBarStyle');
  t.is(expectedManifest['display'], generatedManifest['display'], 'Wrong display');
  t.is(expectedManifest['orientation'], generatedManifest['orientation'], 'Wrong orientation');
  t.is(expectedManifest['scope'], generatedManifest['scope'], 'Wrong scope');
  t.is(expectedManifest['start_url'], generatedManifest['start_url'], 'Wrong start_url');
  t.is(expectedManifest['version'], generatedManifest['version'], 'Wrong version');
  t.is(expectedManifest['icons'].length, generatedManifest['icons'].length, 'Wrong amount of icons in manifest');

  for (let i = 0; i < expectedManifest['icons'].length; i++) {
    const expectedIcon = expectedManifest['icons'][i];
    const generatedIcon = generatedManifest['icons'][i];

    t.is(expectedIcon['src'], generatedIcon['src']);
    t.is(expectedIcon['size'], generatedIcon['size']);
    t.is(expectedIcon['type'], generatedIcon['type']);
  }
});

test('should generate the expected manifest.json file with the correct data and inject into html', async t => {
  const stats = await webpack(baseWebpackConfig([
    new HtmlWebpackPlugin(),
    new FaviconsWebpackPlugin({
      logo: LOGO_PATH,
      inject: true,
      emitStats: false,
      persistentCache: false,
      manifest: {
        appName: 'Favicon PWA App',
        appShortName: 'Favicon PWA',
        appDescription: 'This is the app description',
        developerName: 'this is the developer name',
        developerURL: 'https://github.com',
        dir: 'auto',
        lang: 'de-DE',
        background: '#000',
        theme_color: '#aaa',
        appleStatusBarStyle: 'black-translucent',
        display: 'standalone',
        orientation: 'landscape',
        scope: '/app',
        start_url: '/app/index',
        version: '1.5'
      }
    })])
  );

  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, 'fixtures/expected/generate-manifest-html');
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);

  const generatedHtml = fs.readFileSync(`${outputPath}/index.html`);

  t.is(generatedHtml.includes('<link rel="manifest" href="icons-366a3768de05f9e78c392fa62b8fbb80/manifest.json">'), true);
});
