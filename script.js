// 初期化
lucide.createIcons();

// 状態管理
let images = [];
let cropper = null;
let currentEditIndex = null;
let currentPreviewIndex = null; // プレビュー中の画像インデックス
let isOpenCvReady = false;

// 赤枠・マスク設定
let redBoxes = []; // {x, y, w, h} (relative 0-1)
let redBoxConfig = {
  isMaskMode: true, // Default to true
  maskColor: '#ffffff'
};

// ★追加: トリミング時のアップスケール倍率 (2 -> 3)
const CROP_SCALE = 3;

// 要素取得
const els = {
  folderInput: document.getElementById('folderInput'),
  previewGrid: document.getElementById('previewGrid'),
  generateBtn: document.getElementById('generateBtn'),
  autoCropBtn: document.getElementById('autoCropBtn'),
  pickColorBtn: document.getElementById('pickColorBtn'),
  redBoxBtn: document.getElementById('redBoxBtn'),
  resetProcBtn: document.getElementById('resetProcBtn'),
  countDisplay: document.getElementById('countDisplay'),
  statusBar: document.getElementById('statusBar'),
  statusText: document.getElementById('statusText'),
  pdfPage: document.getElementById('pdfPage'),
  cropModal: document.getElementById('cropModal'),
  cropTarget: document.getElementById('cropTarget'),
  pickModal: document.getElementById('pickModal'),
  pickImage: document.getElementById('pickImage'),
  redBoxModal: document.getElementById('redBoxModal'),
  redBoxTargetImage: document.getElementById('redBoxTargetImage'),
  redBoxCanvas: document.getElementById('redBoxCanvas'),
  
  // スライダーパネル周り
  toggleSlidersBtn: document.getElementById('toggleSlidersBtn'),
  sliderPanel: document.getElementById('sliderPanel'),
  
  // プレビューモーダル用
  previewModal: document.getElementById('previewModal'),
  previewModalTitle: document.getElementById('previewModalTitle'),
  previewModalImage: document.getElementById('previewModalImage'),
  previewUndoBtn: document.getElementById('previewUndoBtn'),

  // 赤枠ツールバー
  maskModeCheck: document.getElementById('maskModeCheck'),
  maskColorInput: document.getElementById('maskColorInput'),
  rbX: document.getElementById('rbX'),
  rbY: document.getElementById('rbY'),
  rbW: document.getElementById('rbW'),
  rbH: document.getElementById('rbH'),
  
  // テーマ切り替え
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),

  // 設定
  pageSize: document.getElementById('pageSize'),
  orientation: document.getElementById('orientation'),
  imagesPerPage: document.getElementById('imagesPerPage'),
  margin: document.getElementById('margin'),
};

// OpenCV読み込み完了コールバック
// グローバルスコープに配置してHTML側から呼べるようにする
window.onOpenCvReady = function() {
  isOpenCvReady = true;
  console.log("OpenCV Ready");
  updateButtonStates();
};

function updateButtonStates() {
  const hasImages = images.length > 0;
  const ready = isOpenCvReady && hasImages;
  els.autoCropBtn.disabled = !ready;
  els.pickColorBtn.disabled = !ready;
  els.redBoxBtn.disabled = !hasImages; // 画像があれば枠設定は可能
  els.generateBtn.disabled = !hasImages;
  els.resetProcBtn.disabled = !hasImages;
}

// --- テーマ管理 ---
function initTheme() {
  // 保存されたテーマを確認
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
  updateThemeIcon();
}

function toggleTheme() {
  // 現在の状態を確認 (data-theme属性 or システム設定)
  const currentAttr = document.documentElement.getAttribute('data-theme');
  let isDark = false;
  
  if (currentAttr === 'dark') {
    isDark = true;
  } else if (currentAttr === 'light') {
    isDark = false;
  } else {
    // 属性なし = システム設定に従う
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // 切り替え
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  updateThemeIcon();
}

function updateThemeIcon() {
  const currentAttr = document.documentElement.getAttribute('data-theme');
  let isDark = false;
  
  if (currentAttr === 'dark') {
    isDark = true;
  } else if (currentAttr === 'light') {
    isDark = false;
  } else {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // アイコン切り替え
  const iconName = isDark ? 'sun' : 'moon';
  els.themeIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();
}

// 初期化実行
initTheme();
els.themeToggleBtn.onclick = toggleTheme;


// スライダーのトグル機能
els.toggleSlidersBtn.onclick = () => {
  els.sliderPanel.classList.toggle('hidden');
  els.toggleSlidersBtn.classList.toggle('active');
};

// --- デュアルスライダーのセットアップ ---
function setupDualSlider(id, minVal, maxVal, maxLimit) {
  const container = document.getElementById(id);
  const range = container.querySelector('.slider-range');
  const thumbMin = container.querySelector('.thumb-min');
  const thumbMax = container.querySelector('.thumb-max');
  const inputMin = container.querySelector('.input-min');
  const inputMax = container.querySelector('.input-max');
  const display = document.getElementById(id.replace('slider', 'val'));

  function update() {
    let v1 = parseInt(inputMin.value);
    let v2 = parseInt(inputMax.value);
    if (v1 > v2) { [v1, v2] = [v2, v1]; } 
    const p1 = (v1 / maxLimit) * 100;
    const p2 = (v2 / maxLimit) * 100;
    range.style.left = p1 + '%';
    range.style.width = (p2 - p1) + '%';
    thumbMin.style.left = p1 + '%';
    thumbMax.style.left = p2 + '%';
    display.textContent = `${v1} - ${v2}`;
  }
  inputMin.addEventListener('input', () => {
    if(parseInt(inputMin.value) > parseInt(inputMax.value)) inputMin.value = inputMax.value;
    update();
  });
  inputMax.addEventListener('input', () => {
    if(parseInt(inputMax.value) < parseInt(inputMin.value)) inputMax.value = inputMin.value;
    update();
  });
  container.setValues = (v1, v2) => {
    inputMin.value = v1; inputMax.value = v2; update();
  };
  update();
}

setupDualSlider('slider-h', 35, 90, 180);
setupDualSlider('slider-s', 40, 255, 255);
setupDualSlider('slider-v', 40, 255, 255);

function getHSVSettings() {
  const getVal = (id) => {
    const c = document.getElementById(id);
    return [parseInt(c.querySelector('.input-min').value), parseInt(c.querySelector('.input-max').value)];
  }
  const h = getVal('slider-h');
  const s = getVal('slider-s');
  const v = getVal('slider-v');
  return { lower: [h[0], s[0], v[0], 0], upper: [h[1], s[1], v[1], 0] };
}

// --- イベントリスナー ---
els.folderInput.addEventListener('change', async (e) => {
  await handleFiles(e.target.files);
  e.target.value = '';
});

// 全画面ドラッグ＆ドロップ
const dragEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
dragEvents.forEach(eventName => document.body.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false));
document.body.addEventListener('dragenter', () => document.body.classList.add('drag-over'));
document.body.addEventListener('dragover', () => document.body.classList.add('drag-over'));
document.body.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) document.body.classList.remove('drag-over'); });
document.body.addEventListener('drop', async (e) => {
  document.body.classList.remove('drag-over');
  const items = e.dataTransfer.items;
  let fileList = [];
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
      if (item) { await scanFiles(item, fileList); } 
      else { const file = items[i].getAsFile(); if (file && file.type.startsWith('image/')) fileList.push(file); }
    }
  } else {
    fileList = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  }
  await handleFiles(fileList);
});

