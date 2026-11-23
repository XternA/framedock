// Safe-area relay: serves a dev app from its own port, rewrites env(safe-area-inset-*) to FrameDock's
// simulated insets and injects the FrameDock handshake, so apps need no FrameDock-specific code.
export const RELAY_FIRST_PORT = Number(process.env.FRAMEDOCK_RELAY_FIRST_PORT || 9640)
export const RELAY_PORT_COUNT = Number(process.env.FRAMEDOCK_RELAY_PORTS || 20)

const sides = ['top', 'right', 'bottom', 'left']
const ports = new Map<string, number>()
const servers = new Map<number, ReturnType<typeof Bun.serve>>()

const clientScript = `(function(){if(window.parent===window)return;var S=['top','right','bottom','left'],o=null,last=null,lastScrolled=null;
var colorScheme=matchMedia('(prefers-color-scheme: dark)');
function dark(){
var theme=document.documentElement.getAttribute('data-theme');
if(theme==='dark'||theme==='light')return theme==='dark';
if(theme==='auto')return colorScheme.matches;
var c=getComputedStyle(document.body||document.documentElement).backgroundColor;
if(!c||c==='rgba(0, 0, 0, 0)')c=getComputedStyle(document.documentElement).backgroundColor;
var m=c&&c.match(/[\\d.]+/g);if(!m||(m.length>3&&+m[3]===0))return false;return(0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255<0.5}
function ready(){if(!o)return;last=dark();lastScrolled=scrollY>0;parent.postMessage({type:'framedock:viewport-ready',relay:true,dark:last,scrolled:lastScrolled,canvasColor:getComputedStyle(document.documentElement).backgroundColor},o)}
addEventListener('message',function(e){var d=e.data;if(e.source!==parent||!d||d.type!=='framedock:viewport'||!d.insets)return;
try{if(new URL(e.origin).hostname!==location.hostname)return}catch(x){return}
o=e.origin;touchEnabled=d.touch===true;S.forEach(function(s){var v=+d.insets[s];document.documentElement.style.setProperty('--fd-safe-'+s,(v>=0&&v<=128?v:0)+'px')});ready()},true);
var touchEnabled=false, drag=null, suppressClick=false;
function emitTouch(type, event) {
  var point=new Touch({identifier:drag.id,target:drag.target,clientX:event.clientX,clientY:event.clientY,
    screenX:event.screenX,screenY:event.screenY,pageX:event.pageX,pageY:event.pageY});
  var touches=type==='touchend'||type==='touchcancel'?[]:[point];
  return drag.target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
    touches:touches,targetTouches:touches,changedTouches:[point]}));
}
function dragScrollTarget(target, axis) {
  for(var node=target;node&&node!==document.body;node=node.parentElement){
    var css=getComputedStyle(node), overflow=axis==='x'?css.overflowX:css.overflowY;
    if(!/^(auto|scroll|overlay)$/.test(overflow))continue;
    if(axis==='x'?node.scrollWidth>node.clientWidth:node.scrollHeight>node.clientHeight)return node;
  }
  return axis==='y'?document.scrollingElement:null;
}
addEventListener('pointerdown',function(e){
  suppressClick=false;
  if(!touchEnabled||e.pointerType!=='mouse'||e.button!==0||!(e.target instanceof Element))return;
  if(e.target.closest('input,textarea,select,[contenteditable]'))return;
  drag={id:e.pointerId,target:e.target,start:e,x:e.clientX,y:e.clientY,axis:null,scroller:null};
},true);
addEventListener('pointermove',function(e){
  if(!drag||e.pointerId!==drag.id||!(e.buttons&1))return;
  if(!drag.axis){
    var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.hypot(dx,dy)<6)return;
    drag.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
    drag.scroller=dragScrollTarget(drag.target,drag.axis);
    drag.target.setPointerCapture(e.pointerId);
    var selection=getSelection();
    if(selection)selection.removeAllRanges();
    emitTouch('touchstart',drag.start);
  }
  e.preventDefault();
  if(emitTouch('touchmove',e)&&drag.scroller){
    var horizontal=drag.axis==='x';
    var property=horizontal?'scrollLeft':'scrollTop';
    var distance=horizontal?drag.x-e.clientX:drag.y-e.clientY;
    var before=drag.scroller[property];
    drag.scroller[property]+=distance;
    stretchEdge(drag, drag.scroller[property]-before-distance);
  }
  drag.x=e.clientX;drag.y=e.clientY;
},true);
function bounceTransform(axis, offset){
  return axis==='x'?'translateX('+offset+'px)':'translateY('+offset+'px)';
}
function stretchEdge(gesture, unconsumed){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  gesture.edge=Math.abs(unconsumed)<0.5?0:(gesture.edge||0)+unconsumed;
  var offset=Math.sign(gesture.edge)*Math.min(32,Math.sqrt(Math.abs(gesture.edge))*2.2);
  if(!offset&&!gesture.stretch)return;
  var surface=gesture.scroller===document.scrollingElement?document.body:gesture.scroller;
  if(!surface)return;
  var frame={transform:bounceTransform(gesture.axis,offset),composite:'add'};
  if(gesture.stretch)gesture.stretch.effect.setKeyframes([frame,frame]);
  else {
    gesture.stretch=surface.animate([frame,frame],{duration:1,fill:'both'});
    gesture.stretch.pause();
    gesture.stretch.currentTime=0;
  }
  gesture.offset=offset;
}
function finishDrag(e){
  if(!drag||e.pointerId!==drag.id)return;
  if(drag.axis){
    emitTouch(e.type==='pointerup'?'touchend':'touchcancel',e);
    suppressClick=e.type==='pointerup';
    if(drag.stretch){
      var surface=drag.stretch.effect.target;
      drag.stretch.cancel();
      if(drag.offset)surface.animate([
        {transform:bounceTransform(drag.axis,drag.offset),composite:'add'},
        {transform:bounceTransform(drag.axis,0),composite:'add'}
      ],{duration:240,easing:'cubic-bezier(.2,.75,.3,1)'});
    }
  }
  drag=null;
}
addEventListener('pointerup',finishDrag,true);
addEventListener('pointercancel',finishDrag,true);
addEventListener('click',function(e){
  if(!suppressClick||e.detail===0)return;
  suppressClick=false;e.preventDefault();e.stopImmediatePropagation();
},true);
addEventListener('scroll',function(){if(o&&(scrollY>0)!==lastScrolled)ready()},{passive:true});function updateTheme(){
  if(!o||dark()===last)return;
  // Finish theme color transitions before the new palette is painted.
  getComputedStyle(document.documentElement).color;
  for(var animation of document.getAnimations()){
    if(animation instanceof CSSTransition&&/^(color|background-color|border-.*-color|fill|stroke)$/.test(animation.transitionProperty)){
      animation.finish();
    }
  }
  ready();
}
var observer=new MutationObserver(updateTheme);
var observedTheme={attributes:true,attributeFilter:['data-theme','class','style']};
observer.observe(document.documentElement,observedTheme);
addEventListener('DOMContentLoaded',function(){if(document.body)observer.observe(document.body,observedTheme);updateTheme()},{once:true});
colorScheme.addEventListener('change',updateTheme);
setInterval(updateTheme,800)})();`

