const person = (x, y, scale, shirt = '#8c1414', skin = '#bf815f') => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <path fill="#26262d" d="m18 104-9 80h25l16-56 14 56h25l-9-80Z"/>
    <path fill="${shirt}" d="M25 36Q48 25 71 38l14 73H15Z"/>
    <path fill="${skin}" d="M23 41 2 91l11 8 26-47m34-10 22 55-13 6-25-51"/>
    <path fill="${skin}" d="M35 3q15-18 31-2 13 11 2 28-13 17-29 4-9-7-4-30Z"/>
    <path fill="#2b2127" d="M34 18Q19-16 53-20q24 2 22 24-14-8-33 1Z"/>
    <path fill="#241d25" d="M9 181h25v13H1v-7zm55 0h25l10 6v7H64Z"/>
    <text x="30" y="68" font-family="Arial,sans-serif" font-size="8" letter-spacing=".8" fill="#fff1e3" data-layout-allow-overlap data-layout-allow-occlusion>PHILRADS</text>
  </g>`;

const box = (x, y, width = 74) => `<g transform="translate(${x} ${y})"><path d="M0 0h${width}v55H0z" fill="#cea072"/>
  <path d="M0 0l13-12h${width}L${width} 0Zm${width} 0 13-12v55l-13 12Z" fill="#9f6e46"/>
  <path d="M${width / 2 - 8} 0h16v55h-16Z" fill="#e8b77d"/><path d="M8 39h14v8H8Z" fill="#f0d8ac"/></g>`;
const shell = (contents) => `<svg viewBox="0 0 900 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${contents}</svg>`;

export function fieldArt(kind) {
  if (kind === 'warehouse') return shell(`
    <path fill="#d5a781" d="M0 0h900v560H0z"/>
    <path fill="#965947" d="M0 0h900v82H0zM0 0l450 103L900 0v12L450 135 0 15z"/>
    <path fill="#edc49b" d="M107 126h202v181H107zm486 0h202v181H593z"/>
    <path fill="#a56e53" d="M122 144h8v152h-8zm86 0h8v152h-8zm480 0h8v152h-8zM93 217h230v8H93zm486 0h230v8H579z"/>
    <path fill="#b48668" d="M0 385h900v175H0z"/><path fill="#aa765f" d="m450 385 450 151v24H0v-24z"/>
    <path stroke="#583b35" stroke-width="12" d="M75 208v285m238-285v285M75 274h238M75 363h238M75 451h238m300-243v285m210-285v285m-210-217h210m-210 89h210m-210 88h210"/>
    ${[93, 184, 630, 720].map((x) => [214, 303, 391].map((y) => box(x, y)).join('')).join('')}
    ${person(382, 289, 1.05)}${box(476, 439, 84)}
    <path fill="#693c35" d="M358 147h184v39H358z"/><text x="450" y="173" text-anchor="middle" fill="#fff0d5" font-family="Arial,sans-serif" font-size="15" letter-spacing="5" data-layout-allow-overlap data-layout-allow-occlusion>FIELD HUB</text>`);
  if (kind === 'flood') return shell(`
    <path fill="#bdafa3" d="M0 0h900v560H0z"/><circle cx="740" cy="105" r="61" fill="#f6d2a0"/>
    <path d="M0 246l160-84 114 35 124-55 184 82 132-51 186 64v323H0Z" fill="#828985"/>
    <path d="M0 351q226-87 449-44t451 16v237H0Z" fill="#527a7b"/>
    <path d="M0 431q246-77 452-22t448 11v140H0Z" fill="#749e96"/>
    <path d="M0 479q226-42 445-13t455-18v112H0Z" fill="#8eb2a2"/>
    <path d="M68 228h159v140H68zm601 24h150v116H669z" fill="#e4c4a1"/>
    <path d="m47 234 105-94 99 94Zm604 23 94-88 91 88Z" fill="#873a3c"/>
    <path d="M117 270h40v65h-40zm615 17h38v50h-38z" fill="#596966"/>
    <path d="M235 480q171-14 340-114l26 13q-70 79-162 181H215Z" fill="#b79475"/>
    ${person(341, 328, .9)}${person(444, 297, .77, '#a23032', '#aa6d50')}
    <path d="M59 400h152m-160 21h98m483 30h170m-110 32h179m-734 36h78" stroke="#d5e0cb" stroke-width="4" opacity=".5" stroke-linecap="round"/>`);
  if (kind === 'training') return shell(`
    <path fill="#dabb9c" d="M0 0h900v560H0z"/><path fill="#b18b72" d="M0 389h900v171H0z"/>
    <path fill="#f8e0b9" d="M87 75h190v245H87z"/><path stroke="#b99376" stroke-width="10" d="M182 75v245M87 200h190"/>
    <path fill="#f1e0c9" d="M336 72h454v225H336z"/><path fill="#fcf0d8" d="M352 88h422v192H352z"/>
    <path fill="#8c1414" d="M400 130h239v15H400z"/><path fill="#baa88e" d="M400 174h323v7H400zm0 28h262v7H400zm0 28h309v7H400z"/>
    ${person(622, 270, 1.09)}${person(171, 329, .88, '#9d2527')}${person(329, 350, .86, '#9d2527', '#a66f54')}
    <path fill="#91543d" d="M90 448h450v24H90z"/><path fill="#503633" d="M116 472h13v75h-13zm386 0h13v75h-13z"/>
    <path fill="#f2d6a8" d="M171 432h85l-14 18h-86Zm155 0h87l-14 18h-87z"/>`);
  return '<img src="assets/distribution.svg" alt="" />';
}

export const grip = `<svg viewBox="0 0 290 540" aria-hidden="true"><defs><linearGradient id="skin" x1="0" x2="1"><stop stop-color="#a6634c"/><stop offset=".6" stop-color="#d39673"/><stop offset="1" stop-color="#ac6d55"/></linearGradient></defs>
  <path d="M175 519c-29-69-85-97-119-155-33-55-38-101-26-150L54 109c7-31 26-47 42-43 15 3 17 22 11 44L89 183l55-33 12-81c3-20 15-41 29-38 16 1 18 20 15 42l-3 42 10-52c5-25 19-38 33-33 13 4 15 16 11 43l-6 61c20-30 40-12 38 5l-9 105c-4 47-29 86-38 129-11 50 14 96 23 124Z" fill="url(#skin)" stroke="#8a5547" stroke-width="3"/>
  <path d="M224 245c-36 35-54 72-51 116m36-131c-26 25-49 52-56 80M71 222c-4 37 4 79 29 108" stroke="#9b5e4c" stroke-width="3" fill="none" opacity=".8"/>
</svg>`;
export const finger = `<svg viewBox="0 0 150 175" aria-hidden="true"><path d="M130 174C106 151 96 137 84 118L18 39C-1 16 11 2 24 5c9 1 17 6 24 14l68 70 34 31v55Z" fill="#cb8b68" stroke="#824839" stroke-width="2.5"/><path d="M19 14c6-5 13 0 18 4l11 12-14 13-12-14c-3-5-5-11-3-15Z" fill="#e9ae8a"/><path d="m70 68 19-13m-10 25 15-12" fill="none" stroke="#a3614d" stroke-width="2" stroke-linecap="round"/></svg>`;
