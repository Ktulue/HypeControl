const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const pkg = require('./package.json');

module.exports = {
  entry: {
    content: './src/content/index.ts',
    history: './src/history/history.ts',
    logs: './src/logs/logs.ts',
    popup: './src/popup/popup.ts',
    serviceWorker: './src/background/serviceWorker.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, { loader: 'css-loader', options: { url: false } }],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: 'manifest.json',
          transform(content) {
            // Sync version from package.json to manifest.json
            const manifest = JSON.parse(content.toString());
            manifest.version = pkg.version;
            return JSON.stringify(manifest, null, 2);
          },
        },
        { from: 'src/history/history.html', to: 'history.html' },
        { from: 'src/logs/logs.html', to: 'logs.html' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'assets', to: 'assets', noErrorOnMissing: true },
      ],
    }),
  ],
  devtool: 'cheap-module-source-map',
};
