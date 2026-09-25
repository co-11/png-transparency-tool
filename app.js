(function() {
  'use strict';
  
  // ===== DOM Elements =====
  const $=id=>document.getElementById(id); const DOM={workspace:$('workspace'),dropzone:$('dropzone'),chooseFileBtn:$('chooseFileBtn'),fileInput:$('fileInput'),editor:$('editor'),workCvs:$('workCvs'),workContainer:$('workContainer'),overlay:$('overlay'),historyList:$('historyList'),historyCount:$('historyCount'),helpPanel:$('helpPanel'),closeHelp:$('closeHelp'),helpBtn:$('helpBtn'),themeBtn:$('themeBtn'),themeIcon:$('themeIcon'),clearBtn:$('clearBtn'),leftPanelToggle:$('leftPanelToggle'),leftRailToggle:$('leftRailToggle'),rightPanelToggle:$('rightPanelToggle'),rightRailToggle:$('rightRailToggle'),tools:$('tools'),toolsEmpty:$('toolsEmpty'),outputEmpty:$('outputEmpty'),editorControls:$('editorControls'),imageStatus:$('imageStatus'),fileName:$('fileName'),tColor:$('tColor'),tColorValue:$('tColorValue'),tTol:$('tTol'),tTolVal:$('tTolVal'),tAll:$('tAll'),rFrom:$('rFrom'),rFromValue:$('rFromValue'),rTo:$('rTo'),rToValue:$('rToValue'),rTol:$('rTol'),rTolVal:$('rTolVal'),fColor:$('fColor'),fColorValue:$('fColorValue'),fOnly:$('fOnly'),mosSize:$('mosSize'),mosSizeVal:$('mosSizeVal'),outW:$('outW'),outH:$('outH'),workFit:$('workFit'),modeHint:$('modeHint'),modePick:$('modePick'),modeCrop:$('modeCrop'),modeSelect:$('modeSelect'),modeLasso:$('modeLasso'),modeMagic:$('modeMagic'),mTol:$('mTol'),mTolVal:$('mTolVal'),magicTolWrap:$('magicTolWrap'),cropConfirm:$('cropConfirm'),lassoConfirm:$('lassoConfirm'),lassoClear:$('lassoClear'),invertSelection:$('invertSelection'),selectionActions:$('selectionActions'),selectionAmount:$('selectionAmount'),shrinkSelection:$('shrinkSelection'),expandSelection:$('expandSelection'),featherSelection:$('featherSelection'),canvasControls:$('canvasControls'),aspectControls:$('aspectControls'),ratioWidth:$('ratioWidth'),ratioHeight:$('ratioHeight'),ratioLandscape:$('ratioLandscape'),ratioPortrait:$('ratioPortrait'),trimTransparent:$('trimTransparent'),toggleBorder:$('toggleBorder'),confirmDialog:$('confirmDialog'),confirmTitle:$('confirmTitle'),confirmMessage:$('confirmMessage'),confirmCancel:$('confirmCancel'),confirmAccept:$('confirmAccept')}; const workCtx=DOM.workCvs.getContext('2d',{willReadFrequently:true});

  // ===== State =====
  const state={origImg:null,showBorder:true,history:[],historyIdx:-1,ratio:1,mode:'pick',dark:localStorage.getItem('dark')!==null?localStorage.getItem('dark')==='1':window.matchMedia('(prefers-color-scheme: dark)').matches,zoom:{work:100},pan:{work:{x:0,y:0}},panels:{leftOpen:true,rightOpen:true},aspectRatio:null,aspectMode:'free',aspectOrientation:'landscape',crop:{start:null,end:null,active:false},selections:[],currentSelection:null,lassoPoints:[],addMode:false,dragging:null};

  // ===== Utilities =====
  const getCurrentHistoryEntry = () => state.history[state.historyIdx] || null;
  const cloneCurrentImageData = () => {
    const entry = getCurrentHistoryEntry();
    return entry
      ? new ImageData(new Uint8ClampedArray(entry.data.data), entry.w, entry.h)
      : null;
  };
  const getSelectionCount = () => state.selections.length + (state.currentSelection ? 1 : 0);
  const clearSelectionState = ({ clearCrop = false, clearOverlay = false } = {}) => {
    state.selections = [];
    state.currentSelection = null;
    state.lassoPoints = [];
    if (clearCrop) state.crop = { start: null, end: null, active: false };
    if (clearOverlay) DOM.overlay.innerHTML = '';
  };

  const hex2rgb = hex => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  };
  
  // Compare squared RGB distance to avoid Math.sqrt() in pixel loops.
  const colorDistSq = (data, i, c) =>
    (data[i] - c.r) ** 2 + (data[i + 1] - c.g) ** 2 + (data[i + 2] - c.b) ** 2;
  
  const pointInPolygon = (px, py, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  // ===== Inline SVG, theme, help, zoom, panels =====
  const ICON_PATHS={image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 4.5-4.5 3.5 3 2.5-2.5L20 18"/>',restart:'<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.9 1.6c-.9.8-1.7 1.2-1.7 2.4"/><path d="M12 16.5h.01"/>',warning:'<path d="M10.3 3.8 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 16.5h.01"/>',moon:'<path d="M20 15.4A8.5 8.5 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/>',sun:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>','chevron-left':'<path d="m14.5 5-7 7 7 7"/>','chevron-right':'<path d="m9.5 5 7 7-7 7"/>',upload:'<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',folder:'<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v7A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5Z"/>',sparkles:'<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z"/>',transparency:'<circle cx="12" cy="12" r="8"/><path d="M8 8h.01M16 8h.01M8 16h.01M16 16h.01"/>',palette:'<path d="M12 4a8 8 0 1 0 0 16h1.2a1.8 1.8 0 0 0 1.1-3.2 1.8 1.8 0 0 1 1.1-3.2h1.6A4 4 0 0 0 21 9.6C19.7 6.3 16.2 4 12 4Z"/><path d="M7.5 11h.01M9.5 7.5h.01M14 7h.01"/>','arrow-right':'<path d="M4 12h15M13 6l6 6-6 6"/>',fill:'<path d="M5 20h14M7 17h10M9 14h6M12 3v8"/><path d="m8.5 6.5 3.5-3.5 3.5 3.5"/>',mosaic:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',edit:'<path d="m4 16.5-.8 3.3 3.3-.8L18.8 6.7a2.3 2.3 0 0 0-3.3-3.3Z"/><path d="m14 5 5 5"/>',picker:'<path d="m14.5 4.5 5 5M4 20l3.3-.7L18.7 7.9a2.1 2.1 0 0 0-3-3L4.7 16.3Z"/><path d="m11 8 5 5"/>',crop:'<path d="M6 3v12a3 3 0 0 0 3 3h12M18 21V9a3 3 0 0 0-3-3H3"/>',select:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 4v3M16 4v3M4 8h3M4 16h3M20 8h-3M20 16h-3M8 20v-3M16 20v-3"/>',lasso:'<path d="M19 10.5c0 3.3-3.1 6.5-7.2 7.2-4.1.7-7.7-1.2-7.7-4.3 0-3.1 3.2-6 7.2-6.8 4-.8 7.7.9 7.7 3.9Z"/><path d="M8.5 16.5c-.5 2.2-1.9 3.5-3.5 3.5"/>',magic:'<path d="m15 4 5 5M13.5 5.5l5 5L9 20H4v-5Z"/><path d="M5 4v4M3 6h4M19 16v4M17 18h4"/>',hand:'<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V11m0-2a1.5 1.5 0 0 1 3 0v5.5c0 3.6-2.4 6-6 6h-1.5c-2.5 0-4.2-1.3-5.3-3.2L2.8 14a1.5 1.5 0 0 1 2.6-1.5L8 16"/>',check:'<path d="m5 12 4 4L19 6"/>',flip:'<path d="m8 7-4 5 4 5M16 7l4 5-4 5M4 12h16"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',lightbulb:'<path d="M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 16 14c-.8.6-1 1.2-1 2H9c0-.7-.2-1.1-.5-1.5Z"/>',border:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 4v16M16 4v16M4 8h16M4 16h16"/>','zoom-out':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M6 10.5h9M16 16l5 5"/>','zoom-in':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M6 10.5h9M10.5 6v9M16 16l5 5"/>',fit:'<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',copy:'<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',history:'<path d="M4 12a8 8 0 1 0 2-5.3M4 5v5h5M12 7v5l3 2"/>',landscape:'<rect x="3" y="7" width="18" height="10" rx="2"/>',portrait:'<rect x="7" y="3" width="10" height="18" rx="2"/>',refresh:'<path d="M20 12a8 8 0 0 0-14.8-4L4 10M4 5v5h5M4 12a8 8 0 0 0 14.8 4L20 14M20 19v-5h-5"/>',mouse:'<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 3v5M7 8h10"/>'};
  const svgIcon=(name,cls='icon-svg')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]||ICON_PATHS.help}</svg>`;const setIcon=(el,name)=>{if(el){el.dataset.icon=name;el.innerHTML=svgIcon(name);}};const hydrateIcons=()=>document.querySelectorAll('[data-icon]').forEach(el=>{if(!el.firstElementChild)el.innerHTML=svgIcon(el.dataset.icon);});const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));const syncRangeFill=input=>{if(!input)return;const min=+input.min||0,max=+input.max||100,v=+input.value||min;input.style.setProperty('--range-fill',`${(v-min)/(max-min||1)*100}%`);};
  hydrateIcons();const updateTheme=()=>{document.body.classList.toggle('dark',state.dark);setIcon(DOM.themeIcon,state.dark?'sun':'moon');localStorage.setItem('dark',state.dark?'1':'0');};updateTheme();const media=window.matchMedia('(prefers-color-scheme: dark)');if(media.addEventListener)media.addEventListener('change',e=>{if(localStorage.getItem('dark')===null){state.dark=e.matches;updateTheme();}});DOM.themeBtn.onclick=()=>{state.dark=!state.dark;updateTheme();};let helpLastFocus=null;const help=visible=>{const opening=visible&&!DOM.helpPanel.classList.contains('show');DOM.helpPanel.classList.toggle('show',visible);DOM.helpPanel.setAttribute('aria-hidden',String(!visible));document.body.classList.toggle('help-open',visible);if(opening){helpLastFocus=document.activeElement;requestAnimationFrame(()=>DOM.closeHelp.focus());}else if(!visible&&helpLastFocus){helpLastFocus.focus?.();helpLastFocus=null;}};DOM.helpBtn.onclick=()=>help(!DOM.helpPanel.classList.contains('show'));DOM.closeHelp.onclick=()=>help(false);DOM.helpPanel.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();DOM.closeHelp.focus();}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&DOM.helpPanel.classList.contains('show')){e.preventDefault();help(false);}});document.addEventListener('mousedown',e=>{if(DOM.helpPanel.classList.contains('show')&&!DOM.helpPanel.contains(e.target)&&!DOM.helpBtn.contains(e.target))help(false);});
  const applyZoom=(cvs,zoom,pan)=>{const s=zoom/100;cvs.style.transform=`scale(${s}) translate(${pan.x/s}px,${pan.y/s}px)`;};const applyWorkZoom=()=>applyZoom(DOM.workCvs,state.zoom.work,state.pan.work);const fitWorkZoom=()=>{if(!DOM.workCvs.width||!DOM.workCvs.height||!DOM.workContainer.clientWidth||!DOM.workContainer.clientHeight)return;const cw=DOM.workContainer.clientWidth-24,ch=DOM.workContainer.clientHeight-24;state.zoom.work=clamp(Math.round(Math.min(cw/DOM.workCvs.width,ch/DOM.workCvs.height)*100),10,400);state.pan.work={x:0,y:0};applyWorkZoom();};const scheduleFit=()=>requestAnimationFrame(()=>{if(state.historyIdx>=0)fitWorkZoom();});DOM.workContainer.onwheel=e=>{if(state.historyIdx<0)return;e.preventDefault();const r=DOM.workContainer.getBoundingClientRect(),mx=e.clientX-r.left-r.width/2,my=e.clientY-r.top-r.height/2,old=state.zoom.work;state.zoom.work=clamp(old+(e.deltaY<0?10:-10),10,400);const z=state.zoom.work/old;state.pan.work.x=mx-(mx-state.pan.work.x)*z;state.pan.work.y=my-(my-state.pan.work.y)*z;applyWorkZoom();};DOM.workFit.onclick=fitWorkZoom;
  const applyPanelState=({fit=true}={})=>{DOM.workspace.classList.toggle('left-collapsed',!state.panels.leftOpen);DOM.workspace.classList.toggle('right-collapsed',!state.panels.rightOpen);const l=state.panels.leftOpen?'左サイドバーを閉じる':'左サイドバーを開く',r=state.panels.rightOpen?'右サイドバーを閉じる':'右サイドバーを開く';[DOM.leftPanelToggle,DOM.leftRailToggle].forEach(x=>{x.setAttribute('aria-expanded',String(state.panels.leftOpen));x.setAttribute('aria-label',l);});[DOM.rightPanelToggle,DOM.rightRailToggle].forEach(x=>{x.setAttribute('aria-expanded',String(state.panels.rightOpen));x.setAttribute('aria-label',r);});DOM.leftPanelToggle.title=l;DOM.leftRailToggle.title='ツールを開く';DOM.rightPanelToggle.title=r;DOM.rightRailToggle.title='出力を開く';localStorage.setItem('png-panel-state',JSON.stringify(state.panels));if(fit)scheduleFit();};const togglePanel=side=>{const k=side==='left'?'leftOpen':'rightOpen';state.panels[k]=!state.panels[k];applyPanelState();};try{const p=JSON.parse(localStorage.getItem('png-panel-state')||'null');if(p&&typeof p.leftOpen==='boolean'&&typeof p.rightOpen==='boolean')state.panels=p;}catch(_){}DOM.leftPanelToggle.onclick=()=>togglePanel('left');DOM.leftRailToggle.onclick=()=>togglePanel('left');DOM.rightPanelToggle.onclick=()=>togglePanel('right');DOM.rightRailToggle.onclick=()=>togglePanel('right');applyPanelState({fit:false});if(window.ResizeObserver)new ResizeObserver(scheduleFit).observe(DOM.workContainer);const setEditorAvailability=enabled=>{document.querySelectorAll('.requires-image').forEach(x=>x.disabled=!enabled);DOM.tools.hidden=!enabled;DOM.toolsEmpty.hidden=enabled;DOM.editorControls.hidden=!enabled;DOM.outputEmpty.hidden=enabled;};setEditorAvailability(false);

  // ===== Tool panel switcher =====
  const toolTabs = [...document.querySelectorAll('.tool-tab')];
  const toolPanels = [...document.querySelectorAll('[data-tool-panel]')];
  const setActiveTool = tool => {
    if (!toolTabs.some(tab => tab.dataset.tool === tool)) tool = 'transparency';
    toolTabs.forEach(tab => {
      const active = tab.dataset.tool === tool;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    toolPanels.forEach(panel => {
      panel.hidden = panel.dataset.toolPanel !== tool;
    });
    localStorage.setItem('png-active-tool', tool);
  };
  toolTabs.forEach((tab, index) => {
    tab.onclick = () => setActiveTool(tab.dataset.tool);
    tab.onkeydown = e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const columns = 2;
      let next = index;
      if (e.key === 'ArrowLeft') next = (index - 1 + toolTabs.length) % toolTabs.length;
      if (e.key === 'ArrowRight') next = (index + 1) % toolTabs.length;
      if (e.key === 'ArrowUp') next = (index - columns + toolTabs.length) % toolTabs.length;
      if (e.key === 'ArrowDown') next = (index + columns) % toolTabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = toolTabs.length - 1;
      setActiveTool(toolTabs[next].dataset.tool);
      toolTabs[next].focus();
    };
  });
  setActiveTool(localStorage.getItem('png-active-tool') || 'transparency');

  // ===== In-app confirmation dialog =====
  let confirmResolver = null;
  let confirmLastFocus = null;
  const closeConfirm = result => {
    if (!confirmResolver) return;
    const resolve = confirmResolver;
    confirmResolver = null;
    DOM.confirmDialog.classList.remove('show');
    DOM.confirmDialog.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('confirm-open');
    resolve(result);
    confirmLastFocus?.focus?.();
  };
  const confirmAction = ({ title = '操作を確認', message, acceptLabel = '実行する' }) => new Promise(resolve => {
    if (confirmResolver) confirmResolver(false);
    confirmResolver = resolve;
    confirmLastFocus = document.activeElement;
    DOM.confirmTitle.textContent = title;
    DOM.confirmMessage.textContent = message;
    DOM.confirmAccept.textContent = acceptLabel;
    DOM.confirmDialog.classList.add('show');
    DOM.confirmDialog.setAttribute('aria-hidden', 'false');
    document.body.classList.add('confirm-open');
    requestAnimationFrame(() => DOM.confirmCancel.focus());
  });
  DOM.confirmCancel.onclick = () => closeConfirm(false);
  DOM.confirmAccept.onclick = () => closeConfirm(true);
  DOM.confirmDialog.querySelector('[data-confirm-cancel]').onclick = () => closeConfirm(false);
  DOM.confirmDialog.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeConfirm(false);
    }
    if (e.key === 'Tab') {
      const buttons = [DOM.confirmCancel, DOM.confirmAccept];
      const index = buttons.indexOf(document.activeElement);
      if (e.shiftKey && index <= 0) { e.preventDefault(); buttons[1].focus(); }
      if (!e.shiftKey && index === 1) { e.preventDefault(); buttons[0].focus(); }
    }
  });

  // ===== History =====
  const HISTORY_MAX_STEPS = 20;
  const HISTORY_MAX_BYTES = 192 * 1024 * 1024;

  const trimHistory = () => {
    let totalBytes = state.history.reduce((sum, item) => sum + item.data.data.byteLength, 0);
    while (state.history.length > 1 &&
      (state.history.length > HISTORY_MAX_STEPS || totalBytes > HISTORY_MAX_BYTES)) {
      const removed = state.history.shift();
      totalBytes -= removed.data.data.byteLength;
      state.historyIdx--;
    }
    state.historyIdx = Math.max(0, state.historyIdx);
  };

  const saveHistory = (label, detail = '') => {
    const data = workCtx.getImageData(0, 0, DOM.workCvs.width, DOM.workCvs.height);
    state.history = state.history.slice(0, state.historyIdx + 1);
    state.history.push({ data, label, detail, w: DOM.workCvs.width, h: DOM.workCvs.height, time: new Date().toLocaleTimeString() });
    state.historyIdx = state.history.length - 1;
    trimHistory();
    renderHistory();
    if(typeof updateButtons==='function')updateButtons();
  };

  const goToHistory = i => {
    if (i < 0 || i >= state.history.length) return;
    state.historyIdx = i;
    const s = state.history[i];
    DOM.workCvs.width = s.w;
    DOM.workCvs.height = s.h;
    workCtx.putImageData(s.data, 0, 0);
    clearSelectionState({ clearCrop: true, clearOverlay: true });
    state.ratio = s.w / s.h;
    DOM.outW.value = s.w;
    DOM.outH.value = s.h;
    fitWorkZoom();
    renderHistory();
    updateButtons();
  };

  const deleteHistory = i => {
    if (i === 0 || state.history.length <= 1) return;
    state.history.splice(i, 1);
    if (state.historyIdx >= i) state.historyIdx = Math.max(0, state.historyIdx - 1);
    goToHistory(state.historyIdx);
  };

  const renderHistory=()=>{DOM.historyCount.textContent=state.history.length;DOM.historyList.innerHTML=state.history.map((h,i)=>`<div class="history-item ${i===state.historyIdx?'active':''}" data-i="${i}"><span class="history-num">${i+1}</span><div class="history-info"><div class="history-label">${h.label}</div><div class="history-detail">${h.detail} (${h.w}×${h.h}) ${h.time}</div></div><button class="history-del" data-i="${i}" ${i===0?'disabled':''} type="button" aria-label="履歴${i+1}を削除">${svgIcon('close')}</button></div>`).join('');DOM.historyList.querySelectorAll('.history-item').forEach(x=>x.onclick=e=>{if(!e.target.closest('.history-del'))goToHistory(+x.dataset.i);});DOM.historyList.querySelectorAll('.history-del').forEach(x=>x.onclick=e=>{e.stopPropagation();deleteHistory(+x.dataset.i);});};
  const initEditor=img=>{DOM.workCvs.width=img.width;DOM.workCvs.height=img.height;workCtx.clearRect(0,0,img.width,img.height);workCtx.drawImage(img,0,0);state.ratio=img.width/img.height;DOM.outW.value=img.width;DOM.outH.value=img.height;state.history=[];state.historyIdx=-1;clearSelectionState({ clearCrop: true });state.pan.work={x:0,y:0};saveHistory('元画像','読み込み');DOM.dropzone.classList.add('hidden');DOM.editor.classList.remove('hidden');DOM.clearBtn.style.display='inline-flex';DOM.imageStatus.textContent=`${img.width} × ${img.height}px`;setEditorAvailability(true);setTimeout(fitWorkZoom,50);};

  // ===== Drop Zone
  const LARGE_IMAGE_PIXELS=20_000_000;
  const loadFile=file=>{if(!file?.type?.startsWith('image/'))return;const nextName=file.name?file.name.replace(/\.[^.]+$/,''):'';const rd=new FileReader();rd.onload=e=>{const img=new Image();img.onload=async()=>{const pixels=img.width*img.height;if(pixels>LARGE_IMAGE_PIXELS){const approx=Math.ceil(pixels*4/1024/1024);const ok=await confirmAction({title:'大きな画像を読み込みますか？',message:`${img.width} × ${img.height}px（展開時 約${approx}MB）です。端末によっては処理が遅くなったり、メモリ不足になる可能性があります。`,acceptLabel:'このまま読み込む'});if(!ok){DOM.fileInput.value='';return;}}if(nextName)DOM.fileName.value=nextName;state.origImg=img;initEditor(img);};img.src=e.target.result;};rd.readAsDataURL(file);};DOM.dropzone.ondragover=e=>{e.preventDefault();DOM.dropzone.classList.add('dragover');};DOM.dropzone.ondragleave=()=>DOM.dropzone.classList.remove('dragover');DOM.dropzone.ondrop=e=>{e.preventDefault();DOM.dropzone.classList.remove('dragover');loadFile(e.dataTransfer.files[0]);};DOM.dropzone.onclick=e=>{if(e.target!==DOM.chooseFileBtn)DOM.fileInput.click();};DOM.chooseFileBtn.onclick=e=>{e.stopPropagation();DOM.fileInput.click();};DOM.fileInput.onchange=e=>loadFile(e.target.files[0]);const clearAll=()=>{state.origImg=null;state.history=[];state.historyIdx=-1;clearSelectionState({ clearCrop: true });DOM.editor.classList.add('hidden');DOM.dropzone.classList.remove('hidden');DOM.clearBtn.style.display='none';DOM.fileInput.value='';DOM.imageStatus.textContent='画像を読み込むと編集できます';DOM.overlay.innerHTML='';DOM.workCvs.style.transform='none';renderHistory();setEditorAvailability(false);};DOM.clearBtn.onclick=async()=>{const ok=await confirmAction({title:'画像をクリアしますか？',message:'編集中の画像と履歴が削除されます。この操作は元に戻せません。',acceptLabel:'クリアする'});if(ok)clearAll();};document.onpaste=async e=>{const item=[...e.clipboardData.items].find(x=>x.type.startsWith('image/'));if(!item)return;const file=item.getAsFile();if(!file)return;e.preventDefault();if(state.historyIdx<0){loadFile(file);return;}const ok=await confirmAction({title:'画像を置き換えますか？',message:'現在の編集内容と履歴を破棄して、クリップボードの画像を読み込みます。',acceptLabel:'置き換える'});if(ok)loadFile(file);};

  // ===== Mode Management
  const modeHints={pick:`${svgIcon('lightbulb')}<span>クリックで色を取得</span>`,crop:`${svgIcon('lightbulb')}<span>比率を選んでドラッグ <kbd>Shift: 正方形</kbd> <kbd>Enter: 確定</kbd></span>`,select:`${svgIcon('lightbulb')}<span>比率を選んで矩形選択 <kbd>Ctrl / ⌘: 追加</kbd></span>`,lasso:`${svgIcon('lightbulb')}<span>クリックで頂点追加 <kbd>Ctrl / ⌘: 追加</kbd></span>`,magic:`${svgIcon('lightbulb')}<span>クリックで同色領域を自動選択 <kbd>Ctrl / ⌘: 追加</kbd></span>`,hand:`${svgIcon('lightbulb')}<span>ドラッグで画像を移動 <kbd>右クリックドラッグ: 共通</kbd></span>`};const updateModeHint=()=>{let x=modeHints[state.mode];if((state.mode==='select'||state.mode==='lasso')&&state.addMode)x+=' <kbd style="color:var(--accent)">[追加モード]</kbd>';DOM.modeHint.innerHTML=x;};const updateButtons=()=>{DOM.lassoConfirm.style.display=state.mode==='lasso'&&state.addMode&&state.lassoPoints.length>=3?'flex':'none';const selMode=['lasso','select','magic'].includes(state.mode);const hasSelection=state.selections.length>0||state.currentSelection!==null;const ratioMode=state.mode==='crop'||state.mode==='select';DOM.lassoClear.style.display=selMode?'flex':'none';DOM.invertSelection.style.display=selMode&&hasSelection?'flex':'none';DOM.selectionActions.hidden=!hasSelection;DOM.aspectControls.hidden=!ratioMode;DOM.trimTransparent.hidden=state.mode!=='crop';DOM.cropConfirm.style.display=state.mode==='crop'&&state.crop.start&&state.crop.end?'flex':'none';};const setMode=m=>{state.mode=m;const map={pick:DOM.modePick,crop:DOM.modeCrop,select:DOM.modeSelect,lasso:DOM.modeLasso,magic:DOM.modeMagic};Object.entries(map).forEach(([k,b])=>{b.classList.toggle('active',k===m);b.setAttribute('aria-pressed',String(k===m));});DOM.workContainer.classList.toggle('hand',m==='hand');DOM.workCvs.className=m;DOM.magicTolWrap.hidden=m!=='magic';updateModeHint();clearSelectionState({ clearOverlay: true });DOM.tAll.checked=false;if(state.historyIdx>=0)workCtx.putImageData(state.history[state.historyIdx].data,0,0);updateButtons();};DOM.modePick.onclick=()=>setMode('pick');DOM.modeCrop.onclick=()=>setMode('crop');DOM.modeSelect.onclick=()=>setMode('select');DOM.modeLasso.onclick=()=>setMode('lasso');DOM.modeMagic.onclick=()=>setMode('magic');

  // ===== Magic Wand (Flood Fill Selection) =====
  const floodFillSelect = (startX, startY, tolerance) => {
    if (state.historyIdx < 0) return null;
    const imgData = state.history[state.historyIdx].data;
    const w = imgData.width, h = imgData.height;
    const data = imgData.data;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return null;

    const pixelCount = w * h;
    const startPixelIdx = startY * w + startX;
    const startIdx = startPixelIdx * 4;
    const targetR = data[startIdx], targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2], targetA = data[startIdx + 3];
    const toleranceSq = tolerance * tolerance;
    const visited = new Uint8Array(pixelCount);
    const selectedMask = new Uint8Array(pixelCount);
    const selectedIndices = new Int32Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0, tail = 0, selectedCount = 0;
    let minX = startX, minY = startY, maxX = startX, maxY = startY;
    queue[tail++] = startPixelIdx;
    visited[startPixelIdx] = 1;

    while (head < tail) {
      const pixelIdx = queue[head++];
      const idx = pixelIdx * 4;
      const distanceSq = (data[idx] - targetR) ** 2 +
        (data[idx + 1] - targetG) ** 2 +
        (data[idx + 2] - targetB) ** 2 +
        (data[idx + 3] - targetA) ** 2;
      if (distanceSq > toleranceSq) continue;

      selectedMask[pixelIdx] = 1;
      selectedIndices[selectedCount++] = pixelIdx;
      const x = pixelIdx % w;
      const y = Math.floor(pixelIdx / w);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);

      let next;
      if (x + 1 < w) {
        next = pixelIdx + 1;
        if (!visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (x > 0) {
        next = pixelIdx - 1;
        if (!visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (y + 1 < h) {
        next = pixelIdx + w;
        if (!visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (y > 0) {
        next = pixelIdx - w;
        if (!visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }

    if (selectedCount === 0) return null;
    const compactIndices = selectedIndices.slice(0, selectedCount);
    const pixelSet = {
      size: selectedCount,
      has: index => selectedMask[index] === 1,
      forEach: callback => {
        for (let i = 0; i < compactIndices.length; i++) callback(compactIndices[i]);
      }
    };
    return {
      type: 'magic',
      x: minX, y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      pixels: null,
      pixelSet
    };
  };
  // ===== Color Picker Loupe =====
  const loupe = $('pickerLoupe');
  const loupeCvs = $('loupeCvs');
  const loupeCtx = loupeCvs.getContext('2d');
  const loupeSwatch = $('loupeSwatch');
  const loupeHex = $('loupeHex');
  const updateLoupe = (e, imgX, imgY) => {
    if (state.mode !== 'pick' || state.historyIdx < 0) {
      loupe.style.display = 'none';
      return;
    }
    const imgData = state.history[state.historyIdx].data;
    const imgW = imgData.width, imgH = imgData.height;
    if (imgX < 0 || imgX >= imgW || imgY < 0 || imgY >= imgH) {
      loupe.style.display = 'none';
      return;
    }
    // Show loupe
    loupe.style.display = 'block';
    loupe.style.left = (e.clientX + 20) + 'px';
    loupe.style.top = (e.clientY - 80) + 'px';
    // Draw zoomed area (11x11 pixels centered on cursor)
    loupeCtx.imageSmoothingEnabled = false;
    loupeCtx.clearRect(0, 0, 60, 60);
    const radius = 5;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = imgX + dx, py = imgY + dy;
        if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
          const idx = (py * imgW + px) * 4;
          const r = imgData.data[idx], g = imgData.data[idx + 1], b = imgData.data[idx + 2], a = imgData.data[idx + 3];
          if (a > 0) {
            loupeCtx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
          } else {
            loupeCtx.fillStyle = (((dx + radius) + (dy + radius)) % 2 === 0) ? '#ccc' : '#fff';
          }
          loupeCtx.fillRect((dx + radius) * 5.45, (dy + radius) * 5.45, 5.45, 5.45);
        }
      }
    }
    // Get center pixel color
    const idx = (imgY * imgW + imgX) * 4;
    const r = imgData.data[idx], g = imgData.data[idx + 1], b = imgData.data[idx + 2];
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    loupeSwatch.style.background = hex;
    loupeHex.textContent = hex.toUpperCase();
  };
  const hideLoupe = () => { loupe.style.display = 'none'; };
  DOM.workContainer.addEventListener('mousemove', e => {
    if (state.mode === 'pick') {
      const rect = DOM.workCvs.getBoundingClientRect();
      const scale = state.zoom.work / 100;
      const x = Math.floor((e.clientX - rect.left) / scale);
      const y = Math.floor((e.clientY - rect.top) / scale);
      updateLoupe(e, x, y);
    }
  });
  DOM.workContainer.addEventListener('mouseleave', hideLoupe);

  // ===== Canvas Drawing =====
  const redrawCanvas = () => {
    if (state.historyIdx < 0) return;
    workCtx.putImageData(state.history[state.historyIdx].data, 0, 0);
    // Auto-toggle "tAll" checkbox based on selection state
    const hasSelection = state.selections.length > 0 || state.currentSelection !== null || state.lassoPoints.length >= 3;
    DOM.tAll.checked = hasSelection;
    
    // Draw selections
    const drawSelection = (sel, hue) => {
      workCtx.strokeStyle = `hsl(${hue}, 80%, 50%)`;
      workCtx.fillStyle = `hsla(${hue}, 80%, 50%, 0.15)`;
      workCtx.lineWidth = 2;
      workCtx.setLineDash([6, 3]);
      
      if (sel.type === 'lasso') {
        workCtx.beginPath();
        workCtx.moveTo(sel.points[0].x, sel.points[0].y);
        sel.points.slice(1).forEach(p => workCtx.lineTo(p.x, p.y));
        workCtx.closePath();
        workCtx.fill();
        workCtx.stroke();
      } else if (sel.type === 'magic') {
        // Draw diagonal stripes pattern for magic selection (use pixelSet for performance)
        const stripeSize = 4;
        const imgW = DOM.workCvs.width;
        sel.pixelSet.forEach(idx => {
          const x = idx % imgW, y = Math.floor(idx / imgW);
          const isStripe = ((x + y) % (stripeSize * 2)) < stripeSize;
          workCtx.fillStyle = isStripe ? `hsla(${hue}, 80%, 50%, 0.5)` : `hsla(${hue}, 80%, 70%, 0.25)`;
          workCtx.fillRect(x, y, 1, 1);
        });
      } else {
        workCtx.fillRect(sel.x, sel.y, sel.w, sel.h);
        workCtx.strokeRect(sel.x, sel.y, sel.w, sel.h);
      }
      workCtx.setLineDash([]);
    };
    
    state.selections.forEach((sel, i) => drawSelection(sel, (i * 60) % 360));
    if (state.currentSelection) drawSelection(state.currentSelection, 140);
    
    // Draw lasso points
    if (state.lassoPoints.length > 0) {
      workCtx.strokeStyle = '#ff9900';
      workCtx.lineWidth = 2;
      workCtx.setLineDash([6, 3]);
      workCtx.beginPath();
      workCtx.moveTo(state.lassoPoints[0].x, state.lassoPoints[0].y);
      state.lassoPoints.slice(1).forEach(p => workCtx.lineTo(p.x, p.y));
      if (state.lassoPoints.length > 2) {
        workCtx.closePath();
        workCtx.fillStyle = 'rgba(255, 153, 0, 0.15)';
        workCtx.fill();
      }
      workCtx.stroke();
      workCtx.setLineDash([]);
      
      state.lassoPoints.forEach((p, i) => {
        workCtx.beginPath();
        workCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        workCtx.fillStyle = i === 0 ? '#ff5500' : '#ff9900';
        workCtx.fill();
      });
    }
    updateButtons();
  };

  const updateOverlay = () => {
    if (state.mode !== 'lasso' || state.lassoPoints.length === 0) {
      DOM.overlay.innerHTML = '';
      return;
    }
    
    const containerRect = DOM.workContainer.getBoundingClientRect();
    const cvsRect = DOM.workCvs.getBoundingClientRect();
    const scale = state.zoom.work / 100;
    const offsetX = cvsRect.left - containerRect.left;
    const offsetY = cvsRect.top - containerRect.top;
    
    const pts = state.lassoPoints.map(p => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale }));
    let pathD = `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join('');
    if (pts.length >= 3) pathD += ' Z';
    
    const circles = pts.map((p, i) => 
      `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${i === 0 ? '#ff5500' : '#ff9900'}" stroke="#fff" stroke-width="1"/>`
    ).join('');
    
    DOM.overlay.innerHTML = `
      <path d="${pathD}" fill="${pts.length >= 3 ? 'rgba(255,153,0,0.15)' : 'none'}" stroke="#ff9900" stroke-width="2" stroke-dasharray="6,3" filter="drop-shadow(0 0 2px #000)"/>
      ${circles}
    `;
  };

  // ===== Canvas Interactions =====
  // Right-click drag = pan (hand mode) in any mode
  DOM.workContainer.addEventListener('contextmenu', e => e.preventDefault());
  let workDrag = { active: false, start: null, startPan: null };
  
  const constrainToAspectRatio = (start, point, ratio) => {
    const x = clamp(point.x, 0, DOM.workCvs.width);
    const y = clamp(point.y, 0, DOM.workCvs.height);
    if (!ratio) return { x, y };
    const dx = x - start.x, dy = y - start.y;
    if (!dx || !dy) return { x, y };
    let width = Math.abs(dx), height = Math.abs(dy);
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    return {
      x: start.x + width * Math.sign(dx),
      y: start.y + height * Math.sign(dy)
    };
  };

  DOM.workContainer.onmousedown = e => {
    if (e.target.closest('#canvasControls')) return;
    
    const rect = DOM.workCvs.getBoundingClientRect();
    const scale = state.zoom.work / 100;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    // Right-click drag → pan regardless of current mode
    if (e.button === 2) {
      workDrag = { active: true, start: { x: e.clientX, y: e.clientY }, startPan: { ...state.pan.work } };
      state.dragging = 'work';
      DOM.workContainer.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
    if (state.mode === 'hand') {
      workDrag = { active: true, start: { x: e.clientX, y: e.clientY }, startPan: { ...state.pan.work } };
      state.dragging = 'work';
    } else if (state.mode === 'crop' || state.mode === 'select') {
      state.crop = { start: { x, y }, end: null, active: true, shift: e.shiftKey };
    }
    e.preventDefault();
  };

  document.addEventListener('mousemove', e => {
    // Pan work
    if (state.dragging === 'work' && workDrag.active) {
      state.pan.work = {
        x: workDrag.startPan.x + e.clientX - workDrag.start.x,
        y: workDrag.startPan.y + e.clientY - workDrag.start.y
      };
      applyWorkZoom();
    }
  });

  document.addEventListener('mouseup', () => {
    if (workDrag.active) DOM.workContainer.style.cursor = '';
    state.dragging = null;
    workDrag.active = false;
  });

  DOM.workContainer.onmousemove = e => {
    if ((state.mode !== 'crop' && state.mode !== 'select') || !state.crop.active) return;
    
    const rect = DOM.workCvs.getBoundingClientRect();
    const scale = state.zoom.work / 100;
    const point = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    const ratio = e.shiftKey ? 1 : state.aspectRatio;
    const end = constrainToAspectRatio(state.crop.start, point, ratio);
    state.crop.end = end;
    
    // Draw SVG overlay
    const containerRect = DOM.workContainer.getBoundingClientRect();
    const cvsRect = DOM.workCvs.getBoundingClientRect();
    const offsetX = cvsRect.left - containerRect.left;
    const offsetY = cvsRect.top - containerRect.top;
    const x1 = offsetX + Math.min(state.crop.start.x, end.x) * scale;
    const y1 = offsetY + Math.min(state.crop.start.y, end.y) * scale;
    const w = Math.abs(end.x - state.crop.start.x) * scale;
    const h = Math.abs(end.y - state.crop.start.y) * scale;
    const color = state.mode === 'crop' ? '#ef4444' : '#10b981';
    DOM.overlay.innerHTML = `<rect x="${x1}" y="${y1}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="10,5" filter="drop-shadow(0 0 2px rgba(0,0,0,0.5))"/>`;
  };

  DOM.workContainer.onmouseup = () => {
    if (!state.crop.active) return;
    if (!state.crop.end) {
      state.crop = { start: null, end: null, active: false };
      DOM.overlay.innerHTML = '';
      redrawCanvas();
      return;
    }
    
    const imgW = DOM.workCvs.width, imgH = DOM.workCvs.height;
    let x1 = Math.max(0, Math.min(imgW, Math.min(state.crop.start.x, state.crop.end.x)));
    let y1 = Math.max(0, Math.min(imgH, Math.min(state.crop.start.y, state.crop.end.y)));
    let x2 = Math.max(0, Math.min(imgW, Math.max(state.crop.start.x, state.crop.end.x)));
    let y2 = Math.max(0, Math.min(imgH, Math.max(state.crop.start.y, state.crop.end.y)));
    const w = Math.round(x2 - x1), h = Math.round(y2 - y1);
    
    if (w <= 10 || h <= 10) {
      state.crop = { start: null, end: null, active: false };
      DOM.overlay.innerHTML = '';
      redrawCanvas();
      return;
    }
    
    if (state.mode === 'crop') {
      state.crop.active = false;
      updateButtons();
    } else if (state.mode === 'select') {
      const newSel = { type: 'rect', x: Math.round(x1), y: Math.round(y1), w, h };
      if (state.addMode) {
        state.selections.push(newSel);
        state.currentSelection = null;
      } else {
        state.currentSelection = newSel;
      }
      state.crop = { start: null, end: null, active: false };
      DOM.overlay.innerHTML = '';
      DOM.fOnly.checked = false;
      redrawCanvas();
    }
  };

  DOM.workContainer.onclick = e => {
    if (e.target.closest('#canvasControls')) return;
    
    const rect = DOM.workCvs.getBoundingClientRect();
    const scale = state.zoom.work / 100;
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);
    
    if (state.mode === 'pick') {
      if (x >= 0 && x < DOM.workCvs.width && y >= 0 && y < DOM.workCvs.height) {
        const p = workCtx.getImageData(x, y, 1, 1).data;
        const hex = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        DOM.tColor.value = hex;
        DOM.rFrom.value = hex;
        updateColorValue(DOM.tColor, DOM.tColorValue);
        updateColorValue(DOM.rFrom, DOM.rFromValue);
      }
    } else if (state.mode === 'lasso') {
      state.lassoPoints.push({ x, y });
      if (state.lassoPoints.length >= 3 && !state.addMode) {
        state.currentSelection = { type: 'lasso', points: [...state.lassoPoints] };
      }
      DOM.fOnly.checked = false;
      redrawCanvas();
      updateOverlay();
      updateButtons();
    } else if (state.mode === 'magic') {
      const tolerance = +DOM.mTol.value; // Use magic wand's own tolerance
      const selection = floodFillSelect(x, y, tolerance);
      if (selection) {
        if (state.addMode) {
          state.selections.push(selection);
        } else {
          state.currentSelection = selection;
        }
        // Auto-check "transparent only" for fill tool if selecting transparent area
        if (state.historyIdx >= 0) {
          const imgData = state.history[state.historyIdx].data;
          const startIdx = (y * imgData.width + x) * 4;
          if (imgData.data[startIdx + 3] === 0) {
            DOM.fOnly.checked = true;
          } else {
            DOM.fOnly.checked = false;
          }
        }
        redrawCanvas();
      }
    }
  };

  // ===== Tool Controls
  const bindRangePair=(range,input,min,max,onChange=()=>{})=>{const sync=raw=>{const v=clamp(+raw||0,min,max);range.value=v;input.value=v;syncRangeFill(range);onChange(v);};range.oninput=()=>sync(range.value);input.oninput=()=>sync(input.value);input.onblur=()=>sync(input.value);sync(range.value);};
  const normalizeHex = raw => {
    const value = String(raw || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(value)) return '#' + [...value].map(x => x + x).join('').toLowerCase();
    if (/^[0-9a-f]{6}$/i.test(value)) return '#' + value.toLowerCase();
    return null;
  };
  const updateColorValue = (input, hexInput) => { hexInput.value = input.value.toUpperCase(); };
  const bindColor = (input, hexInput) => {
    const commitHex = () => {
      const normalized = normalizeHex(hexInput.value);
      if (normalized) input.value = normalized;
      updateColorValue(input, hexInput);
    };
    input.oninput = () => updateColorValue(input, hexInput);
    hexInput.onchange = commitHex;
    hexInput.onblur = commitHex;
    hexInput.onkeydown = e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      commitHex();
      hexInput.blur();
    };
    updateColorValue(input, hexInput);
  };
  bindColor(DOM.tColor,DOM.tColorValue);bindColor(DOM.rFrom,DOM.rFromValue);bindColor(DOM.rTo,DOM.rToValue);bindColor(DOM.fColor,DOM.fColorValue);bindRangePair(DOM.tTol,DOM.tTolVal,0,255);bindRangePair(DOM.rTol,DOM.rTolVal,0,255);bindRangePair(DOM.mTol,DOM.mTolVal,0,255);bindRangePair(DOM.mosSize,DOM.mosSizeVal,2,50);DOM.outW.oninput=()=>{const w=clamp(+DOM.outW.value||1,1,4096);DOM.outW.value=w;DOM.outH.value=Math.round(w/state.ratio);document.querySelectorAll('.size-preset').forEach(b=>b.classList.toggle('active',+b.dataset.width===w));};document.querySelectorAll('.size-preset').forEach(b=>b.onclick=()=>{const w=+b.dataset.width;DOM.outW.value=w;DOM.outH.value=Math.round(w/state.ratio);document.querySelectorAll('.size-preset').forEach(x=>x.classList.toggle('active',x===b));});$('sizeReset').onclick=()=>{DOM.outW.value=DOM.workCvs.width;DOM.outH.value=DOM.workCvs.height;document.querySelectorAll('.size-preset').forEach(b=>b.classList.remove('active'));};

  const aspectPresets = [...document.querySelectorAll('.aspect-preset')];
  const renderAspectOrientation = () => {
    const landscape = state.aspectOrientation === 'landscape';
    DOM.ratioLandscape.classList.toggle('active', landscape);
    DOM.ratioPortrait.classList.toggle('active', !landscape);
    DOM.ratioLandscape.setAttribute('aria-pressed', String(landscape));
    DOM.ratioPortrait.setAttribute('aria-pressed', String(!landscape));
  };
  const setAspectRatio = (ratio, mode = state.aspectMode) => {
    state.aspectMode = mode;
    state.aspectRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : null;
    aspectPresets.forEach(button => {
      const type = button.dataset.ratio;
      let active = type === state.aspectMode;
      if (state.aspectMode === 'preset' && type !== 'free' && type !== 'custom') {
        const base = +type;
        const value = state.aspectOrientation === 'portrait' ? 1 / base : base;
        active = Math.abs(value - state.aspectRatio) < 0.0001;
      }
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('.aspect-custom').hidden = state.aspectMode !== 'custom';
    document.querySelector('.aspect-orientation').hidden = state.aspectMode === 'free';
  };
  const setAspectOrientation = orientation => {
    state.aspectOrientation = orientation === 'portrait' ? 'portrait' : 'landscape';
    let width = clamp(+DOM.ratioWidth.value || 4, 0.1, 999);
    let height = clamp(+DOM.ratioHeight.value || 3, 0.1, 999);
    const shouldSwap = state.aspectOrientation === 'landscape' ? width < height : width > height;
    if (shouldSwap) [width, height] = [height, width];
    DOM.ratioWidth.value = width;
    DOM.ratioHeight.value = height;
    renderAspectOrientation();
    setAspectRatio(state.aspectMode === 'free' ? null : width / height, state.aspectMode);
  };
  const applyCustomAspectRatio = () => {
    if (state.aspectMode !== 'custom') return;
    const width = +DOM.ratioWidth.value;
    const height = +DOM.ratioHeight.value;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    state.aspectOrientation = width >= height ? 'landscape' : 'portrait';
    renderAspectOrientation();
    setAspectRatio(width / height, 'custom');
  };
  aspectPresets.forEach(button => button.onclick = () => {
    if (button.dataset.ratio === 'free') {
      setAspectRatio(null, 'free');
      return;
    }
    if (button.dataset.ratio === 'custom') {
      setAspectRatio(+DOM.ratioWidth.value / +DOM.ratioHeight.value, 'custom');
      applyCustomAspectRatio();
      return;
    }
    let [width, height] = button.textContent.trim().split(':').map(Number);
    if (state.aspectOrientation === 'portrait') [width, height] = [height, width];
    DOM.ratioWidth.value = width;
    DOM.ratioHeight.value = height;
    setAspectRatio(width / height, 'preset');
  });
  DOM.ratioLandscape.onclick = () => setAspectOrientation('landscape');
  DOM.ratioPortrait.onclick = () => setAspectOrientation('portrait');
  [DOM.ratioWidth, DOM.ratioHeight].forEach(input => {
    input.oninput = applyCustomAspectRatio;
    input.onblur = () => {
      const fallback = input === DOM.ratioWidth ? 4 : 3;
      input.value = clamp(+input.value || fallback, 0.1, 999);
      applyCustomAspectRatio();
    };
  });
  setAspectOrientation('landscape');
  setAspectRatio(null, 'free');

  // ===== Selection Masks =====
  const maskToSelection = mask => {
    const w=DOM.workCvs.width,h=DOM.workCvs.height;
    let count=0,minX=w,minY=h,maxX=-1,maxY=-1;
    for(let i=0;i<mask.length;i++)if(mask[i]>0){count++;const x=i%w,y=Math.floor(i/w);if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    if(!count)return null;
    const indices=new Int32Array(count);let p=0;
    for(let i=0;i<mask.length;i++)if(mask[i]>0)indices[p++]=i;
    const pixelSet={size:count,mask,has:index=>mask[index]>0,forEach:callback=>{for(let i=0;i<indices.length;i++)callback(indices[i]);}};
    return{type:'magic',x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,pixels:null,mask,pixelSet};
  };

  const createSelectionMask = () => {
    const allSels = state.currentSelection ? [...state.selections, state.currentSelection] : state.selections;
    if (allSels.length === 0) return null;
    const w = DOM.workCvs.width, h = DOM.workCvs.height;
    const mask = new Uint8Array(w * h);

    allSels.forEach(sel => {
      if (sel.mask) {
        for(let i=0;i<mask.length;i++)if(sel.mask[i]>mask[i])mask[i]=sel.mask[i];
        return;
      }
      if (sel.type === 'magic') {
        sel.pixelSet.forEach(index => { mask[index] = 255; });
        return;
      }

      const minX = Math.max(0, Math.floor(sel.type === 'lasso' ? Math.min(...sel.points.map(p => p.x)) : sel.x));
      const minY = Math.max(0, Math.floor(sel.type === 'lasso' ? Math.min(...sel.points.map(p => p.y)) : sel.y));
      const maxX = Math.min(w, Math.ceil(sel.type === 'lasso' ? Math.max(...sel.points.map(p => p.x)) + 1 : sel.x + sel.w));
      const maxY = Math.min(h, Math.ceil(sel.type === 'lasso' ? Math.max(...sel.points.map(p => p.y)) + 1 : sel.y + sel.h));

      if (sel.type === 'lasso') {
        for (let y = minY; y < maxY; y++) {
          for (let x = minX; x < maxX; x++) {
            if (pointInPolygon(x, y, sel.points)) mask[y * w + x] = 255;
          }
        }
      } else {
        for (let y = minY; y < maxY; y++) mask.fill(255, y * w + minX, y * w + maxX);
      }
    });
    return mask;
  };

  const adjustSelection = mode => {
    let mask=createSelectionMask();
    if(!mask)return;
    const w=DOM.workCvs.width,h=DOM.workCvs.height,amount=clamp(+DOM.selectionAmount.value||1,1,20);
    DOM.selectionAmount.value=amount;
    if(mode==='feather'){
      const temp=new Uint8Array(mask.length),out=new Uint8Array(mask.length),r=amount;
      for(let y=0;y<h;y++){
        let sum=0;
        for(let x=0;x<=Math.min(w-1,r);x++)sum+=mask[y*w+x];
        for(let x=0;x<w;x++){
          const left=x-r-1,right=x+r;
          if(left>=0)sum-=mask[y*w+left];
          if(right<w&&right>r)sum+=mask[y*w+right];
          const count=Math.min(w-1,x+r)-Math.max(0,x-r)+1;
          temp[y*w+x]=Math.round(sum/count);
        }
      }
      for(let x=0;x<w;x++){
        let sum=0;
        for(let y=0;y<=Math.min(h-1,r);y++)sum+=temp[y*w+x];
        for(let y=0;y<h;y++){
          const top=y-r-1,bottom=y+r;
          if(top>=0)sum-=temp[top*w+x];
          if(bottom<h&&bottom>r)sum+=temp[bottom*w+x];
          const count=Math.min(h-1,y+r)-Math.max(0,y-r)+1;
          out[y*w+x]=Math.round(sum/count);
        }
      }
      mask=out;
    }else{
      for(let step=0;step<amount;step++){
        const out=new Uint8Array(mask.length),expand=mode==='expand';
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          let value=expand?0:255;
          for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
            const nx=x+dx,ny=y+dy,inside=nx>=0&&nx<w&&ny>=0&&ny<h;
            if(expand&&inside&&mask[ny*w+nx]>0)value=255;
            if(!expand&&(!inside||mask[ny*w+nx]===0))value=0;
          }
          out[y*w+x]=value;
        }
        mask=out;
      }
    }
    const selection=maskToSelection(mask);
    state.selections=[];state.currentSelection=selection;state.lassoPoints=[];
    redrawCanvas();updateOverlay();updateButtons();
  };
  DOM.shrinkSelection.onclick=()=>adjustSelection('shrink');
  DOM.expandSelection.onclick=()=>adjustSelection('expand');
  DOM.featherSelection.onclick=()=>adjustSelection('feather');

  // ===== Apply Tools =====
  $('applyT').onclick = () => {
    const c = hex2rgb(DOM.tColor.value), tol = +DOM.tTol.value, all = DOM.tAll.checked;
    const img = cloneCurrentImageData();
    const selectionMask = createSelectionMask();
    let cnt = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const pixelIndex = i / 4;
      const weight=selectionMask?selectionMask[pixelIndex]/255:1;
      if (weight>0 && (all || colorDistSq(img.data, i, c) <= tol * tol)) {
        img.data[i + 3] = Math.round(img.data[i + 3]*(1-weight));
        cnt++;
      }
    }
    workCtx.putImageData(img, 0, 0);
    const selInfo = getSelectionCount();
    clearSelectionState();
    saveHistory('透過', `${all ? '全体' : DOM.tColor.value + ' 許容' + tol} → ${cnt}px${selInfo > 0 ? ` [${selInfo}選択]` : ''}`);
  };

  $('applyR').onclick = () => {
    const fc = hex2rgb(DOM.rFrom.value), tc = hex2rgb(DOM.rTo.value), tol = +DOM.rTol.value;
    const img = cloneCurrentImageData();
    const selectionMask = createSelectionMask();
    let cnt = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const pixelIndex = i / 4;
      const weight=selectionMask?selectionMask[pixelIndex]/255:1;
      if (weight>0 && img.data[i + 3] > 0 && colorDistSq(img.data, i, fc) <= tol * tol) {
        img.data[i] = Math.round(img.data[i]*(1-weight)+tc.r*weight); img.data[i + 1] = Math.round(img.data[i+1]*(1-weight)+tc.g*weight); img.data[i + 2] = Math.round(img.data[i+2]*(1-weight)+tc.b*weight);
        cnt++;
      }
    }
    workCtx.putImageData(img, 0, 0);
    clearSelectionState();
    saveHistory('色置換', `${DOM.rFrom.value}→${DOM.rTo.value} → ${cnt}px`);
  };

  $('applyF').onclick = () => {
    const c = hex2rgb(DOM.fColor.value), only = DOM.fOnly.checked;
    const img = cloneCurrentImageData();
    const selectionMask = createSelectionMask();
    let cnt = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const pixelIndex = i / 4;
      const weight=selectionMask?selectionMask[pixelIndex]/255:1;
      if (weight>0 && (only ? img.data[i + 3] === 0 : img.data[i + 3] > 0)) {
        img.data[i] = Math.round(img.data[i]*(1-weight)+c.r*weight); img.data[i + 1] = Math.round(img.data[i+1]*(1-weight)+c.g*weight); img.data[i + 2] = Math.round(img.data[i+2]*(1-weight)+c.b*weight);
        if (only) img.data[i + 3] = Math.round(255*weight);
        cnt++;
      }
    }
    workCtx.putImageData(img, 0, 0);
    clearSelectionState();
    saveHistory('塗りつぶし', `${DOM.fColor.value} ${only ? '透明のみ' : '不透明'} → ${cnt}px`);
  };

  // ===== Crop Confirm =====
  DOM.cropConfirm.onclick = e => {
    e.stopPropagation();
    if (!state.crop.start || !state.crop.end) return;
    
    const imgW = DOM.workCvs.width, imgH = DOM.workCvs.height;
    let x1 = Math.max(0, Math.min(imgW, Math.min(state.crop.start.x, state.crop.end.x)));
    let y1 = Math.max(0, Math.min(imgH, Math.min(state.crop.start.y, state.crop.end.y)));
    let x2 = Math.max(0, Math.min(imgW, Math.max(state.crop.start.x, state.crop.end.x)));
    let y2 = Math.max(0, Math.min(imgH, Math.max(state.crop.start.y, state.crop.end.y)));
    const x = Math.round(x1), y = Math.round(y1), w = Math.round(x2 - x1), h = Math.round(y2 - y1);
    
    if (w <= 0 || h <= 0) return;
    
    const srcData = state.history[state.historyIdx].data;
    const srcW = state.history[state.historyIdx].w;
    const newData = new ImageData(w, h);
    
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const srcIdx = ((y + py) * srcW + (x + px)) * 4;
        const dstIdx = (py * w + px) * 4;
        newData.data[dstIdx] = srcData.data[srcIdx];
        newData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
        newData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
        newData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
      }
    }
    
    DOM.workCvs.width = w;
    DOM.workCvs.height = h;
    workCtx.putImageData(newData, 0, 0);
    state.ratio = w / h;
    DOM.outW.value = w;
    DOM.outH.value = h;
    state.pan.work = { x: 0, y: 0 };
    fitWorkZoom();
    saveHistory('トリミング', `(${x},${y})→${w}×${h}`);
    
    state.crop = { start: null, end: null, active: false };
    DOM.overlay.innerHTML = '';
    updateButtons();
  };

  // ===== Transparent Margin Trim =====
  DOM.trimTransparent.onclick=()=>{
    if(state.historyIdx<0)return;
    const src=state.history[state.historyIdx].data,w=src.width,h=src.height,data=src.data;
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>0){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    if(maxX<0||minX===0&&minY===0&&maxX===w-1&&maxY===h-1)return;
    const nw=maxX-minX+1,nh=maxY-minY+1,out=new ImageData(nw,nh);
    for(let y=0;y<nh;y++){
      const start=((minY+y)*w+minX)*4,end=start+nw*4;
      out.data.set(data.subarray(start,end),y*nw*4);
    }
    DOM.workCvs.width=nw;DOM.workCvs.height=nh;workCtx.putImageData(out,0,0);
    state.ratio=nw/nh;DOM.outW.value=nw;DOM.outH.value=nh;state.pan.work={x:0,y:0};
    clearSelectionState({ clearOverlay: true });
    saveHistory('透明余白削除',`${w}×${h} → ${nw}×${nh}`);fitWorkZoom();updateButtons();
  };

  // ===== Lasso Buttons =====
  DOM.lassoConfirm.onclick = e => {
    e.stopPropagation();
    if (state.lassoPoints.length >= 3) {
      state.selections.push({ type: 'lasso', points: [...state.lassoPoints] });
      state.currentSelection = null;
      state.lassoPoints = [];
      updateOverlay();
      updateButtons();
      redrawCanvas();
    }
  };

  DOM.lassoClear.onclick = () => {
    clearSelectionState();
    redrawCanvas();
    updateOverlay();
    updateButtons();
  };
  // ===== Invert Selection =====
  $('invertSelection').onclick = () => {
    const source=createSelectionMask();
    if(!source)return;
    const inverted=new Uint8Array(source.length);
    for(let i=0;i<source.length;i++)inverted[i]=255-source[i];
    state.selections=[];
    state.currentSelection=maskToSelection(inverted);
    state.lassoPoints=[];
    redrawCanvas();updateOverlay();updateButtons();
  };

  // ===== Keyboard Shortcuts =====
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' &&
      state.mode === 'crop' &&
      !state.crop.active &&
      state.crop.start &&
      state.crop.end &&
      !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target?.tagName)) {
      e.preventDefault();
      DOM.cropConfirm.click();
      return;
    }

    if ((e.key === 'Control' || e.key === 'Meta') && !state.addMode) {
      state.addMode = true;
      if (state.currentSelection) {
        state.selections.push(state.currentSelection);
        state.currentSelection = null;
        redrawCanvas();
      }
      updateButtons();
      updateModeHint();
    }
    
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) {
        if (state.historyIdx < state.history.length - 1) goToHistory(state.historyIdx + 1);
      } else {
        if (state.historyIdx > 0) goToHistory(state.historyIdx - 1);
      }
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      if (state.historyIdx < state.history.length - 1) goToHistory(state.historyIdx + 1);
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'Control' || e.key === 'Meta') {
      state.addMode = e.ctrlKey || e.metaKey;
      updateButtons();
      updateModeHint();
    }
  });

  // ===== Reset & Export
  $('resetBtn').onclick=async()=>{if(!state.origImg)return;const ok=await confirmAction({title:'画像をリセットしますか？',message:'読み込み時の状態へ戻し、すべての編集内容と履歴を破棄します。',acceptLabel:'リセットする'});if(!ok)return;DOM.tColor.value='#ffffff';DOM.rFrom.value='#000000';DOM.rTo.value='#ff0000';DOM.fColor.value='#ff0000';DOM.tAll.checked=false;DOM.fOnly.checked=false;DOM.tTol.value=30;DOM.rTol.value=30;DOM.mTol.value=30;DOM.mosSize.value=10;DOM.selectionAmount.value=2;setAspectOrientation('landscape');setAspectRatio(null,'free');setMosaicEffect('blur');DOM.tTolVal.value=30;DOM.rTolVal.value=30;DOM.mTolVal.value=30;DOM.mosSizeVal.value=10;[DOM.tTol,DOM.rTol,DOM.mTol,DOM.mosSize].forEach(syncRangeFill);[[DOM.tColor,DOM.tColorValue],[DOM.rFrom,DOM.rFromValue],[DOM.rTo,DOM.rToValue],[DOM.fColor,DOM.fColorValue]].forEach(([i,o])=>updateColorValue(i,o));updateMosaicPreset(10);initEditor(state.origImg);};DOM.tTol.ondblclick=()=>{DOM.tTol.value=30;DOM.tTolVal.value=30;syncRangeFill(DOM.tTol);};DOM.rTol.ondblclick=()=>{DOM.rTol.value=30;DOM.rTolVal.value=30;syncRangeFill(DOM.rTol);};DOM.mTol.ondblclick=()=>{DOM.mTol.value=30;DOM.mTolVal.value=30;syncRangeFill(DOM.mTol);};

  // ===== Mosaic / Gaussian Blur Tool
  const mosSize=DOM.mosSize,mosSizeVal=DOM.mosSizeVal,presets=document.querySelectorAll('.mosaic-preset'),effectOptions=[...document.querySelectorAll('.effect-option')];
  let mosaicEffect='blur';
  const updateMosaicPreset=s=>presets.forEach(b=>b.classList.toggle('active',+b.dataset.size===s));
  const setMosaicEffect=effect=>{
    mosaicEffect=effect==='blur'?'blur':'pixel';
    effectOptions.forEach(b=>{const active=b.dataset.effect===mosaicEffect;b.classList.toggle('active',active);b.setAttribute('aria-checked',String(active));});
    $('mosSizeLabel').textContent=mosaicEffect==='blur'?'ぼかし強度':'サイズ';
    $('mosApplyLabel').textContent=mosaicEffect==='blur'?'ガウスぼかしを適用':'モザイクを適用';
  };
  effectOptions.forEach(b=>b.onclick=()=>setMosaicEffect(b.dataset.effect));
  mosSize.ondblclick=()=>{mosSize.value=10;mosSizeVal.value=10;syncRangeFill(mosSize);updateMosaicPreset(10);};
  presets.forEach(b=>b.onclick=()=>{const s=+b.dataset.size;mosSize.value=s;mosSizeVal.value=s;syncRangeFill(mosSize);updateMosaicPreset(s);});
  mosSize.addEventListener('input',()=>updateMosaicPreset(+mosSize.value));
  mosSizeVal.addEventListener('input',()=>{syncRangeFill(mosSize);updateMosaicPreset(+mosSizeVal.value);});
  updateMosaicPreset(+mosSize.value);
  setMosaicEffect('blur');
  $('applyMos').onclick=()=>{
    const s=+mosSize.value,w=DOM.workCvs.width,h=DOM.workCvs.height,mask=createSelectionMask();
    const info=getSelectionCount();
    let count=0;
    if(mosaicEffect==='blur'){
      const source=document.createElement('canvas'),blurred=document.createElement('canvas');
      source.width=blurred.width=w;source.height=blurred.height=h;
      source.getContext('2d').putImageData(state.history[state.historyIdx].data,0,0);
      const blurCtx=blurred.getContext('2d');
      blurCtx.filter=`blur(${s}px)`;
      blurCtx.drawImage(source,0,0);
      blurCtx.filter='none';
      if(mask){
        const result=cloneCurrentImageData();
        const blurData=blurCtx.getImageData(0,0,w,h).data;
        for(let p=0;p<mask.length;p++)if(mask[p]){const i=p*4,weight=mask[p]/255;result.data[i]=Math.round(result.data[i]*(1-weight)+blurData[i]*weight);result.data[i+1]=Math.round(result.data[i+1]*(1-weight)+blurData[i+1]*weight);result.data[i+2]=Math.round(result.data[i+2]*(1-weight)+blurData[i+2]*weight);result.data[i+3]=Math.round(result.data[i+3]*(1-weight)+blurData[i+3]*weight);count++;}
        workCtx.putImageData(result,0,0);
      }else{
        workCtx.clearRect(0,0,w,h);
        workCtx.drawImage(blurred,0,0);
        count=w*h;
      }
      saveHistory('ガウスぼかし',`${s}px → ${count}px${info?` [${info}選択]`:''}`);
    }else{
      const img=cloneCurrentImageData();
      for(let by=0;by<h;by+=s){const ey=Math.min(by+s,h);for(let bx=0;bx<w;bx+=s){const ex=Math.min(bx+s,w);let r=0,g=0,b=0,a=0,n=0;for(let y=by;y<ey;y++)for(let x=bx;x<ex;x++){const p=y*w+x;if(mask&&!mask[p])continue;const i=p*4;r+=img.data[i];g+=img.data[i+1];b+=img.data[i+2];a+=img.data[i+3];n++;}if(!n)continue;r=Math.round(r/n);g=Math.round(g/n);b=Math.round(b/n);a=Math.round(a/n);for(let y=by;y<ey;y++)for(let x=bx;x<ex;x++){const p=y*w+x;if(mask&&!mask[p])continue;const i=p*4,weight=mask?mask[p]/255:1;img.data[i]=Math.round(img.data[i]*(1-weight)+r*weight);img.data[i+1]=Math.round(img.data[i+1]*(1-weight)+g*weight);img.data[i+2]=Math.round(img.data[i+2]*(1-weight)+b*weight);img.data[i+3]=Math.round(img.data[i+3]*(1-weight)+a*weight);count++;}}}
      workCtx.putImageData(img,0,0);
      saveHistory('モザイク',`${s}px → ${count}px${info?` [${info}選択]`:''}`);
    }
    clearSelectionState();updateButtons();
  };

  // ===== Border and export
  const updateBorder=()=>{DOM.workCvs.style.boxShadow=state.showBorder?'0 0 0 2px rgba(100,100,100,.8)':'none';DOM.toggleBorder.checked=state.showBorder;};DOM.toggleBorder.onchange=()=>{state.showBorder=DOM.toggleBorder.checked;updateBorder();};
  const createOutputCanvas=()=>{const w=+DOM.outW.value,h=+DOM.outH.value,s=state.history[state.historyIdx],src=document.createElement('canvas'),out=document.createElement('canvas');src.width=s.w;src.height=s.h;src.getContext('2d').putImageData(s.data,0,0);out.width=w;out.height=h;const ctx=out.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(src,0,0,w,h);return out;};
  updateBorder();[DOM.tTol,DOM.rTol,DOM.mTol,DOM.mosSize].forEach(syncRangeFill);$('copyBtn').onclick=async()=>{const c=createOutputCanvas();try{const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)throw new Error('PNG generation failed');await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);const b=$('copyBtn'),old=b.innerHTML;b.innerHTML=`${svgIcon('check')}<span>コピーしました！</span>`;setTimeout(()=>b.innerHTML=old,2000);}catch(e){alert('クリップボードへのコピーに失敗しました');}};$('downloadBtn').onclick=async()=>{const c=createOutputCanvas();const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob){alert('PNGの生成に失敗しました');return;}const u=URL.createObjectURL(blob),a=document.createElement('a');a.download=(DOM.fileName.value.trim()||'edited')+'.png';a.href=u;a.click();setTimeout(()=>URL.revokeObjectURL(u),0);};setMode('pick');
})();