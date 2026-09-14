(function () {
  'use strict';
  async function api(path, body, method) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),10000);
    try {
      const response = await fetch('/api/' + path, { method: method || (body ? 'POST':'GET'), credentials:'same-origin', signal:controller.signal,
        headers:body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body):undefined });
      let data; try { data = await response.json(); } catch { throw new Error('serverUnavailable'); }
      if (!response.ok) { const error = new Error(data.error || 'networkError'); error.status = response.status; throw error; }
      return data;
    } catch (error) { if (error instanceof TypeError || error.name==='AbortError') throw new Error('networkError'); throw error; }
    finally { clearTimeout(timeout); }
  }
  function connect(roomId, receive, status) {
    let ws, stopped=false, attempt=0, heartbeat, reconnect, lastPong=0;
    const open = () => {
      status('connecting');
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:':'ws:'}//${location.host}/api/rooms/${encodeURIComponent(roomId)}/ws`);
      ws.onopen = () => {
        attempt=0; lastPong=Date.now(); status('online');
        heartbeat=setInterval(() => { if (Date.now()-lastPong>30000) { ws.close(); return; } send({type:'ping',time:Date.now()}); },5000);
        send({type:'ping',time:Date.now()});
      };
      ws.onmessage = e => {
        try { const data=JSON.parse(e.data); if(data.type==='pong') { lastPong=Date.now(); status('online',Date.now()-data.time); } else receive(data); }
        catch { status('networkError'); }
      };
      ws.onclose = e => {
        clearInterval(heartbeat); if(stopped) return;
        if(e.code===4001 || e.code===4003) { stopped=true; status('loginRequired'); return; }
        status('disconnected'); reconnect=setTimeout(open,Math.min(1000*2**attempt++,10000));
      };
      ws.onerror = () => status('disconnected');
    };
    function send(data) { if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data)); }
    open(); return { send, close() { stopped=true; clearTimeout(reconnect); clearInterval(heartbeat); ws?.close(); } };
  }
  window.HordeNetwork = { api, connect };
})();