async function scanFiles(item, fileList) {
  if (item.isFile) {
    return new Promise(resolve => item.file(file => {
      if (file.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(file.name)) fileList.push(file);
      resolve();
    }));
  } else if (item.isDirectory) {
    const dirReader = item.createReader();
    const entries = await readAllEntries(dirReader);
    for (const entry of entries) await scanFiles(entry, fileList);
  }
}
function readAllEntries(dirReader) {
  return new Promise(resolve => {
    let entries = [];
    const read = () => {
      dirReader.readEntries(result => {
        if (!result.length) resolve(entries);
        else { entries = entries.concat(result); read(); }
      });
    };
    read();
  });
}

['pageSize', 'orientation', 'imagesPerPage', 'margin'].forEach(id => els[id].addEventListener('change', updatePdfPreview));

els.autoCropBtn.onclick = runAutoCropForce;
els.pickColorBtn.onclick = () => { if(images.length > 0) openPickModal(images[0]); };
els.generateBtn.onclick = generateOutput; 
els.pickImage.onclick = (e) => handleColorPick(e.target, e.offsetX, e.offsetY, true);
els.redBoxBtn.onclick = openRedBoxEditor;

// 赤枠設定用イベント
els.maskModeCheck.addEventListener('change', (e) => {
  redBoxConfig.isMaskMode = e.target.checked;
  drawRedBoxesOnCanvas();
});
els.maskColorInput.addEventListener('input', (e) => {
  redBoxConfig.maskColor = e.target.value;
  if(redBoxConfig.isMaskMode) drawRedBoxesOnCanvas();
});


// キーイベント（Ctrl+Z）
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    if (els.redBoxModal.classList.contains('active')) {
      e.preventDefault();
      undoLastRedBox();
    }
  }
});

// モーダル外側（背景）クリックで閉じる
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay.id);
    }
  });
});

function undoLastRedBox() {
  if (redBoxes.length > 0) {
    redBoxes.pop();
    drawRedBoxesOnCanvas();
    updateInputsFromLastBox();
  }
}

// --- メインロジック ---
async function handleFiles(fileList) {
  if (fileList.length === 0) return;
  showStatus(true, '画像を読み込み中...');
  
  const newFiles = Array.from(fileList).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const file of newFiles) {
    const dataUrl = await readFile(file);
    images.push({
      file, name: file.name,
      dataUrl: dataUrl,
      croppedUrl: dataUrl, // トリミング後のベース画像
      originalUrl: dataUrl, // 完全なオリジナル
      isEdited: false,
      detectRect: null // 検出された矩形
    });
  }
  renderGrid();
  updatePdfPreview();
  updateButtonStates();
  
  if (isOpenCvReady) {
    if (images.length > 0) openPickModal(images[0]);
    else showStatus(false);
  } else {
    showStatus(true, '画像処理エンジン準備中...');
  }
}

function readFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function renderGrid() {
  els.countDisplay.textContent = `${images.length} 枚の画像`;
  const grid = els.previewGrid;
  
  // 画像がない場合：全画面Flex表示に切り替え
  if (images.length === 0) {
    grid.classList.add('is-empty');
    grid.innerHTML = `
      <div class="empty-state">
        <div class="drop-message" onclick="document.getElementById('folderInput').click()">
          <i data-lucide="image-plus" size="64" style="margin-bottom:16px; color:var(--text-sub);"></i>
          <p style="font-size: 16px; font-weight: 500; color: var(--text-sub);">
            フォルダごとここにドロップ<br>
            <span style="font-size: 13px; font-weight: 400; color: var(--text-sub);">またはクリックして選択</span>
          </p>
        </div>
      </div>`;
    updateButtonStates();
    lucide.createIcons();
    return;
  }
  
  // 画像がある場合：Grid表示に切り替え
  grid.classList.remove('is-empty');
  updateButtonStates();
  
  // グリッド生成（クリックでプレビューを開く）
  grid.innerHTML = images.map((img, i) => `
    <div class="preview-item" draggable="true" data-index="${i}" onclick="openPreviewModal(${i})">
      <div class="index">${i+1}</div>
      <div class="img-wrapper"><img src="${img.dataUrl}" data-index="${i}"></div>
      <div class="filename">${img.name}</div>
    </div>
  `).join('');
  lucide.createIcons();
  setupDragAndDrop();
}