const injection = `<style>:root{${sides.map((s) => `--fd-safe-${s}:0px`).join(';')}}</style><script>${clientScript}</script>`

export function rewriteSafeArea(text: string): string {
  return text
    .replace(/env\(\s*safe-area-inset-(top|right|bottom|left)\s*\)/g, 'var(--fd-safe-$1,0px)')
    .replace(/env\(\s*safe-area-inset-(top|right|bottom|left)\s*,/g, 'var(--fd-safe-$1,')
}

function injectHtml(html: string): string {
  const rewritten = rewriteSafeArea(html)
  const head = rewritten.match(/<head[^>]*>/i)
  return head ? rewritten.replace(head[0], head[0] + injection) : injection + rewritten
}

interface SocketData {
  upstream: string
  protocols: string[]
  queue: (string | Buffer | ArrayBuffer)[]
  target?: WebSocket
}

function startRelay(origin: string, port: number) {
  const target = new URL(origin)
  const server = Bun.serve<SocketData>({
    hostname: '0.0.0.0',
    idleTimeout: 0,
    port,
    websocket: {
      // Hot-reload and other dev websockets are passed straight through to the real dev server.
      open(ws) {
        const upstream = new WebSocket(ws.data.upstream, { protocols: ws.data.protocols, headers: { origin: target.origin } } as never) as WebSocket
        upstream.binaryType = 'arraybuffer'
        ws.data.target = upstream
        upstream.onopen = () => { for (const queued of ws.data.queue) upstream.send(queued as never); ws.data.queue = [] }
        upstream.onmessage = (event) => { try { ws.send(event.data as never) } catch { /* client gone */ } }
        upstream.onclose = () => { try { ws.close() } catch { /* already closed */ } }
        upstream.onerror = () => { try { ws.close() } catch { /* already closed */ } }
      },
      message(ws, message) {
        const upstream = ws.data.target
        if (upstream && upstream.readyState === WebSocket.OPEN) upstream.send(message as never)
        else ws.data.queue.push(message)
      },
      close(ws) { try { ws.data.target?.close() } catch { /* already closed */ } },
    },
    async fetch(request, serverRef) {
      const url = new URL(request.url)
      if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const requested = (request.headers.get('sec-websocket-protocol') || '').split(',').map((item) => item.trim()).filter(Boolean)
        const wsUrl = new URL(target.origin)
        wsUrl.pathname = url.pathname
        wsUrl.search = url.search
        wsUrl.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:'
        const upgraded = serverRef.upgrade(request, {
          data: { upstream: wsUrl.href, protocols: requested, queue: [] },
          headers: requested[0] ? { 'Sec-WebSocket-Protocol': requested[0] } : undefined,
        })
        return upgraded ? undefined : new Response('Upgrade failed', { status: 400 })
      }
      const upstream = new URL(target.origin)
      upstream.pathname = url.pathname
      upstream.search = url.search
      const headers = new Headers(request.headers)
      headers.delete('host')
      headers.set('accept-encoding', 'identity')
      if (headers.has('origin')) headers.set('origin', target.origin)
      if (headers.has('referer')) headers.set('referer', target.origin + '/')
      let response: Response
      try {
        response = await fetch(upstream, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
          redirect: 'manual',
        })
      } catch (error) {
        return new Response('FrameDock relay could not reach ' + target.origin + ': ' + String(error), { status: 502 })
      }
      const out = new Headers(response.headers)
      for (const name of ['content-length', 'content-encoding']) out.delete(name)
      const location = out.get('location')
      if (location) {
        try {
          const next = new URL(location, upstream)
          if (next.origin === target.origin) out.set('location', next.pathname + next.search + next.hash)
        } catch { /* leave as is */ }
      }
      const type = (out.get('content-type') || '').toLowerCase()
      if (!response.body || request.method === 'HEAD' || response.status === 304 || response.status === 204) {
        return new Response(response.body, { status: response.status, headers: out })
      }
      if (type.includes('text/html')) return new Response(injectHtml(await response.text()), { status: response.status, headers: out })
      if (type.includes('text/css') || type.includes('javascript')) {
        return new Response(rewriteSafeArea(await response.text()), { status: response.status, headers: out })
      }
      return new Response(response.body, { status: response.status, headers: out })
    },
  })
  servers.set(port, server)
}

