module.exports = {
  lintOnSave: false,
  productionSourceMap: false,
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  configureWebpack: {
    devtool: 'source-map'
  },
  pluginOptions: {
    electronBuilder: {
      preload: 'electron/preload.js',
      mainProcessFile: 'electron/main.js',
      mainProcessWatch: ['electron']
    }
  }
}