// --- プレビューモーダル機能 ---
window.openPreviewModal = (index) => {
  currentPreviewIndex = index;
  const img = images[index];
  els.previewModalTitle.textContent = img.name;
  els.previewModalImage.src = img.dataUrl;
  
  // 「元に戻す」ボタンの表示制御
  els.previewUndoBtn.style.display = img.isEdited ? 'inline-flex' : 'none';
  
  els.previewModal.classList.add('active');
};

window.openManualCropFromPreview = () => {
  // プレビューモーダルを閉じてからトリミングモーダルを開く
  els.previewModal.classList.remove('active');
  setTimeout(() => {
      openManualCrop(currentPreviewIndex);
  }, 100);
};

window.undoEditFromPreview = async () => {
   await undoEdit(currentPreviewIndex);
   // プレビュー画像を更新
   els.previewModalImage.src = images[currentPreviewIndex].dataUrl;
   els.previewUndoBtn.style.display = 'none';
};

window.removeImageFromPreview = () => {
    // 削除実行
    removeImage(currentPreviewIndex);
    // モーダルを閉じる
    els.previewModal.classList.remove('active');
};


// --- 色指定・自動クロップ ---
function openPickModal(image) {
    els.pickImage.src = image.originalUrl;
    els.pickModal.classList.add('active');
    showStatus(false);
}
function closePickModalAndRun(shouldRunCrop) {
    els.pickModal.classList.remove('active');
    showStatus(true, '自動トリミング中...');
    setTimeout(() => { runAutoCrop(true); }, 100);
}

async function runAutoCrop(skipEdited = true) {
  if (!isOpenCvReady) return;
  const settings = getHSVSettings();
  for (let i = 0; i < images.length; i++) {
    if (skipEdited && images[i].isEdited) continue;
    const resultObj = await detectGreenBoard(images[i].originalUrl, settings);
    if (resultObj) {
      images[i].croppedUrl = resultObj.url; 
      images[i].dataUrl = resultObj.url;
      images[i].detectRect = resultObj.rect; // 矩形を保存
      images[i].isEdited = true;
    }
  }
  // 赤枠設定がある場合は適用
  if(redBoxes.length > 0) {
    await applyRedBoxesInternal();
  }
  
  renderGrid();
  updatePdfPreview();
  showStatus(false);
  
  // トリミング完了後、自動で赤枠エディタを開く
  if(images.length > 0 && !els.redBoxModal.classList.contains('active')) {
     openRedBoxEditor();
  }
}

async function runAutoCropForce() {
  if (!isOpenCvReady) return;
  showStatus(true, '全画像を再処理中...');
  await new Promise(r => setTimeout(r, 50));
  images.forEach(img => {
    img.dataUrl = img.originalUrl;
    img.croppedUrl = img.originalUrl;
    img.detectRect = null;
    img.isEdited = false;
  });
  await runAutoCrop(false); 
}

function detectGreenBoard(url, hsvRange) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = window.cv;
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let src = cv.imread(canvas);
        let hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);
        let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), hsvRange.lower);
        let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), hsvRange.upper);
        let mask = new cv.Mat();
        cv.inRange(hsv, low, high, mask);
        let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
        cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        let bestRect = null; let maxScore = 0;
        const minArea = (src.cols * src.rows) * 0.01;
        for (let i = 0; i < contours.size(); ++i) {
          let cnt = contours.get(i);
          let area = cv.contourArea(cnt);
          if (area < minArea) continue;
          let rect = cv.boundingRect(cnt);
          if (area > maxScore) { maxScore = area; bestRect = rect; }
        }
        let res = null;
        if (bestRect) {
          const cCanvas = document.createElement('canvas');
          // 修正: アップスケール適用 (CROP_SCALE)
          cCanvas.width = bestRect.width * CROP_SCALE; 
          cCanvas.height = bestRect.height * CROP_SCALE;
          const cCtx = cCanvas.getContext('2d');
          // 画質設定
          cCtx.imageSmoothingEnabled = true;
          cCtx.imageSmoothingQuality = 'high';
          cCtx.drawImage(img, bestRect.x, bestRect.y, bestRect.width, bestRect.height, 0, 0, cCanvas.width, cCanvas.height);
          res = { url: cCanvas.toDataURL('image/jpeg', 0.95), rect: bestRect };
        }
        src.delete(); hsv.delete(); mask.delete(); low.delete(); high.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
        resolve(res);
      } catch(e) { console.error(e); resolve(null); }
    };
    img.src = url;
  });
}

// --- 赤枠エディタ (Canvas更新ロジックの改善) ---
let isDrawingRedBox = false;
let startX, startY;

// リサイズ監視用オブザーバー
const redBoxResizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    if (entry.target === els.redBoxTargetImage) {
      // 画像サイズが変わったらCanvasも合わせる
      fitRedBoxCanvasToImage();
    }
  }
});

function fitRedBoxCanvasToImage() {
  const img = els.redBoxTargetImage;
  const canvas = els.redBoxCanvas;
  
  // 表示サイズが0なら何もしない
  if(img.clientWidth === 0 || img.clientHeight === 0) return;

  // キャンバスのサイズを表示サイズ（clientWidth/Height）に合わせる
  // これにより、座標計算を常に表示ピクセルベースで行える
  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  
  // スタイルも一致させる（念のため）
  canvas.style.width = img.clientWidth + 'px';
  canvas.style.height = img.clientHeight + 'px';
  
  drawRedBoxesOnCanvas();
}

function openRedBoxEditor() {
  if(images.length === 0) return;
  const targetImg = images[0];
  
  els.redBoxTargetImage.onload = () => {
    // 画像ロード後にリサイズ監視開始
    redBoxResizeObserver.observe(els.redBoxTargetImage);
    fitRedBoxCanvasToImage();
    updateInputsFromLastBox();
  };
  els.redBoxTargetImage.src = targetImg.croppedUrl; 
  els.redBoxModal.classList.add('active');
}

