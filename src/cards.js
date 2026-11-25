/* ============================================================================
 * One Wallet · Tactile Philippine Bank & Digital Wallet Card Vault Renderer
 * Preserves "The Achromatic Passbook & Tactile Card Vault" design system while
 * supporting cardless passbook accounts cleanly without fake card credentials.
 * ============================================================================ */
(function (global) {
  'use strict';

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanDigits = s => String(s ?? '').replace(/\D/g, '').slice(0, 19);

  let cardUidSeq = 0;

  const CARD_STYLES = [
    { id: 'bdo-gold', name: 'BDO Gold Mastercard', group: 'Credit & Bank Cards', bank: 'BDO', tier: 'GOLD', net: 'mc', netLabel: 'Mastercard', bg: '#6E541F', c1: '#A88638', c2: '#755920', c3: '#4A3610', accent: '#E6C674', light: false, motif: 'bdo' },
    { id: 'bdo-plat', name: 'BDO Platinum Mastercard', group: 'Credit & Bank Cards', bank: 'BDO', tier: 'PLATINUM', net: 'mc', netLabel: 'Mastercard', bg: '#222E3F', c1: '#56677D', c2: '#2B394C', c3: '#151E2B', accent: '#94A3B8', light: false, motif: 'bdo' },
    { id: 'bpi-gold', name: 'BPI Gold Rewards', group: 'Credit & Bank Cards', bank: 'BPI', tier: 'GOLD REWARDS', net: 'mc', netLabel: 'Mastercard', bg: '#6B511D', c1: '#A68336', c2: '#73571E', c3: '#47340E', accent: '#E5C370', light: false, motif: 'bpi-crest' },
    { id: 'bpi-plat', name: 'BPI Platinum Rewards', group: 'Credit & Bank Cards', bank: 'BPI', tier: 'PLATINUM REWARDS', net: 'mc', netLabel: 'Mastercard', bg: '#273547', c1: '#5E7087', c2: '#334357', c3: '#1B2533', accent: '#CBD5E1', light: false, motif: 'bpi-rings' },
    { id: 'ew-gold', name: 'EastWest Gold JCB', group: 'Credit & Bank Cards', bank: 'eastwest', tier: 'GOLD', net: 'jcb', netLabel: 'JCB', bg: '#6D5420', c1: '#B08D3E', c2: '#7A5E24', c3: '#4D3911', accent: '#EAD084', light: false, motif: 'ew-ribbon' },
    { id: 'ew-plat', name: 'EastWest Platinum JCB', group: 'Credit & Bank Cards', bank: 'eastwest', tier: 'PLATINUM', net: 'jcb', netLabel: 'JCB', bg: '#282F3C', c1: '#5D6675', c2: '#343C4A', c3: '#1A1F28', accent: '#94A3B8', light: false, motif: 'ew-ribbon' },
    { id: 'mb-gold', name: 'Metrobank Gold Mastercard', group: 'Credit & Bank Cards', bank: 'Metrobank', tier: 'GOLD', net: 'mc', netLabel: 'Mastercard', bg: '#644C1C', c1: '#A38033', c2: '#6E531C', c3: '#3E2D0C', accent: '#E8C674', light: false, motif: 'mb-dots' },
    { id: 'mb-plat', name: 'Metrobank Platinum Mastercard', group: 'Credit & Bank Cards', bank: 'Metrobank', tier: 'PLATINUM', net: 'mc', netLabel: 'Mastercard', bg: '#212F42', c1: '#556B82', c2: '#2A3A4E', c3: '#141E2B', accent: '#94A3B8', light: false, motif: 'mb-dots' },
    { id: 'rcbc-gold', name: 'RCBC Hexagon Club', group: 'Credit & Bank Cards', bank: 'RCBC', tier: 'HEXAGON CLUB', net: 'mc', netLabel: 'Mastercard', bg: '#634D1F', c1: '#9E7E36', c2: '#6B531F', c3: '#3D2E0E', accent: '#E2C170', light: false, motif: 'rcbc-hex' },
    { id: 'rcbc-plat', name: 'RCBC Visa Platinum', group: 'Credit & Bank Cards', bank: 'RCBC', tier: 'VISA PLATINUM', net: 'visa-plat', netLabel: 'Visa Platinum', bg: '#080F1E', c1: '#0D1B36', c2: '#081021', c3: '#040710', accent: '#38BDF8', light: false, motif: 'rcbc-earth' },
    { id: 'ub-pearl', name: 'UnionBank Platinum', group: 'Credit & Bank Cards', bank: 'UnionBank', tier: 'PLATINUM', net: 'mc', netLabel: 'Mastercard', bg: '#E4ECF5', c1: '#F1F5FA', c2: '#DAE8F5', c3: '#E8E2F0', accent: '#94A3B8', light: true, motif: 'ub-pearl' },
    { id: 'maya-black', name: 'Maya Black Virtual Visa', group: 'Digital Banks & E-Wallets', bank: 'maya', tier: 'BLACK VIRTUAL', net: 'visa', netLabel: 'Visa', bg: '#0A0E17', c1: '#1A2232', c2: '#0D121C', c3: '#06080D', accent: '#475569', light: false, motif: 'maya-spheres' },
    { id: 'gotyme', name: 'GoTyme Visa Debit', group: 'Digital Banks & E-Wallets', bank: 'GoTyme', tier: 'VISA DEBIT', net: 'visa', netLabel: 'Visa Debit', bg: '#131D2E', c1: '#1E2D45', c2: '#131D2E', c3: '#0B111C', accent: '#06B6D4', light: false, motif: 'gotyme-wave' },
    { id: 'cimb', name: 'CIMB Virtual Debit', group: 'Digital Banks & E-Wallets', bank: 'CIMB', tier: 'VIRTUAL DEBIT', net: 'mc', netLabel: 'Mastercard', bg: '#6E1423', c1: '#A81C32', c2: '#781526', c3: '#4A0B16', accent: '#E89818', light: false, motif: 'cimb-facets' },
    { id: 'gcash', name: 'GCash E-Wallet & Card', group: 'Digital Banks & E-Wallets', bank: 'GCash', tier: 'MASTERCARD', net: 'mc', netLabel: 'Mastercard', bg: '#0B2046', c1: '#153675', c2: '#0D2452', c3: '#071533', accent: '#3698D4', light: false, motif: 'gcash-wave' },
    { id: 'cash', name: 'Cash Passbook', group: 'Digital Banks & E-Wallets', bank: 'Cash', tier: 'PASSBOOK GOLD', net: 'cash', netLabel: 'Passbook', bg: '#634C1D', c1: '#9C7B32', c2: '#6B521D', c3: '#3E2E0D', accent: '#E5C370', light: false, motif: 'bdo' }
  ];

  const getCardStyle = id => CARD_STYLES.find(s => s.id === id) || CARD_STYLES[0];

  const brandLogo = (cls = 'h-7 w-auto', h = 28, dark = false) =>
    `<img src="./assets/${dark ? 'logo-dark' : 'logo'}.png?v=20261118c" width="${Math.round(h * 161 / 110)}" height="${h}" alt="" class="${cls} object-contain shrink-0" aria-hidden="true">`;

  function formatCardNumberDisplay(w, revealed) {
    const digits = cleanDigits(w?.num || '');
    const l4 = String(w?.last4 || (digits.length >= 4 ? digits.slice(-4) : '')).replace(/\D/g, '').slice(-4);
    if (revealed && digits.length >= 12) {
      return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    }
    if (l4) {
      return `•••• •••• •••• ${l4}`;
    }
    return w?.style === 'cash' ? 'CASH PASSBOOK' : 'PASSBOOK ACCOUNT';
  }

  const emvChipSvg = (silver = false, mini = false) => {
    const uid = ++cardUidSeq;
    const w = mini ? 30 : 42, h = mini ? 22 : 31;
    const cTop = silver ? '#F1F5F9' : '#F3DCA2';
    const cMid = silver ? '#CBD5E1' : '#D4AF5A';
    const cBot = silver ? '#94A3B8' : '#A67F2E';
    const line = silver ? '#64748B' : '#785818';
    return `<svg width="${w}" height="${h}" viewBox="0 0 42 31" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="chip-${uid}" x1="0" y1="0" x2="42" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${cTop}"/>
          <stop offset="50%" stop-color="${cMid}"/>
          <stop offset="100%" stop-color="${cBot}"/>
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="40.5" height="29.5" rx="5.5" fill="url(#chip-${uid})" stroke="${line}" stroke-width="1"/>
      <rect x="13.5" y="6.5" width="15" height="18" rx="3.5" fill="none" stroke="${line}" stroke-width="0.95"/>
      <path d="M1 10.5h12.5M28.5 10.5H41M1 20.5h12.5M28.5 20.5H41M21 1v5.5M21 24.5V30" stroke="${line}" stroke-width="0.95"/>
    </svg>`;
  };

  const nfcSvg = (light = false, mini = false) => {
    const sz = mini ? 14 : 18;
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${light ? '#334155' : '#E2E8F0'}" stroke-width="1.9" stroke-linecap="round" aria-hidden="true">
      <path d="M8.5 14.5a4 4 0 0 0 0-5M11.8 17.2a7.8 7.8 0 0 0 0-10.4M15.2 19.8a11.5 11.5 0 0 0 0-15.6"/>
    </svg>`;
  };

  const netBadgeSvg = (net, light = false, mini = false) => {
    const sc = mini ? 'scale(0.82) origin-right' : '';
    if (net === 'mc') {
      return `<svg width="44" height="26" viewBox="0 0 44 26" fill="none" class="${sc}" aria-hidden="true">
        <circle cx="16.5" cy="13" r="10.5" fill="#EB001B"/>
        <circle cx="27.5" cy="13" r="10.5" fill="#F79E1B" fill-opacity="0.92"/>
        <path d="M22 4.3a10.5 10.5 0 0 0 0 17.4 10.5 10.5 0 0 0 0-17.4Z" fill="#FF5F00"/>
      </svg>`;
    }
    if (net === 'jcb') {
      return `<svg width="42" height="28" viewBox="0 0 42 28" fill="none" class="${sc}" aria-hidden="true">
        <rect x="1.5" y="1.5" width="39" height="25" rx="4" fill="#FFFFFF" fill-opacity="0.95"/>
        <path d="M5 6.5a3.5 3.5 0 0 1 3.5-3.5H14v18.5a3.5 3.5 0 0 1-3.5 3.5H5V6.5Z" fill="#0066B2"/>
        <path d="M16.5 6.5A3.5 3.5 0 0 1 20 3h5.5v18.5A3.5 3.5 0 0 1 22 25h-5.5V6.5Z" fill="#C82347"/>
        <path d="M28 6.5A3.5 3.5 0 0 1 31.5 3H37v18.5a3.5 3.5 0 0 1-3.5 3.5H28V6.5Z" fill="#15803D"/>
        <path d="M7.5 13.5h4M18.5 13.5h4M30 13.5h4" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    }
    if (net === 'visa' || net === 'visa-plat') {
      const col = light ? '#0F172A' : '#FFFFFF';
      return `<svg width="48" height="24" viewBox="0 0 48 24" fill="none" class="${sc}" aria-hidden="true">
        <path d="M5 5.5h3.2l2.1 10.2L13.8 5.5H17l-4.8 13H9L5 5.5Zm14.4 0h3.1l-1.9 13h-3.1l1.9-13Zm11.2 3.2c-1-.5-2.6-.6-2.6.8 0 1.7 4.4 1.7 4.4 5.1 0 2.9-2.6 4.2-5.4 4.2-1.6 0-3-.4-3.8-.9l.7-2.6c.9.5 2.1.9 3.3.9 1.1 0 2-.4 2-1.2 0-1.8-4.4-1.7-4.4-5.1 0-2.6 2.2-4.1 5.1-4.1 1.4 0 2.6.3 3.4.7l-.7 2.2Zm4.2 9.8 4.8-13h3.3l1.9 13h-3l-.4-2.8h-4l-1 2.8h-1.6Zm4.9-5.2h2.7l-.6-4.5-2.1 4.5Z" fill="${col}"/>
        ${net === 'visa-plat' ? `<text x="46" y="23" text-anchor="end" fill="${col}" fill-opacity="0.78" font-size="5.5" font-weight="600" letter-spacing="1.2">PLATINUM</text>` : ''}
      </svg>`;
    }
    return brandLogo(mini ? 'h-4 w-auto' : 'h-5 w-auto', mini ? 16 : 20, !light);
  };

  const cardArtSvg = st => {
    const uid = ++cardUidSeq;
    const ac = st.accent;
    let art = '';

    if (st.motif === 'bdo') {
      art = `
        <rect x="135" y="-12" width="108" height="210" rx="18" fill="${ac}" fill-opacity="0.18"/>
        <rect x="208" y="34" width="128" height="190" rx="20" fill="${ac}" fill-opacity="0.22"/>
        <rect x="82" y="138" width="150" height="115" rx="16" fill="#000000" fill-opacity="0.16"/>
        <rect x="255" y="-18" width="130" height="125" rx="18" fill="#FFFFFF" fill-opacity="0.08"/>`;
    } else if (st.motif === 'bpi-crest') {
      art = `
        <path d="M70 240 C135 155, 225 90, 400 45 L400 240 Z" fill="${ac}" fill-opacity="0.18"/>
        <path d="M160 240 C215 170, 290 125, 400 95 L400 240 Z" fill="${ac}" fill-opacity="0.15"/>
        <g transform="translate(278, 38)" stroke="${ac}" stroke-opacity="0.32" stroke-width="2" fill="none">
          <path d="M10 0 H86 V74 C86 112 48 134 48 134 C48 134 10 112 10 74 Z" fill="${ac}" fill-opacity="0.1"/>
          <path d="M48 4 V128 M12 64 H84"/>
          <rect x="24" y="22" width="14" height="26" rx="2"/><rect x="58" y="22" width="14" height="26" rx="2"/>
          <rect x="24" y="76" width="14" height="24" rx="2"/><rect x="58" y="76" width="14" height="24" rx="2"/>
        </g>`;
    } else if (st.motif === 'bpi-rings') {
      art = `
        <g stroke="${ac}" fill="none">
          <circle cx="88" cy="106" r="46" stroke-opacity="0.22" stroke-width="1.2" stroke-dasharray="2 5"/>
          <circle cx="88" cy="106" r="68" stroke-opacity="0.26" stroke-width="1.5" stroke-dasharray="2 6"/>
          <circle cx="88" cy="106" r="92" stroke-opacity="0.22" stroke-width="1.8" stroke-dasharray="3 7"/>
          <circle cx="88" cy="106" r="118" stroke-opacity="0.16" stroke-width="1.4" stroke-dasharray="2 8"/>
          <circle cx="88" cy="106" r="146" stroke-opacity="0.12" stroke-width="1.2"/>
        </g>
        <circle cx="320" cy="95" r="115" fill="#FFFFFF" fill-opacity="0.06"/>`;
    } else if (st.motif === 'ew-ribbon') {
      art = `
        <path d="M165 240 C190 140, 275 55, 375 0 L400 0 L400 240 Z" fill="#000000" fill-opacity="0.22"/>
        <path d="M175 240 C205 145, 290 65, 395 12 L400 12 L400 155 C330 190, 270 220, 235 240 Z" fill="${ac}" fill-opacity="0.28"/>
        <path d="M235 240 C275 185, 338 135, 400 95 L400 240 Z" fill="#000000" fill-opacity="0.18"/>`;
    } else if (st.motif === 'mb-dots') {
      let dots = '';
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 14; c++) {
          const cx = 175 + c * 16;
          const cy = 62 + r * 16 - c * 4.5;
          dots += `<circle cx="${cx}" cy="${cy}" r="${1.1 + (c % 3) * 0.45}" fill="${ac}" fill-opacity="${0.18 + (c / 28)}"/>`;
        }
      }
      art = `
        <path d="M60 240 C145 145, 255 95, 400 35 L400 240 Z" fill="#000000" fill-opacity="0.2"/>
        <path d="M95 240 C180 155, 280 110, 400 62 L400 145 C295 178, 205 210, 145 240 Z" fill="${ac}" fill-opacity="0.22"/>
        ${dots}`;
    } else if (st.motif === 'rcbc-hex') {
      art = `
        <polygon points="150,240 215,155 305,155 350,240" fill="#000000" fill-opacity="0.18"/>
        <g transform="translate(185, 18)">
          <polygon points="85,8 158,50 158,134 85,176 12,134 12,50" fill="${ac}" fill-opacity="0.24" stroke="${ac}" stroke-opacity="0.45" stroke-width="1.2"/>
          <polygon points="85,8 158,50 85,92 12,50" fill="#FFFFFF" fill-opacity="0.14"/>
          <polygon points="85,92 158,50 158,134 85,176" fill="#000000" fill-opacity="0.14"/>
        </g>`;
    } else if (st.motif === 'rcbc-earth') {
      art = `
        <ellipse cx="220" cy="275" rx="250" ry="125" fill="#1E40AF" fill-opacity="0.38"/>
        <ellipse cx="220" cy="278" rx="238" ry="118" fill="#09152B" stroke="#58A2F4" stroke-opacity="0.75" stroke-width="3"/>
        <ellipse cx="220" cy="282" rx="225" ry="108" fill="#050B16"/>
        <path d="M60 220 Q160 185 280 205 M120 232 Q210 205 335 225" stroke="#93C5FD" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="3 6"/>`;
    } else if (st.motif === 'ub-pearl') {
      art = `
        <circle cx="85" cy="195" r="145" fill="#38BDF8" fill-opacity="0.24"/>
        <circle cx="330" cy="55" r="140" fill="#F472B6" fill-opacity="0.18"/>
        <circle cx="315" cy="210" r="120" fill="#FBBF24" fill-opacity="0.22"/>
        <rect x="172" y="-10" width="64" height="198" rx="32" fill="#CBD5E1" fill-opacity="0.52"/>`;
    } else if (st.motif === 'maya-spheres') {
      art = `
        <circle cx="305" cy="120" r="120" fill="#1E293B" fill-opacity="0.42" stroke="#334155" stroke-opacity="0.35" stroke-width="1"/>
        <circle cx="70" cy="195" r="95" fill="#1E293B" fill-opacity="0.35" stroke="#334155" stroke-opacity="0.3" stroke-width="1"/>
        <circle cx="255" cy="175" r="85" fill="#0F172A" fill-opacity="0.65" stroke="#475569" stroke-opacity="0.25" stroke-width="1"/>`;
    } else if (st.motif === 'gotyme-wave') {
      art = `
        <path d="M185 240 C225 170, 305 130, 400 115 L400 240 Z" fill="#06B6D4" fill-opacity="0.35"/>
        <path d="M245 240 C285 190, 340 165, 400 155 L400 240 Z" fill="#38BDF8" fill-opacity="0.38"/>`;
    } else if (st.motif === 'cimb-facets') {
      art = `
        <polygon points="155,0 310,0 235,240 95,240" fill="#DC2626" fill-opacity="0.42"/>
        <polygon points="265,0 400,0 400,150 215,240" fill="#E89818" fill-opacity="0.28"/>
        <polygon points="295,90 400,40 400,240 235,240" fill="#4C0519" fill-opacity="0.48"/>`;
    } else {
      art = `
        <circle cx="345" cy="50" r="145" fill="#1E4B9E" fill-opacity="0.38"/>
        <path d="M115 240 C175 155, 275 115, 400 100 L400 240 Z" fill="#2B6CB0" fill-opacity="0.42"/>
        <path d="M195 240 C250 185, 325 155, 400 148 L400 240 Z" fill="#3698D4" fill-opacity="0.25"/>`;
    }

    return `<svg viewBox="0 0 400 240" preserveAspectRatio="none" class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <defs>
        <linearGradient id="bg-${uid}" x1="0" y1="0" x2="400" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${st.c1}"/>
          <stop offset="52%" stop-color="${st.c2}"/>
          <stop offset="100%" stop-color="${st.c3}"/>
        </linearGradient>
        <radialGradient id="sheen-${uid}" cx="78%" cy="22%" r="65%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${st.light ? '0.55' : '0.18'}"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="240" fill="url(#bg-${uid})"/>
      <rect width="400" height="240" fill="url(#sheen-${uid})"/>
      ${art}
      <rect x="0.75" y="0.75" width="398.5" height="238.5" rx="13" fill="none" stroke="${st.light ? '#0F172A' : '#FFFFFF'}" stroke-opacity="${st.light ? '0.12' : '0.22'}" stroke-width="1.5"/>
    </svg>`;
  };

  const bankBrandHtml = (st, customName, mini = false) => {
    const txt = st.light ? 'text-ink' : 'text-white';
    const sub = st.light ? 'text-ink-2' : 'text-white/85';
    const sz = mini ? 'text-sm' : 'text-lg';
    const custom = customName && customName.toLowerCase() !== st.bank.toLowerCase() && !customName.toLowerCase().startsWith(st.bank.toLowerCase())
      ? `<span class="text-xs font-medium ${sub} ml-1.5 truncate max-w-[140px]">· ${esc(customName)}</span>`
      : '';

    if (st.bank === 'BDO') return `<span class="inline-flex items-baseline font-extrabold ${sz} tracking-tight ${txt}">BDO${custom}</span>`;
    if (st.bank === 'BPI') {
      return `<span class="inline-flex items-center gap-1.5 font-extrabold ${sz} tracking-tight ${txt}">
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true"><path d="M2 1.5h12v9c0 3.8-6 6-6 6s-6-2.2-6-6v-9Z" stroke="currentColor" stroke-width="1.5"/><path d="M8 2v14M2.5 8.5h11" stroke="currentColor" stroke-width="1.2"/></svg>BPI${custom}</span>`;
    }
    if (st.bank === 'eastwest') {
      return `<span class="inline-flex items-center gap-1.5 font-bold ${sz} tracking-tight ${txt}">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><polygon points="9,1 17,9 9,17 1,9" fill="#C82347"/><circle cx="9" cy="5.2" r="1.4" fill="#FBBF24"/><circle cx="9" cy="12.8" r="1.4" fill="#FBBF24"/><circle cx="5.2" cy="9" r="1.4" fill="#FBBF24"/><circle cx="12.8" cy="9" r="1.4" fill="#FBBF24"/></svg>eastwest${custom}</span>`;
    }
    if (st.bank === 'Metrobank') {
      return `<span class="inline-flex items-center gap-1.5 font-bold ${mini ? 'text-xs' : 'text-base'} tracking-tight ${txt}">
        <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden="true"><rect x="0.8" y="0.8" width="14.4" height="12.4" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M3 10.5 6 5l2 3.5L10 5l3 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Metrobank${custom}</span>`;
    }
    if (st.bank === 'RCBC') {
      return `<span class="inline-flex items-center gap-1.5 font-bold ${mini ? 'text-xs' : 'text-sm'} tracking-tight ${txt}">
        <span class="px-1.5 py-0.5 rounded-[5px] border ${st.light ? 'border-ink/40' : 'border-white/45'} font-extrabold">RCBC</span>${custom}</span>`;
    }
    if (st.bank === 'UnionBank') {
      return `<span class="inline-flex items-baseline gap-1 ${txt}"><span class="font-extrabold ${sz} tracking-tight">UB</span><span class="text-xs font-semibold ${sub}">UnionBank</span>${custom}</span>`;
    }
    if (st.bank === 'maya') return `<span class="inline-flex items-baseline font-extrabold ${sz} tracking-tight ${txt}">maya${custom}</span>`;
    if (st.bank === 'GoTyme') return `<span class="inline-flex items-baseline ${sz} tracking-tight ${txt}"><span class="font-extrabold">GO</span><span class="font-normal">tyme</span>${custom}</span>`;
    if (st.bank === 'CIMB') {
      return `<span class="inline-flex items-center gap-1.5 font-extrabold ${mini ? 'text-xs' : 'text-base'} tracking-tight ${txt}">
        <span class="w-4 h-4 rounded-[3px] bg-white text-[#991B1B] inline-flex items-center justify-center text-xs font-black leading-none">&gt;</span>CIMB${custom}</span>`;
    }
    if (st.bank === 'GCash') {
      return `<span class="inline-flex items-center gap-1.5 font-extrabold ${sz} tracking-tight ${txt}">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="2" stroke-dasharray="36 12"/><path d="M10 10h4.5v3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>GCash${custom}</span>`;
    }
    return `<span class="inline-flex items-center gap-1.5 font-bold ${sz} tracking-tight ${txt}">${esc(customName || st.bank)}</span>`;
  };

  function renderCardFace(w, { revealed = false, mini = false, copiedId = 0, fallbackHolder = '' } = {}) {
    const st = getCardStyle(w.style);
    const fg = st.light ? 'text-ink' : 'text-white';
    const sub = st.light ? 'text-ink-2' : 'text-white/85';
    const silverChip = /plat|visa|gotyme|maya|ub|cimb|gcash/i.test(st.id);

    if (mini) {
      return `<div data-ui class="relative overflow-hidden rounded-[10px] aspect-[1.586/1] p-3 flex flex-col justify-between select-none" style="background-color:${st.bg}">
        ${cardArtSvg(st)}
        <div class="relative flex items-start justify-between gap-1">
          ${bankBrandHtml(st, '', true)}
          <span class="text-xs font-semibold tracking-[0.04em] ${sub} text-right leading-tight">${esc(st.tier)}</span>
        </div>
        <div class="relative flex items-end justify-between">
          <span class="inline-flex items-center gap-1.5">${emvChipSvg(silverChip, true)}${nfcSvg(st.light, true)}</span>
          ${netBadgeSvg(st.net, st.light, true)}
        </div>
      </div>`;
    }

    const digits = cleanDigits(w.num || '');
    const canCopy = revealed && digits.length >= 12;
    const hasStoredCard = Boolean(w.hasCard || digits.length >= 12 || w.exp || w.cvv || w.last4);

    return `<div data-ui class="relative overflow-hidden rounded-[13px] aspect-[1.586/1] p-4 sm:p-5 flex flex-col justify-between select-none" style="background-color:${st.bg}">
      ${cardArtSvg(st)}
      <div class="relative flex items-start justify-between gap-2">
        ${bankBrandHtml(st, w.n, false)}
        <span class="text-[11px] sm:text-xs font-semibold tracking-[0.06em] ${sub} text-right">${esc(st.tier)}</span>
      </div>

      <div class="relative flex items-center gap-2.5 my-auto py-1">
        ${emvChipSvg(silverChip, false)}
        ${st.net !== 'cash' ? nfcSvg(st.light, false) : ''}
      </div>

      <div class="relative">
        <div class="flex items-baseline justify-between gap-2 mb-1.5 sm:mb-2">
          <p class="tnum text-base sm:text-lg font-semibold tracking-[0.06em] ${fg} truncate">${esc(formatCardNumberDisplay(w, revealed))}</p>
          ${canCopy ? `<button type="button" data-action="copy-card" data-id="${w.id}" class="text-xs font-semibold px-2 py-0.5 rounded-[4px] ${st.light ? 'bg-ink/10 text-ink' : 'bg-white/15 text-white'} hover:opacity-90 cursor-pointer">${copiedId === w.id ? 'Copied' : 'Copy'}</button>` : ''}
        </div>
        <div class="flex items-end justify-between gap-2 text-xs ${sub}">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 tnum">
            ${hasStoredCard ? `
              <span>EXP <strong class="font-semibold ${fg}">${revealed ? esc(w.exp || '—') : '••/••'}</strong></span>
              <span>CVV <strong class="font-semibold ${fg}">${revealed ? esc(w.cvv || '—') : '•••'}</strong></span>
            ` : `<span>No card number stored</span>`}
            <span class="font-medium tracking-[0.02em] ${sub} truncate max-w-[150px]">${revealed ? esc(w.holder || fallbackHolder || 'PASSBOOK HOLDER') : 'AES-256-GCM'}</span>
          </div>
          ${netBadgeSvg(st.net, st.light, false)}
        </div>
      </div>
    </div>`;
  }

  function renderCardBack(w, { revealed = false, copiedId = 0, fallbackHolder = '' } = {}) {
    const st = getCardStyle(w.style);
    const fg = st.light ? 'text-ink' : 'text-white';
    const sub = st.light ? 'text-ink-2' : 'text-white/85';
    const stripeBg = st.light ? 'bg-ink' : 'bg-[#090D16]';
    const digits = cleanDigits(w.num || '');
    const canCopy = revealed && digits.length >= 12;

    return `<div data-ui class="relative overflow-hidden rounded-[13px] aspect-[1.586/1] flex flex-col justify-between select-none" style="background-color:${st.bg}">
      ${cardArtSvg(st)}
      <div class="relative pt-4">
        <div class="w-full h-8 sm:h-9 ${stripeBg} border-y ${st.light ? 'border-ink/20' : 'border-white/15'}"></div>
      </div>

      <div class="relative px-4 sm:px-5 flex items-center gap-3">
        <div class="flex-1 h-8 rounded-[4px] bg-white/90 text-ink px-3 flex items-center justify-between text-xs">
          <span class="italic font-medium text-ink-2 truncate max-w-[150px]">${revealed ? esc(w.holder || fallbackHolder || 'Authorized Holder') : 'Authorized Signature'}</span>
          <span class="text-xs text-mute">AES-GCM</span>
        </div>
        <div class="w-16 h-8 rounded-[4px] bg-white text-ink px-2 flex flex-col items-center justify-center shrink-0">
          <span class="text-[10px] font-semibold text-mute leading-none">CVV</span>
          <span class="tnum text-sm font-bold text-ink leading-tight">${revealed ? esc(w.cvv || '—') : '•••'}</span>
        </div>
      </div>

      <div class="relative px-4 sm:px-5 pb-4 flex items-end justify-between gap-2 text-xs ${sub}">
        <div class="min-w-0">
          <p class="tnum text-sm font-semibold tracking-[0.06em] ${fg} truncate">${esc(formatCardNumberDisplay(w, revealed))}</p>
          <div class="flex items-center gap-3 mt-1 tnum">
            <span>VALID THRU <strong class="font-semibold ${fg}">${revealed ? esc(w.exp || '—') : '••/••'}</strong></span>
            ${canCopy ? `<button type="button" data-action="copy-card" data-id="${w.id}" class="text-xs font-semibold px-2 py-0.5 rounded-[4px] ${st.light ? 'bg-ink/10 text-ink' : 'bg-white/15 text-white'} hover:opacity-90 cursor-pointer">${copiedId === w.id ? 'Copied' : 'Copy'}</button>` : '<span>Zero-knowledge vault</span>'}
          </div>
        </div>
        ${netBadgeSvg(st.net, st.light, false)}
      </div>
    </div>`;
  }

  const OWCards = {
    CARD_STYLES,
    getCardStyle,
    brandLogo,
    formatCardNumberDisplay,
    renderCardFace,
    renderCardBack
  };

  global.OWCards = OWCards;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OWCards;
  }
})(typeof window !== 'undefined' ? window : globalThis);