/** One relay port per target origin, started on first request. */
export function relayPortFor(origin: string): number | null {
  const known = ports.get(origin)
  if (known) return known
  for (let port = RELAY_FIRST_PORT; port < RELAY_FIRST_PORT + RELAY_PORT_COUNT; port++) {
    if (servers.has(port)) continue
    try {
      startRelay(origin, port)
    } catch {
      continue
    }
    ports.set(origin, port)
    return port
  }
  return null
}

/** What the page itself declares for an installed iOS web app: translucent status bar or the default solid one. */
export async function readStatusBar(pageUrl: string): Promise<{ translucent: boolean; declared: boolean; color: string | null } | null> {
  let html = ''
  try {
    const response = await fetch(pageUrl, { signal: AbortSignal.timeout(4000) })
    // A page behind a login redirect cannot be read, so its declaration is unknown.
    if (!response.ok || response.redirected) return null
    html = await response.text()
  } catch { return null }
  const content = (name: string): string | null => {
    for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
      const text = tag[0]
      const lower = text.toLowerCase()
      if (!lower.includes('name="' + name + '"') && !lower.includes("name='" + name + "'")) continue
      if (lower.includes('media=')) continue
      const value = /content=["']([^"']*)["']/i.exec(text)
      if (value) return value[1]
    }
    return null
  }
  const style = content('apple-mobile-web-app-status-bar-style')
  return { translucent: style === 'black-translucent', declared: style !== null, color: content('theme-color') }
}