function initRedBoxCanvas() {
   // リサイズオブザーバーで管理するため、初期化処理は実質 fitRedBoxCanvasToImage に委譲
   // ここではイベントリスナーの登録のみ行う
   
   const canvas = els.redBoxCanvas;

  // イベントリスナー (Canvas上でのドラッグ)
  canvas.onmousedown = (e) => {
    isDrawingRedBox = true;
    const rect = canvas.getBoundingClientRect();
    // キャンバスの内部解像度と表示サイズが一致しているのでscaleは1
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  };

  canvas.onmousemove = (e) => {
    if(!isDrawingRedBox) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    drawRedBoxesOnCanvas(); // 既存描画
    
    // ドラッグ中の枠描画
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
    
    // 入力値もリアルタイム更新
    els.rbX.value = Math.round(Math.min(startX, currentX));
    els.rbY.value = Math.round(Math.min(startY, currentY));
    els.rbW.value = Math.round(Math.abs(currentX - startX));
    els.rbH.value = Math.round(Math.abs(currentY - startY));
  };

  canvas.onmouseup = (e) => {
    if(!isDrawingRedBox) return;
    isDrawingRedBox = false;
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    
    if(w > 5 && h > 5) {
      const box = {
        x: Math.min(startX, endX) / canvas.width,
        y: Math.min(startY, endY) / canvas.height,
        w: w / canvas.width,
        h: h / canvas.height
      };
      redBoxes.push(box);
    }
    drawRedBoxesOnCanvas();
    updateInputsFromLastBox();
  };
}

// 初回のみイベント登録
initRedBoxCanvas();


function updateInputsFromLastBox() {
  if(redBoxes.length > 0) {
    const last = redBoxes[redBoxes.length - 1];
    const w = els.redBoxCanvas.width;
    const h = els.redBoxCanvas.height;
    els.rbX.value = Math.round(last.x * w);
    els.rbY.value = Math.round(last.y * h);
    els.rbW.value = Math.round(last.w * w);
    els.rbH.value = Math.round(last.h * h);
  } else {
    els.rbX.value = 0; els.rbY.value = 0; els.rbW.value = 0; els.rbH.value = 0;
  }
}

// 手動入力値の反映
window.updateRedBoxFromInputs = () => {
  if(redBoxes.length === 0) {
     // 新規作成
     redBoxes.push({x:0, y:0, w:0, h:0}); 
  }
  const last = redBoxes[redBoxes.length - 1];
  const w = els.redBoxCanvas.width;
  const h = els.redBoxCanvas.height;
  
  const inputX = parseInt(els.rbX.value) || 0;
  const inputY = parseInt(els.rbY.value) || 0;
  const inputW = parseInt(els.rbW.value) || 0;
  const inputH = parseInt(els.rbH.value) || 0;

  last.x = inputX / w;
  last.y = inputY / h;
  last.w = inputW / w;
  last.h = inputH / h;

  drawRedBoxesOnCanvas();
};

function drawRedBoxesOnCanvas() {
  const canvas = els.redBoxCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // マスクモードのプレビュー
  if (redBoxConfig.isMaskMode) {
    ctx.fillStyle = redBoxConfig.maskColor + '80'; // 半透明でプレビュー
    // 全体を塗る
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 枠内を切り抜く（透明にする）
    ctx.globalCompositeOperation = 'destination-out';
    redBoxes.forEach(box => {
      ctx.fillRect(
        box.x * canvas.width,
        box.y * canvas.height,
        box.w * canvas.width,
        box.h * canvas.height
      );
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  // 枠線の描画 (常に表示して範囲をわかりやすく)
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 4;
  redBoxes.forEach(box => {
    ctx.strokeRect(
      box.x * canvas.width,
      box.y * canvas.height,
      box.w * canvas.width,
      box.h * canvas.height
    );
  });
}

function clearRedBoxes() {
  redBoxes = [];
  drawRedBoxesOnCanvas();
  updateInputsFromLastBox();
}

async function applyRedBoxesToAll() {
  showStatus(true, '枠設定を適用中...');
  redBoxResizeObserver.unobserve(els.redBoxTargetImage); // 監視停止
  await applyRedBoxesInternal();
  renderGrid();
  updatePdfPreview();
  closeModal('redBoxModal');
  showStatus(false);
}

// 内部処理用
async function applyRedBoxesInternal() {
  if(redBoxes.length === 0) return;

  for (let i = 0; i < images.length; i++) {
    const baseImgUrl = images[i].croppedUrl;
    const resultUrl = await drawRedBoxesOnImage(baseImgUrl);
    images[i].dataUrl = resultUrl;
  }
}

function drawRedBoxesOnImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      if (redBoxConfig.isMaskMode) {
         // マスクモード: 全体を塗りつぶし、枠内だけ画像を表示
         
         // 別キャンバスにマスクを作成
         const maskCanvas = document.createElement('canvas');
         maskCanvas.width = img.width;
         maskCanvas.height = img.height;
         const mCtx = maskCanvas.getContext('2d');
         
         // 指定色で塗りつぶし
         mCtx.fillStyle = redBoxConfig.maskColor;
         mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
         
         // 枠の部分を透明にくり抜く
         mCtx.globalCompositeOperation = 'destination-out';
         redBoxes.forEach(box => {
            mCtx.fillRect(
              box.x * canvas.width,
              box.y * canvas.height,
              box.w * canvas.width,
              box.h * canvas.height
            );
         });
         
         // 元画像の上にマスクを重ねる
         ctx.drawImage(maskCanvas, 0, 0);

      } else {
         // 通常モード: 赤枠線を描画
         ctx.strokeStyle = 'red';
         ctx.lineWidth = Math.max(3, img.width * 0.005); 
         redBoxes.forEach(box => {
           ctx.strokeRect(
             box.x * canvas.width,
             box.y * canvas.height,
             box.w * canvas.width,
             box.h * canvas.height
           );
         });
      }
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.src = url;
  });
}

