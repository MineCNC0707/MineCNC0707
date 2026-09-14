(function () {
  'use strict';
  const texts = {
    zh: {
      name:'尸潮乱斗', play:'开始游戏', settings:'设置', armory:'军火处', market:'黑市', solo:'单人', multiplayer:'多人',
      login:'登录', register:'注册', logout:'退出登录', username:'用户名', password:'密码', displayName:'显示名',
      welcome:'补给点 · 城市边缘', subtitle:'第一人称僵尸生存射击', version:'开发中 · 本地原型',
      system:'系统', close:'关闭设置', fps:'帧率限制', fpsHint:'根据设备能力选择', sensitivity:'鼠标灵敏度', sensitivityHint:'调整视角转动速度',
      volume:'主音量', volumeHint:'音乐与音效音量', reset:'重置', save:'保存', fov:'视野范围', fovHint:'世界相机视野',
      language:'语言', adsMode:'瞄准方式', toggle:'点击切换', hold:'长按', haptics:'震动反馈', on:'开启', off:'关闭',
      controls:'WASD 移动 · 鼠标视角 · 左键射击 · R 换弹 · 空格跳跃 · ESC 菜单',
      loading:'正在加载游戏…', ready:'准备就绪', enterHint:'进入城市，迎战尸潮', enter:'进入游戏', health:'生命值', score:'得分', wave:'波次',
      paused:'游戏已暂停', resume:'继续游戏', exit:'退出到主菜单', pauseHint:'按 ESC 打开 / 关闭菜单', dead:'你已阵亡', signalLost:'信号中断',
      finalScore:'最终得分', restart:'重新开始', reloading:'换弹中', error:'游戏错误', startupError:'无法启动游戏', unknownError:'未知错误',
      headshot:'爆头', pistol:'手枪', ak47:'AK-47', easy:'简单', normal:'普通', hard:'困难', nightmare:'噩梦', dreadmare:'梦魇',
      trial:'离线试玩', trialHint:'试玩不产生账号货币或经验', serverUnavailable:'服务器暂不可用，请稍后重试', retry:'重试', back:'返回',
      tutorial:'新手教学', tutorialRequired:'完成教学后解锁正式战局', level:'玩家等级', currency:'货币', weaponExp:'武器经验',
      owned:'已拥有', locked:'未解锁', equip:'装备', equipped:'已装备', buy:'购买', loginRequired:'请先登录',
      friends:'好友', addFriend:'添加好友', online:'在线', offline:'离线', invite:'邀请', accept:'接受', decline:'拒绝',
      createRoom:'创建房间', room:'房间', readyAction:'准备', waiting:'等待其他玩家', startMatch:'开始战局', leaveRoom:'离开房间',
      connecting:'正在连接…', disconnected:'连接中断，正在重连', ping:'延迟', training:'训练区',
      moveHint:'移动并转动视角', jumpHint:'跳跃一次', shootHint:'用手枪射击训练目标', reloadHint:'完成一次换弹', adsHint:'瞄准后射击',
      hitHint:'击中身体，再击中头部', tutorialDone:'教学完成', boss:'感染巨兽', bossWarning:'重击预警 · 离开红色区域',
      aim:'瞄准', fire:'射击', jump:'跳跃', reload:'换弹', pause:'暂停', switchWeapon:'切枪', rotate:'请横屏游玩',
      loadingEngine:'加载渲染引擎', loadingScene:'构建城市与角色', loadingSession:'恢复会话', loadingReady:'准备完成',
      pointerError:'浏览器暂时无法锁定鼠标，可拖动画面转向', trainingProgress:'教学进度', noFriends:'还没有好友',
      authInvalid:'登录信息无效或暂时无法处理', invalidInput:'请检查输入内容', usernameHint:'3–24 位英文字母、数字或下划线',
      passwordHint:'至少 10 位字符', insufficient:'货币不足', expired:'邀请已过期', cooldown:'邀请冷却中', networkError:'网络请求失败',
      settlement:'战局结算', reward:'获得货币', noReward:'离线试玩，无账号奖励', syncing:'等待服务器确认',
      authNote:'登录后保存成长与装备', displayHint:'2–24 位字符'
    },
    en: {
      name:'Horde Mayhem', play:'Play', settings:'Settings', armory:'Armory', market:'Black Market', solo:'Solo', multiplayer:'Multiplayer',
      login:'Log in', register:'Register', logout:'Log out', username:'Username', password:'Password', displayName:'Display name',
      welcome:'Supply point · City outskirts', subtitle:'First-person zombie survival', version:'In development · Local prototype',
      system:'System', close:'Close settings', fps:'Frame rate limit', fpsHint:'Choose for your device', sensitivity:'Mouse sensitivity', sensitivityHint:'Adjust look speed',
      volume:'Master volume', volumeHint:'Music and sound effects', reset:'Reset', save:'Save', fov:'Field of view', fovHint:'World camera FOV',
      language:'Language', adsMode:'Aim mode', toggle:'Toggle', hold:'Hold', haptics:'Haptic feedback', on:'On', off:'Off',
      controls:'WASD move · Mouse look · Left click fire · R reload · Space jump · ESC menu',
      loading:'Loading game…', ready:'Ready', enterHint:'Enter the city. Survive the horde.', enter:'Enter game', health:'Health', score:'Score', wave:'Wave',
      paused:'Game paused', resume:'Continue', exit:'Return to lobby', pauseHint:'Press ESC to open / close the menu', dead:'You died', signalLost:'Signal lost',
      finalScore:'Final score', restart:'Restart', reloading:'Reloading', error:'Game error', startupError:'Unable to start', unknownError:'Unknown error',
      headshot:'HEADSHOT', pistol:'Pistol', ak47:'AK-47', easy:'Easy', normal:'Normal', hard:'Hard', nightmare:'Nightmare', dreadmare:'Dreadmare',
      trial:'Offline trial', trialHint:'No account currency or EXP in trial mode', serverUnavailable:'Server unavailable. Please try again later.', retry:'Retry', back:'Back',
      tutorial:'Tutorial', tutorialRequired:'Complete training to unlock matches', level:'Player level', currency:'Currency', weaponExp:'Weapon EXP',
      owned:'Owned', locked:'Locked', equip:'Equip', equipped:'Equipped', buy:'Buy', loginRequired:'Please log in first',
      friends:'Friends', addFriend:'Add friend', online:'Online', offline:'Offline', invite:'Invite', accept:'Accept', decline:'Decline',
      createRoom:'Create room', room:'Room', readyAction:'Ready', waiting:'Waiting for players', startMatch:'Start match', leaveRoom:'Leave room',
      connecting:'Connecting…', disconnected:'Disconnected. Reconnecting…', ping:'Ping', training:'Training area',
      moveHint:'Move and look around', jumpHint:'Jump once', shootHint:'Shoot the target with your pistol', reloadHint:'Complete a reload', adsHint:'Aim down sights and fire',
      hitHint:'Hit the body, then the head', tutorialDone:'Training complete', boss:'The Colossus', bossWarning:'SLAM WARNING · Leave the red area',
      aim:'Aim', fire:'Fire', jump:'Jump', reload:'Reload', pause:'Pause', switchWeapon:'Switch', rotate:'Rotate to landscape',
      loadingEngine:'Loading renderer', loadingScene:'Building city and characters', loadingSession:'Restoring session', loadingReady:'Ready',
      pointerError:'Mouse lock unavailable. Drag the scene to look around.', trainingProgress:'Training progress', noFriends:'No friends yet',
      authInvalid:'Invalid credentials or request unavailable', invalidInput:'Please check your input', usernameHint:'3–24 letters, digits or underscores',
      passwordHint:'At least 10 characters', insufficient:'Not enough currency', expired:'Invitation expired', cooldown:'Invitation on cooldown', networkError:'Network request failed',
      settlement:'Match results', reward:'Currency earned', noReward:'Offline trial. No account rewards.', syncing:'Waiting for server confirmation',
      authNote:'Log in to save progress and equipment', displayHint:'2–24 characters'
    }
  };
  let language;
  try { language = localStorage.getItem('horde.language'); } catch {}
  if (!texts[language]) language = navigator.language.startsWith('zh') ? 'zh' : 'en';
  function t(key) { return texts[language][key] ?? texts.en[key] ?? key; }
  function translate(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'; document.title = t('name');
  }
  function setLanguage(next) {
    if (!texts[next]) return;
    language = next; try { localStorage.setItem('horde.language', next); } catch {}
    translate(); window.dispatchEvent(new CustomEvent('horde:language'));
  }
  const editable = target => target instanceof Element && !!target.closest('input,textarea,[contenteditable="true"]');
  document.addEventListener('dragstart', e => { if (!editable(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); });
  document.addEventListener('gesturestart', e => { if (!editable(e.target)) e.preventDefault(); }, { passive:false });
  window.HordeUI = { t, translate, setLanguage, get language() { return language; } };
  document.addEventListener('DOMContentLoaded', () => translate());
})();
