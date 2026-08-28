/**
 * Source for a blocking inline <script> placed in <head>, before any paint.
 * Reads the persisted theme preference and sets data-theme synchronously,
 * so there's no flash of the wrong theme while React/ThemeProvider boots.
 * Deliberately framework-agnostic (string, not a component) so it can be
 * inlined via Next's <script dangerouslySetInnerHTML> or a plain <script>
 * tag in index.html.
 */
export const NO_FLASH_THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("nexora-theme");if(p==="light"||p==="dark"){document.documentElement.setAttribute("data-theme",p);}}catch(e){}})();`;