// --- スポイト機能 ---
function handleColorPick(img, offsetX, offsetY, isModal) {
  const rect = img.getBoundingClientRect();
  const naturalRatio = img.naturalWidth / img.naturalHeight;
  const displayRatio = rect.width / rect.height;
  let drawW, drawH, startX, startY;
  if (naturalRatio > displayRatio) {
    drawW = rect.width; drawH = rect.width / naturalRatio;
    startX = 0; startY = (rect.height - drawH) / 2;
  } else {
    drawH = rect.height; drawW = rect.height * naturalRatio;
    startX = (rect.width - drawW) / 2; startY = 0;
  }
  let clickX = offsetX - startX; let clickY = offsetY - startY;
  if (clickX < 0 || clickX > drawW || clickY < 0 || clickY > drawH) return;
  const scale = img.naturalWidth / drawW;
  const srcX = clickX * scale; const srcY = clickY * scale;
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, srcX, srcY, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0,0,1,1).data;
  const hsv = rgbToHsv(r, g, b);
  
  // スポイトで取得した色をマスク色に設定
  const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  redBoxConfig.maskColor = hex;
  els.maskColorInput.value = hex;

  document.getElementById('slider-h').setValues(Math.max(0, hsv[0]-15), Math.min(180, hsv[0]+15));
  document.getElementById('slider-s').setValues(Math.max(0, hsv[1]-60), Math.min(255, hsv[1]+60));
  document.getElementById('slider-v').setValues(Math.max(0, hsv[2]-60), Math.min(255, hsv[2]+60));
  if (isModal) closePickModalAndRun(true);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  let d = max - min;
  s = max == 0 ? 0 : d / max;
  if (max == min) h = 0;
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 179), Math.round(s * 255), Math.round(v * 255)];
}

// --- 手動トリミングモーダル ---
function openManualCrop(index, e) {
  if(e) e.stopPropagation();
  currentEditIndex = index;
  
  // 前回のcropper破棄
  if (cropper) {
      cropper.destroy();
      cropper = null;
  }

  els.cropModal.classList.add('active');
  
  // 画像ロード後にCropper初期化
  els.cropTarget.onload = () => {
    const detectRect = images[index].detectRect;
    
    const options = {
      viewMode: 1,
      autoCropArea: 0.9,
      responsive: true,
      checkCrossOrigin: false,
      ready: function() {
        if (detectRect) {
          this.cropper.setData(detectRect);
        }
      }
    };
    
    cropper = new Cropper(els.cropTarget, options);
  };

  // 画像ソースを設定（onloadをトリガーするため最後に）
  els.cropTarget.src = images[index].originalUrl; 
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id === 'cropModal' && cropper) { cropper.destroy(); cropper = null; }
  if (id === 'redBoxModal') { redBoxResizeObserver.unobserve(els.redBoxTargetImage); } // 監視停止
}
async function applyManualCrop() {
  if (!cropper) return;
  
  const data = cropper.getData(); // 元画像ベースの切り抜き座標・サイズ
  
  // 修正: アップスケール後のサイズを整数で計算
  // Canvasのサイズは整数でないとぼやける原因になるためMath.roundを使用
  const targetWidth = Math.round(data.width * CROP_SCALE);
  const targetHeight = Math.round(data.height * CROP_SCALE);

  const canvas = cropper.getCroppedCanvas({
      width: targetWidth,
      height: targetHeight,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
  });
  
  const newUrl = canvas.toDataURL('image/jpeg', 0.95);
  images[currentEditIndex].croppedUrl = newUrl;
  
  // 赤枠があれば再適用
  if(redBoxes.length > 0) {
    images[currentEditIndex].dataUrl = await drawRedBoxesOnImage(newUrl);
  } else {
    images[currentEditIndex].dataUrl = newUrl;
  }
  
  images[currentEditIndex].isEdited = true;
  renderGrid();
  updatePdfPreview();
  closeModal('cropModal');
}

// --- 編集操作 ---
window.removeImage = (i, e) => { 
  if(e) e.stopPropagation(); 
  images.splice(i, 1); 
  renderGrid(); 
  updatePdfPreview(); 
};

window.undoEdit = async (i, e) => {
  if(e) e.stopPropagation();
  images[i].croppedUrl = images[i].originalUrl;
  images[i].detectRect = null; // 検出情報もリセット
  
  // 赤枠があれば再適用
  if(redBoxes.length > 0) {
    images[i].dataUrl = await drawRedBoxesOnImage(images[i].originalUrl);
  } else {
    images[i].dataUrl = images[i].originalUrl;
  }
  
  images[i].isEdited = false;
  renderGrid();
  updatePdfPreview();
};
window.clearAll = () => { images = []; redBoxes = []; renderGrid(); updatePdfPreview(); };

function resetAllProcessing() {
  // 状態を完全リセット
  images.forEach(img => {
    img.dataUrl = img.originalUrl;
    img.croppedUrl = img.originalUrl;
    img.detectRect = null;
    img.isEdited = false;
  });
  redBoxes = [];
  
  // 再描画
  renderGrid();
  updatePdfPreview();
  updateButtonStates();
}

