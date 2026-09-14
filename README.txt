DEAD SECTOR — 纯前端中文版

项目结构：
public/
  index.html      主菜单
  app.html        游戏界面
  css/
    main.css      主菜单 / 设置样式
    game.css      游戏 / HUD / 暂停菜单样式
  js/
    home.js       主菜单逻辑
    settings.js   FPS / 鼠标灵敏度 / 音量 + localStorage
    audio.js      前端 Web Audio 音效
    game.js       Three.js 游戏核心逻辑
  assets/
    sounds/       预留音效资源
    textures/     预留贴图资源
    models/       预留模型资源

本地测试：
建议使用 VS Code Live Server 打开 public/index.html。

注意：Three.js 当前通过 CDN 加载，因此测试游戏时需要网络连接。
