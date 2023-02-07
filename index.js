'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const algoliasearch = require('algoliasearch');

var _require = require('./sitemap');

const createSitemapindex = _require.createSitemapindex,
      createSitemap = _require.createSitemap;

var _require2 = require('./saveFiles');

const saveSiteMap = _require2.saveSiteMap;


const CHUNK_SIZE = 50000;

function init({
  algoliaConfig,
  params,
  sitemapLoc,
  outputFolder,
  hitToParams
}) {
  let batch = [];
  const client = algoliasearch(algoliaConfig.appId, algoliaConfig.apiKey);
  const index = client.initIndex(algoliaConfig.indexName);
  const sitemaps = [];

  const handleSitemap = (() => {
    var _ref = _asyncToGenerator(function* (entries) {
      return sitemaps.push({
        loc: `${sitemapLoc}/${yield saveSiteMap({
          sitemap: createSitemap(entries),
          index: sitemaps.length,
          root: outputFolder
        })}`,
        lastmod: new Date().toISOString()
      });
    });

    return function handleSitemap(_x) {
      return _ref.apply(this, arguments);
    };
  })();

  const flush = (() => {
    var _ref2 = _asyncToGenerator(function* () {
      const chunks = [];
      let chunk = [];
      batch.forEach(function (entry) {
        if (chunk.length < CHUNK_SIZE) {
          chunk.push(entry);
        }
        if (chunk.length === CHUNK_SIZE) {
          chunks.push(chunk);
          chunk = [];
        }
      });
      yield Promise.all(chunks.map(handleSitemap));
      batch = chunk;
    });

    return function flush() {
      return _ref2.apply(this, arguments);
    };
  })();

  const aggregator = async (args) => {
    let { hits, cursor } = args;
    let run = true;
    do {
      run = !!cursor;
      if (!hits) {
        return;
      }
      batch = batch.concat(
        hits.reduce((entries, hit) => {
          const entry = hitToParams(hit);
          return entry ? entries.concat(entry) : entries;
        }, [])
      );
      if (batch.length > CHUNK_SIZE) {
        await flush();
      }
      ({ hits, cursor } = await index.browseFrom(cursor));
    } while (run);
    await handleSitemap(batch);
    const sitemapIndex = createSitemapindex(sitemaps);
    await saveSiteMap({
      sitemap: sitemapIndex,
      root: outputFolder,
      filename: 'sitemap-index',
    });
  };

  return index.browse(params).then(aggregator);
}

module.exports = init;