// --- ドラッグ＆ドロップ並べ替え ---
let dragSrcEl = null;
function setupDragAndDrop() {
  const items = document.querySelectorAll('.preview-item');
  items.forEach(item => {
    item.addEventListener('dragstart', function(e) {
      this.classList.add('dragging');
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', function(e) { if (e.preventDefault) e.preventDefault(); return false; });
    item.addEventListener('drop', function(e) {
      e.stopPropagation();
      if (dragSrcEl !== this) {
        const srcIdx = parseInt(dragSrcEl.getAttribute('data-index'));
        const dstIdx = parseInt(this.getAttribute('data-index'));
        const [moved] = images.splice(srcIdx, 1);
        images.splice(dstIdx, 0, moved);
        renderGrid(); updatePdfPreview();
      }
      return false;
    });
    item.addEventListener('dragend', function() { this.classList.remove('dragging'); });
  });
}

// --- PDF生成関連 ---
function updatePdfPreview() {
  const orientation = els.orientation.value;
  const imagesPerPage = parseInt(els.imagesPerPage.value);
  const margin = parseInt(els.margin.value);
  els.pdfPage.className = `pdf-page-preview ${orientation}`;
  if (images.length === 0) { els.pdfPage.innerHTML = ''; return; }
  const cols = Math.ceil(Math.sqrt(imagesPerPage));
  const rows = Math.ceil(imagesPerPage / cols);
  let html = `<div class="pdf-grid-preview" style="grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr); padding:${margin/2}px">`;
  for (let i = 0; i < imagesPerPage; i++) {
    if (i < images.length) html += `<div class="pdf-cell-preview"><img src="${images[i].dataUrl}"></div>`;
    else html += `<div class="pdf-cell-preview"></div>`;
  }
  html += '</div>';
  els.pdfPage.innerHTML = html;
}

// --- 共通レンダリング関数 (Canvas生成) ---
// 指定ページの内容を描画したCanvasを返す
async function renderPageToCanvas(pageIndex, totalPages, config) {
  const { orientation, format, imagesPerPage, margin } = config;
  const widthMm = (format === 'a3' ? (orientation === 'portrait' ? 297 : 420) : (orientation === 'portrait' ? 210 : 297));
  const heightMm = (format === 'a3' ? (orientation === 'portrait' ? 420 : 297) : (orientation === 'portrait' ? 297 : 210));
  
  // 画質設定 (DPI相当)
  // 修正: 解像度を向上 (3 -> 5)
  const scale = 5; 
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(widthMm * scale);
  canvas.height = Math.floor(heightMm * scale);
  const ctx = canvas.getContext('2d');
  
  // 白背景
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const cols = Math.ceil(Math.sqrt(imagesPerPage));
  const rows = Math.ceil(imagesPerPage / cols);
  const cellW_mm = (widthMm - margin * 2) / cols;
  const cellH_mm = (heightMm - margin * 2) / rows;
  
  const startIdx = pageIndex * imagesPerPage;
  const endIdx = Math.min(startIdx + imagesPerPage, images.length);
  
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  // ベースフォントサイズ
  const baseFontSize = 8 * scale;
  
  // レイアウト調整用定数 (mm)
  const cellGap_mm = 4; // 画像周囲の隙間
  const textAreaH_mm = 8; // テキストエリア高さ
  
  for (let i = startIdx; i < endIdx; i++) {
    const posIndex = i - startIdx;
    const c = posIndex % cols;
    const r = Math.floor(posIndex / cols);
    
    const x_mm = margin + c * cellW_mm;
    const y_mm = margin + r * cellH_mm;
    
    // 画像が描画できる最大領域（隙間とテキストエリアを除く）
    const availableW_mm = cellW_mm - (cellGap_mm * 2);
    const availableH_mm = cellH_mm - textAreaH_mm - (cellGap_mm * 2);
    
    const imgData = images[i].dataUrl;
    const imgEl = await loadImage(imgData);
    
    const imgRatio = imgEl.width / imgEl.height;
    const areaRatio = availableW_mm / availableH_mm;
    
    let w_mm, h_mm;
    if (imgRatio > areaRatio) {
      w_mm = availableW_mm;
      h_mm = w_mm / imgRatio;
    } else {
      h_mm = availableH_mm;
      w_mm = h_mm * imgRatio;
    }
    
    // 中央配置（隙間分オフセット）
    const dx_mm = x_mm + cellGap_mm + (availableW_mm - w_mm) / 2;
    const dy_mm = y_mm + cellGap_mm + (availableH_mm - h_mm) / 2;
    
    // 画像描画
    ctx.drawImage(imgEl, dx_mm * scale, dy_mm * scale, w_mm * scale, h_mm * scale);
    
    // テキスト描画 (画像下4mm + ベースライン調整)
    const text = images[i].name;
    const tx_mm = dx_mm + w_mm / 2; // 画像中央
    const ty_mm = dy_mm + h_mm + 4 + 2; 
    
    // 修正: テキスト幅調整 (無理な長体ではなくフォントサイズ縮小で対応)
    const maxTextWidth = w_mm * scale;
    let currentFontSize = baseFontSize;
    
    // フォント設定：視認性の高い等幅フォント「Roboto Mono」を優先
    // 日本語はシステムフォント（Noto Sans JPなど）にフォールバック
    ctx.font = `500 ${currentFontSize}px 'Roboto Mono', 'Noto Sans JP', sans-serif`;
    
    const textMetrics = ctx.measureText(text);
    if (textMetrics.width > maxTextWidth) {
        // 幅に収まるように比率計算してフォントサイズを落とす
        const ratio = maxTextWidth / textMetrics.width;
        currentFontSize = Math.floor(baseFontSize * ratio);
        // 極端に小さくなりすぎないよう下限を設ける
        if (currentFontSize < 3 * scale) currentFontSize = 3 * scale;
        ctx.font = `500 ${currentFontSize}px 'Roboto Mono', 'Noto Sans JP', sans-serif`;
    }

    ctx.fillText(text, tx_mm * scale, ty_mm * scale);
  }
  
  return canvas;
}

// --- 出力生成メイン ---
async function generateOutput() {
  if (images.length === 0) return;
  
  const mode = document.querySelector('input[name="outputMode"]:checked').value;
  const isImageMode = (mode === 'image-file');
  const isRasterPdf = (mode === 'pdf-image');
  
  const loadingText = isImageMode ? '画像生成中...' : 'PDF生成中...';
  showStatus(true, loadingText);
  await new Promise(r => setTimeout(r, 100)); // UI更新待ち

  try {
    const orientation = els.orientation.value;
    const format = els.pageSize.value;
    const imagesPerPage = parseInt(els.imagesPerPage.value);
    const margin = parseInt(els.margin.value);
    const config = { orientation, format, imagesPerPage, margin };
    
    const totalPages = Math.ceil(images.length / imagesPerPage);

    if (isImageMode) {
      // --- 画像ファイル出力モード ---
      const zip = new JSZip();
      for (let p = 0; p < totalPages; p++) {
        const canvas = await renderPageToCanvas(p, totalPages, config);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        const fileName = `page_${p + 1}.jpg`;
        
        if (totalPages === 1) {
           saveAs(blob, fileName);
           showStatus(false);
           openCsvFlowModal();
           return;
        }
        zip.file(fileName, blob);
      }
      const content = await zip.generateAsync({type:"blob"});
      saveAs(content, "combined_images.zip");

    } else if (isRasterPdf) {
      // --- PDF (中身画像化) モード ---
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation, unit: 'mm', format });
      const widthMm = doc.internal.pageSize.getWidth();
      const heightMm = doc.internal.pageSize.getHeight();

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) doc.addPage();
        const canvas = await renderPageToCanvas(p, totalPages, config);
        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(imgDataUrl, 'JPEG', 0, 0, widthMm, heightMm, `PAGE_${p}`, 'FAST');
      }
      doc.save('combined_images.pdf');

    } else {
      // --- PDF (テキスト保持) モード ---
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation, unit: 'mm', format });
      const pW = doc.internal.pageSize.getWidth();
      const pH = doc.internal.pageSize.getHeight();
      const cols = Math.ceil(Math.sqrt(imagesPerPage));
      const rows = Math.ceil(imagesPerPage / cols);
      const cellW = (pW - margin * 2) / cols;
      const cellH = (pH - margin * 2) / rows;
      
      // レイアウト調整用定数 (mm)
      const cellGap = 4; // 画像周囲の隙間
      const textAreaH = 8; // テキストエリア高さ

      for (let i = 0; i < images.length; i++) {
        if (i > 0 && i % imagesPerPage === 0) doc.addPage();
        const imgData = images[i].dataUrl;
        const imgEl = await loadImage(imgData);
        const posIndex = i % imagesPerPage;
        const c = posIndex % cols;
        const r = Math.floor(posIndex / cols);
        const x = margin + c * cellW;
        const y = margin + r * cellH;
        
        // 画像が描画できる最大領域
        const availableW = cellW - (cellGap * 2);
        const availableH = cellH - textAreaH - (cellGap * 2);
        
        const imgRatio = imgEl.width / imgEl.height;
        const areaRatio = availableW / availableH;
        
        let w, h;
        if (imgRatio > areaRatio) {
           w = availableW;
           h = w / imgRatio;
        } else {
           h = availableH;
           w = h * imgRatio;
        }
        
        // 配置位置（余白分ずらす）
        const dx = x + cellGap + (availableW - w) / 2;
        const dy = y + cellGap + (availableH - h) / 2; 
        
        const safeAlias = (images[i].name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + i).substring(0, 50);
        doc.addImage(imgData, 'JPEG', dx, dy, w, h, safeAlias);
        
        // テキスト幅調整 (フォントサイズ縮小)
        let fontSize = 8;
        doc.setFontSize(fontSize);
        const text = images[i].name;
        
        // 幅が画像幅を超える場合は縮小 (最小4pt)
        while (doc.getTextWidth(text) > w && fontSize > 4) {
            fontSize -= 0.5;
            doc.setFontSize(fontSize);
        }

        // 画像中央に配置
        const tx = dx + w / 2 - doc.getTextWidth(text) / 2;
        const ty = dy + h + 4; // 画像下4mmに配置して被り防止
        
        doc.text(text, tx, ty);
      }
      doc.save('combined_images.pdf');
    }
    
    showStatus(false);
    openCsvFlowModal();
  } catch(e) { 
    console.error(e); 
    alert('保存エラー: ' + e.message); 
    showStatus(false); 
  }
}

