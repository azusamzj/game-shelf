export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/search/index',
    'pages/detail/index',
    'pages/library/index',
    'pages/record/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '游迹册',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#4B3FE3',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '发现'
      },
      {
        pagePath: 'pages/search/index',
        text: '搜索'
      },
      {
        pagePath: 'pages/library/index',
        text: '我的'
      },
      {
        pagePath: 'pages/profile/index',
        text: '设置'
      }
    ]
  }
})
