
require("babel-register");

const path = require("path");
const webpack = require("webpack");
const SingleModulePlugin = require("single-module-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const { isDevelopment, isFirefoxPanel, getValue } = require("devtools-config");
const NODE_ENV = process.env.NODE_ENV || "development";
const TARGET = process.env.TARGET || "local";

const defaultBabelPlugins = [
  "transform-flow-strip-types",
  "transform-async-to-generator"
];

module.exports = (webpackConfig, envConfig) => {
  webpackConfig.context = path.resolve(__dirname, "src");
  webpackConfig.devtool = "source-map";

  webpackConfig.module = webpackConfig.module || {};
  webpackConfig.module.loaders = webpackConfig.module.loaders || [];
  webpackConfig.module.loaders.push({
    test: /\.json$/,
    loader: "json"
  });
  webpackConfig.module.loaders.push({
    test: /\.js$/,
    exclude: request => {
      let excluded = request.match(
        /(node_modules|bower_components|fs|devtools-)/
      );
      if (webpackConfig.babelExcludes) {
        // If the tool defines an additional exclude regexp for Babel.
        excluded = excluded || request.match(webpackConfig.babelExcludes);
      }
      return excluded && !request.match(/devtools-launchpad(\/|\\)src/)
              && !request.match(/devtools-client-adapters(\/|\\)src/);
    },
    loaders: [
      `babel?${
        defaultBabelPlugins.map(p => `plugins[]=${ p}`)
        }&ignore=src/lib`
    ],
    isJavaScriptLoader: true
  });
  webpackConfig.module.loaders.push({
    test: /\.svg$/,
    exclude: /lkdjlskdjslkdjsdlk/,
    loader: "svg-inline"
  });

  // Add resolveLoader for ./node_modules to fix issues when synlinked.
  webpackConfig.resolveLoader = webpackConfig.resolveLoader || {};
  webpackConfig.resolveLoader.root = webpackConfig.resolveLoader.root || [];
  webpackConfig.resolveLoader.root.push(path.resolve("./node_modules"));

  const ignoreRegexes = [/^fs$/];
  webpackConfig.externals = webpackConfig.externals || [];

  function externalsTest(context, request, callback) {
    // Any matching paths here won't be included in the bundle.
    if (ignoreRegexes.some(r => r.test(request))) {
      return callback(null, "var {}");
    }

    callback();
  }
  webpackConfig.externals.push(externalsTest);

  webpackConfig.plugins = webpackConfig.plugins || [];
  webpackConfig.plugins.push(
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify(NODE_ENV),
        TARGET: JSON.stringify(TARGET)
      },
      "DebuggerConfig": JSON.stringify(envConfig)
    })
  );

  webpackConfig.plugins.push(new SingleModulePlugin());

  if (isDevelopment()) {
    webpackConfig.module.loaders.push({
      test: /\.css$/,
      loader: "style!css!postcss"
    });

    if (getValue("hotReloading")) {
      Object.keys(webpackConfig.entry).forEach(key => {
        webpackConfig.entry[key].push("webpack-hot-middleware/client");
      });

      webpackConfig.plugins = webpackConfig.plugins.concat([
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoErrorsPlugin()
      ]);

      webpackConfig.module.loaders.forEach(spec => {
        if (spec.isJavaScriptLoader) {
          spec.loaders.unshift("react-hot");
        }
      });
    }
  } else {
  // Extract CSS into a single file
    webpackConfig.module.loaders.push({
      test: /\.css$/,
      exclude: request => {
        // If the tool defines an exclude regexp for CSS files.
        return webpackConfig.cssExcludes
          && request.match(webpackConfig.cssExcludes);
      },
      loader: ExtractTextPlugin.extract(
        "style-loader", "css-loader", "postcss-loader"
      )
    });

    webpackConfig.plugins.push(new ExtractTextPlugin("[name].css"));
  }

  webpackConfig.postcss = () => [require("postcss-bidirection")];

  if (isFirefoxPanel()) {
    webpackConfig = require("./webpack.config.devtools")(webpackConfig, envConfig);
  }

  // NOTE: This is only needed to fix a bug with chrome devtools' debugger and
  // destructuring params https://github.com/devtools-html/debugger.html/issues/67
  if (getValue("transformParameters")) {
    webpackConfig.module.loaders.forEach(spec => {
      if (spec.isJavaScriptLoader) {
        const idx = spec.loaders.findIndex(loader => loader.includes("babel"));
        spec.loaders[idx] += "&plugins[]=transform-es2015-parameters";
      }
    });
  }

  return webpackConfig;
};