function loadImage(src) { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; }); }
function showStatus(show, text = '') {
  if (show) { els.statusText.textContent = text; els.statusBar.classList.add('show'); }
  else { els.statusBar.classList.remove('show'); }
}
// ====================================================
// プロンプト管理 & CSV振分フロー
// ====================================================
const DEFAULT_PROMPT = `# 役割
工事写真（緑の黒板）のPDFから情報を正確に転記し、CSV化する専門アシスタント。

# 前提
- PDFは**画像化されたもの**（各ページが画像）
- 不要箇所はマスク済み、黒板の主要項目のみ可視
- 1ページに複数の黒板がある場合は**上から順に処理**

# 処理方法
- **画像の読み取りはPython禁止**（AIの視覚機能で直接読み取る）

---

# ステップ

## Step 1: 列の決定（1ページ目のみ）
1ページ目の黒板画像を目視で確認し、以下の候補から**存在する項目のみ**を列として採用：
- 工事件名 / 工種（棟名） / 施工階 / 施工部位 / 符号 / 位置 / 発注者 / 請負者

## Step 2: 各黒板の読み取り
各画像を**1枚ずつ目視で読み取り**：
1. 画像直下のファイル名（例：xxxxx.jpg）を取得 → \`filename\` 列へ
2. Step 1 で採用した列の値を抽出
   - **工種（棟名）**：括弧内の棟名部分のみ抽出

---

# 厳守ルール
- **推測禁止**：マスク箇所・読めない箇所は空欄
- **重複排除しない**：同一内容でも全件出力
- **ファイル名が不明**：\`filename\` を空欄
- **表記ゆれ正規化**：全角/半角統一、余白削除、記号統一のみ
- **誤字修正**：確信がある場合のみ

---

# 出力
CSVのみ出力。

---

# 処理開始
添付PDFを上記手順で処理してください。`;
const PROMPT_STORAGE_KEY = 'csvFlowPrompt';
function getPrompt() {
  return localStorage.getItem(PROMPT_STORAGE_KEY) || DEFAULT_PROMPT;
}
function savePrompt(text) {
  localStorage.setItem(PROMPT_STORAGE_KEY, text);
}
function resetPrompt() {
  localStorage.removeItem(PROMPT_STORAGE_KEY);
}
// フローモーダル要素
const csvFlowEls = {
  copyPromptBtn: document.getElementById('copyPromptBtn'),
  editPromptBtn: document.getElementById('editPromptBtn'),
  promptEditArea: document.getElementById('promptEditArea'),
  promptTextarea: document.getElementById('promptTextarea'),
  savePromptBtn: document.getElementById('savePromptBtn'),
  resetPromptBtn: document.getElementById('resetPromptBtn'),
};
// プロンプトコピー
csvFlowEls.copyPromptBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(getPrompt());
    const orig = csvFlowEls.copyPromptBtn.innerHTML;
    csvFlowEls.copyPromptBtn.innerHTML = '<i data-lucide="check" size="14"></i> コピー済み';
    lucide.createIcons();
    setTimeout(() => { csvFlowEls.copyPromptBtn.innerHTML = orig; lucide.createIcons(); }, 2000);
  } catch(e) { alert('コピーに失敗しました'); }
};
// 編集トグル
csvFlowEls.editPromptBtn.onclick = () => {
  const area = csvFlowEls.promptEditArea;
  const isHidden = area.classList.contains('hidden');
  if (isHidden) {
    csvFlowEls.promptTextarea.value = getPrompt();
    area.classList.remove('hidden');
    csvFlowEls.editPromptBtn.innerHTML = '<i data-lucide="x" size="14"></i> 閉じる';
  } else {
    area.classList.add('hidden');
    csvFlowEls.editPromptBtn.innerHTML = '<i data-lucide="pencil" size="14"></i> 編集';
  }
  lucide.createIcons();
};
// 保存
csvFlowEls.savePromptBtn.onclick = () => {
  savePrompt(csvFlowEls.promptTextarea.value);
  csvFlowEls.promptEditArea.classList.add('hidden');
  csvFlowEls.editPromptBtn.innerHTML = '<i data-lucide="pencil" size="14"></i> 編集';
  lucide.createIcons();
};
// デフォルトに戻す
csvFlowEls.resetPromptBtn.onclick = () => {
  resetPrompt();
  csvFlowEls.promptTextarea.value = DEFAULT_PROMPT;
};
// PDF/画像保存後にフローモーダルを開く
function openCsvFlowModal() {
  document.getElementById('csvFlowModal').classList.add('active');
  lucide.createIcons();
}
els.csvInput = document.getElementById('csvInput');
els.csvZipBtn = document.getElementById('csvZipBtn');
els.csvStatus = document.getElementById('csvStatus');
// CSV入力 & 画像有無でボタン有効化
function updateCsvBtnState() {
  if (!els.csvInput) return;
  const hasCSV = els.csvInput.value.trim().length > 0;
  const hasImages = images.length > 0;
  els.csvZipBtn.disabled = !(hasCSV && hasImages);
}
els.csvInput.addEventListener('input', updateCsvBtnState);
// 既存の updateButtonStates を拡張
const _origUpdateButtonStates = updateButtonStates;
updateButtonStates = function() {
  _origUpdateButtonStates();
  updateCsvBtnState();
};
els.csvZipBtn.onclick = generateCsvFolderZip;
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  });
  return { headers, rows };
}
async function generateCsvFolderZip() {
  const csvText = els.csvInput.value;
  const { headers, rows } = parseCSV(csvText);
  if (rows.length === 0 || headers.length < 2) {
    alert('CSVデータが不正です（ヘッダー + 1行以上必要）');
    return;
  }
  // 1列目をファイル名、2列目以降をフォルダ階層として使用
  const fnKey = headers[0];
  const folderKeys = headers.slice(1);
  showStatus(true, 'フォルダ振分ZIP生成中...');
  els.csvStatus.textContent = '';
  await new Promise(r => setTimeout(r, 50));
  const zip = new JSZip();
  const ROOT = '02.振分完了写真';
  let matched = 0;
  const unmatched = [];
  // 画像名 → dataUrl マップ
  const imgMap = {};
  images.forEach(img => { imgMap[img.name] = img.dataUrl; });
  for (const row of rows) {
    const fn = row[fnKey];
    if (!fn) continue;
    // 2列目以降の値をフォルダ階層に変換
    const folders = folderKeys.map(key => row[key] || '未分類');
    const folderPath = [ROOT, ...folders].join('/');
    if (imgMap[fn]) {
      const dataUrl = imgMap[fn];
      const base64 = dataUrl.split(',')[1];
      zip.file(folderPath + '/' + fn, base64, { base64: true });
      matched++;
    } else {
      unmatched.push(fn);
    }
  }
  if (matched === 0) {
    alert('CSVのファイル名と一致する画像が見つかりませんでした');
    showStatus(false);
    return;
  }
  try {
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, '02_振分完了写真.zip');
    let msg = `✅ ${matched}枚を振分完了（${folderKeys.join(' → ')}）`;
    if (unmatched.length > 0) {
      msg += ` / ⚠️ ${unmatched.length}枚が未一致`;
      console.warn('未一致ファイル:', unmatched);
    }
    els.csvStatus.textContent = msg;
  } catch (e) {
    console.error(e);
    alert('ZIP生成エラー: ' + e.message);
  }
  showStatus(false);
}