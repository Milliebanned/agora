// Which way the dashboard is lit.
//
// The choice lives on <html data-theme>, is remembered per device in
// localStorage, and only applies inside the dashboard. Everything outside it —
// the landing page, login, onboarding — is dark by design and has no light
// counterpart drawn for it, so those routes are pinned dark rather than left
// to inherit a choice made somewhere else.

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'agora-theme'

export function isDashboardPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard')
}

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    // Private mode, or storage blocked. The system preference still decides.
    return null
  }
}

// Dark until somebody says otherwise, rather than whatever the operating
// system prefers. Every other screen in the product is dark and has no light
// version, so following the OS would hand a light-mode phone a dark landing
// page, a dark onboarding, and then a light dashboard at the end of it. Light
// is a choice made here, and it sticks once made.
export const DEFAULT_THEME: Theme = 'dark'

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

// Runs before first paint, inlined in <head>. Without it the browser paints the
// default dark, then React swaps to light a moment later, which is a flash of
// the wrong theme on every single page load.
//
// Kept as a string of plain ES5 so it needs no bundling and cannot throw on an
// old WebView. Anything that goes wrong falls through to dark, which is what
// the stylesheet gives with no attribute at all.
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement;
if(location.pathname.indexOf('/dashboard')!==0){d.setAttribute('data-theme','dark');return}
var s=null;try{s=localStorage.getItem('${THEME_KEY}')}catch(e){}
var t=(s==='light'||s==='dark')?s:'dark';
d.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`
