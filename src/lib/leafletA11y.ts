import L from 'leaflet';

/**
 * Leaflet makes a keyboard marker a button but only names it through `title` (which also shows a
 * browser tooltip, doubling the map's own). Our pins are div icons, where `alt` does nothing, so a
 * screen reader heard "button" for every pin. This gives each div-icon marker its `alt` as an
 * aria-label, every time Leaflet builds the icon (it rebuilds it when the pin is selected).
 * Leaflet 1.9: `_initIcon` is internal, so this is checked on each upgrade.
 */
type WithInit = { _initIcon: (this: L.Marker) => void; __named?: boolean };
const proto = L.Marker.prototype as unknown as WithInit;
if (!proto.__named) {
  const initIcon = proto._initIcon;
  proto._initIcon = function named(this: L.Marker) {
    initIcon.call(this);
    const el = this.getElement();
    const alt = this.options.alt;
    if (el && alt && el.tagName !== 'IMG') el.setAttribute('aria-label', alt);
  };
  proto.__named = true;
}
