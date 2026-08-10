export function getBrowserInfo() {
  if (typeof navigator === 'undefined') {
    return { isChrome: false, isEdge: false, isOpera: false, isFirefox: false, isSafari: false, isIOS: false };
  }
  const ua = navigator.userAgent;
  const isEdge = /Edg\//.test(ua);
  const isOpera = /OPR|Opera/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isChrome = /Chrome|CriOS/.test(ua) && !isEdge && !isOpera;
  const isSafari = /Safari/.test(ua) && !isChrome && !isEdge && !isOpera && !isFirefox;
  return { isChrome, isEdge, isOpera, isFirefox, isSafari, isIOS };
}

export function isSupportedBrowser() {
  const { isChrome, isEdge, isOpera, isFirefox, isIOS } = getBrowserInfo();
  if (isOpera || isFirefox || isIOS) return false;
  return isChrome || isEdge;
}

export function isIOS() {
  return getBrowserInfo().isIOS;
}
