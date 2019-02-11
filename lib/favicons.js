'use strict';
var loaderUtils = require('loader-utils');
var favicons = require('favicons');
var faviconPersistenceCache = require('./cache');

module.exports = function (content) {
  var self = this;
  self.cacheable && this.cacheable();
  if (!self.emitFile) throw new Error('emitFile is required from module system');
  if (!self.async) throw new Error('async is required');

  var callback = self.async();
  var query = loaderUtils.parseQuery(self.query);
  var pathPrefix = loaderUtils.interpolateName(self, query.outputFilePrefix, {
    context: query.context || this.rootContext || this.options.context,
    content: content,
    regExp: query.regExp
  });
  var fileHash = loaderUtils.interpolateName(self, '[hash]', {
    context: query.context || this.rootContext || this.options.context,
    content: content,
    regExp: query.regExp
  });
  var cacheFile = pathPrefix + '.cache';
  faviconPersistenceCache.loadIconsFromDiskCache(self, query, cacheFile, fileHash, function (err, cachedResult) {
    if (err) return callback(err);
    if (cachedResult) {
      return callback(null, 'module.exports = ' + JSON.stringify(cachedResult));
    }
    // Generate icons
    generateIcons(self, content, pathPrefix, query, function (err, iconResult) {
      if (err) return callback(err);
      faviconPersistenceCache.emitCacheInformationFile(self, query, cacheFile, fileHash, iconResult);
      callback(null, 'module.exports = ' + JSON.stringify(iconResult));
    });
  });
};

function getPublicPath (compilation) {
  var publicPath = compilation.outputOptions.publicPath || '';
  if (publicPath.length && publicPath.substr(-1) !== '/') {
    publicPath += '/';
  }
  return publicPath;
}

function generateIcons (loader, imageFileStream, pathPrefix, query, callback) {
  var publicPath = getPublicPath(loader._compilation);
  favicons(imageFileStream, {
    path: '',
    url: '',
    icons: query.icons,
    background: query.background,
    appName: query.manifest.appName,
    appShortName: query.manifest.appShortName,
    appDescription: query.manifest.appDescription,
    developerName: query.manifest.developerName,
    developerURL: query.manifest.developerURL,
    dir: query.manifest.dir,
    lang: query.manifest.lang,
    theme_color: query.manifest.theme_color,
    appleStatusBarStyle: query.manifest.appleStatusBarStyle,
    display: query.manifest.display,
    orientation: query.manifest.orientation,
    scope: query.manifest.scope,
    start_url: query.manifest.start_url,
    version: query.manifest.version,
    loadManifestWithCredentials: query.manifest.loadManifestWithCredentials
  }, function (err, result) {
    if (err) return callback(err);
    var html = result.html.map(function (entry) {
      return entry.replace(/(href=[""])/g, '$1' + publicPath + pathPrefix);
    });
    var loaderResult = {
      outputFilePrefix: pathPrefix,
      html: html,
      files: []
    };
    result.images.forEach(function (image) {
      loaderResult.files.push(pathPrefix + image.name);
      loader.emitFile(pathPrefix + image.name, image.contents);
    });
    result.files.forEach(function (file) {
      loaderResult.files.push(pathPrefix + file.name);
      loader.emitFile(pathPrefix + file.name, file.contents);
    });
    callback(null, loaderResult);
  });
}

module.exports.raw = true;
