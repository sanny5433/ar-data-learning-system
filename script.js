import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDEkhWQ7d20DdBxH2FVcCZFfivFPTbKqH8",
    authDomain: "ar-data-learning-system.firebaseapp.com",
    projectId: "ar-data-learning-system",
    storageBucket: "ar-data-learning-system.firebasestorage.app",
    messagingSenderId: "260049723729",
    appId: "1:260049723729:web:b844bd5f8df23af25bf370"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function goToScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    ['1', '2', '3', 'mobile'].forEach(i => {
        const sceneEl = document.getElementById(i === 'mobile' ? 'ar-scene-mobile' : `ar-scene-${i}`);
        if (sceneEl && sceneEl.systems && sceneEl.systems["mindar-image-system"]) {
            try {
                sceneEl.systems["mindar-image-system"].stop();
            } catch (e) {}
        }
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
}

window.goToScreen = goToScreen;

let currentParticipantId = localStorage.getItem('ar_participantId') || "";
let sessionPrefix = localStorage.getItem('ar_sessionPrefix') || "";
let currentSessionId = localStorage.getItem('ar_sessionId') || "";
let taskStartTime = null;
let preTestScoreCache = 0;

let scannedCardsByTask = {
    task1: new Set(),
    task2: new Set(),
    task3: new Set()
};

let cardScanDetails = {}; 
let recordSaveCounts = { task1: 0, task2: 0, task3: 0 };

const requiredCards = {
    task1: ['T1-Card01', 'T1-Card02', 'T1-Card03', 'T1-Card04', 'T1-Card05'],
    task2: ['T2-Card01', 'T2-Card02', 'T2-Card03', 'T2-Card04', 'T2-Card05'],
    task3: ['T3-Card01', 'T3-Card02', 'T3-Card03', 'T3-Card04', 'T3-Card05']
};

function getParticipantDocId() {
    const s = sessionPrefix || localStorage.getItem('ar_sessionPrefix') || "default";
    const p = currentParticipantId || localStorage.getItem('ar_participantId') || "unknown";
    return `${s}_${p}`;
}

function getParticipantDocRef() {
    return doc(db, "participants", getParticipantDocId());
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSession = urlParams.get('session');
    const urlParticipant = urlParams.get('participant');
    const urlSessionId = urlParams.get('sessionId');
    const mode = urlParams.get('mode');

    if (urlSession && urlParticipant) {
        sessionPrefix = urlSession;
        currentParticipantId = urlParticipant;
        currentSessionId = urlSessionId || 'SESSION_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        localStorage.setItem('ar_sessionPrefix', sessionPrefix);
        localStorage.setItem('ar_participantId', currentParticipantId);
        localStorage.setItem('ar_sessionId', currentSessionId);

        if (mode === 'ar') {
            setTimeout(() => {
                startMobileAR(1);
            }, 400);
        }
    }
});

window.startSession = async function() {
    const sessionInput = document.getElementById('sessionInput').value.trim();
    const participantInput = document.getElementById('participantInput').value.trim();

    if (!sessionInput || !participantInput) {
        alert('請完整輸入「實驗場次」與「受試者編號」！');
        return;
    }

    sessionPrefix = sessionInput;
    currentParticipantId = participantInput;
    currentSessionId = 'SESSION_' + Math.random().toString(36).substring(2, 8).toUpperCase();

    localStorage.setItem('ar_sessionPrefix', sessionPrefix);
    localStorage.setItem('ar_participantId', currentParticipantId);
    localStorage.setItem('ar_sessionId', currentSessionId);

    const participantDocRef = getParticipantDocRef();

    try {
        const docSnap = await getDoc(participantDocRef);
        if (docSnap.exists()) {
            alert(`[防呆攔截] 實驗場次「 ${sessionPrefix} 」中已存在受試者編號「 ${currentParticipantId} 」的測驗紀錄！`);
            return;
        }
    } catch (error) {
        console.warn("⚠️ 雲端資料庫檢查略過：", error);
    }

    setDoc(participantDocRef, {
        participantId: currentParticipantId,
        sessionName: sessionPrefix,
        sessionId: currentSessionId,
        currentStage: "intro",
        startTime: serverTimestamp()
    }, { merge: true }).catch(err => console.error(err));

    const infoText = `實驗場次：<strong>${sessionPrefix}</strong> | 受試者編號：<strong>${currentParticipantId}</strong><br><br>` +
                     `您將在電腦上進行前測與學習，並於教學結束後使用手機進行 AR 實體卡片探索。請點擊下方按鈕開始前測。`;
    
    document.getElementById('session-info-text').innerHTML = infoText;
    goToScreen('screen-intro');
}

/* ======================================================
   【手機 WebAR 相機啟動與顯示】相關程式碼
   ====================================================== */

const mobileARSceneTemplate = `
<a-scene id="ar-scene-mobile" mindar-image="imageTargetSrc: ./targets.mind; autoStart: false; uiScanning: yes;" embedded color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
    <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
    <a-entity mindar-image-target="targetIndex: 0" id="mob-target-1-0"><a-plane color="#0984e3" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T1-Card01" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 1" id="mob-target-1-1"><a-plane color="#0984e3" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T1-Card02" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 2" id="mob-target-1-2"><a-plane color="#0984e3" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T1-Card03" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 3" id="mob-target-1-3"><a-plane color="#0984e3" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T1-Card04" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 4" id="mob-target-1-4"><a-plane color="#0984e3" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T1-Card05" color="white" align="center" position="0 0 0.1"></a-text></a-entity>

    <a-entity mindar-image-target="targetIndex: 5" id="mob-target-2-0"><a-plane color="#e17055" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T2-Card01" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 6" id="mob-target-2-1"><a-plane color="#e17055" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T2-Card02" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 7" id="mob-target-2-2"><a-plane color="#e17055" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T2-Card03" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 8" id="mob-target-2-3"><a-plane color="#e17055" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T2-Card04" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 9" id="mob-target-2-4"><a-plane color="#e17055" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T2-Card05" color="white" align="center" position="0 0 0.1"></a-text></a-entity>

    <a-entity mindar-image-target="targetIndex: 10" id="mob-target-3-0"><a-plane color="#00b894" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T3-Card01" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 11" id="mob-target-3-1"><a-plane color="#00b894" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T3-Card02" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 12" id="mob-target-3-2"><a-plane color="#00b894" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T3-Card03" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 13" id="mob-target-3-3"><a-plane color="#00b894" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T3-Card04" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
    <a-entity mindar-image-target="targetIndex: 14" id="mob-target-3-4"><a-plane color="#00b894" opacity="0.8" position="0 0 0" height="0.8" width="1"></a-plane><a-text value="T3-Card05" color="white" align="center" position="0 0 0.1"></a-text></a-entity>
</a-scene>
`;

let mobileARSceneReady = false;
let mobileARReadyFired = false;
let mobileARStartTimeoutId = null;

function attachMobileTargetListeners() {
    for (let i = 0; i < 15; i++) {
        const mobEl = document.getElementById(`mob-target-${Math.floor(i/5)+1}-${i%5}`);
        const taskId = i < 5 ? 'task1' : (i < 10 ? 'task2' : 'task3');
        const cardId = `${taskId.toUpperCase()}-Card0${(i%5)+1}`;

        if (mobEl && !mobEl.dataset.listenerAttached) {
            mobEl.dataset.listenerAttached = "true";
            mobEl.addEventListener("targetFound", () => {
                mobileARReadyFired = true;
                clearTimeout(mobileARStartTimeoutId);
                scanARCard(taskId, cardId, `偵測到 ${cardId}！`);
                document.getElementById('mobile-scan-status').innerHTML = `✅ 成功掃描並記錄：<strong>${cardId}</strong>`;
            });
        }
    }
}

function ensureMobileARScene() {
    if (mobileARSceneReady) return;
    const wrapper = document.getElementById('mobile-ar-wrapper');
    if (!wrapper) return;

    // 這時候 #screen-mobile-ar 已經是可見狀態，才把 a-scene 插入 DOM，
    // 避免在隱藏容器裡初始化導致相機畫面尺寸算錯。
    wrapper.innerHTML = mobileARSceneTemplate;
    mobileARSceneReady = true;

    const sceneEl = document.getElementById('ar-scene-mobile');
    if (sceneEl) {
        const onLoaded = () => {
            attachMobileTargetListeners();
            // 強制讓 A-Frame 重新計算畫面尺寸，避免殘留的 0x0 尺寸問題
            if (typeof sceneEl.resize === 'function') {
                try { sceneEl.resize(); } catch (e) {}
            }
        };

        if (sceneEl.hasLoaded) {
            onLoaded();
        } else {
            sceneEl.addEventListener('loaded', onLoaded);
        }

        // MindAR 真正啟動成功時會觸發 arReady，這裡才是「相機真的顯示出來了」的訊號
        sceneEl.addEventListener('arReady', () => {
            mobileARReadyFired = true;
            clearTimeout(mobileARStartTimeoutId);
            const statusEl = document.getElementById('mobile-scan-status');
            if (statusEl) statusEl.innerHTML = `📸 相機已啟動，請將鏡頭對準實體卡片`;
            if (typeof sceneEl.resize === 'function') {
                try { sceneEl.resize(); } catch (e) {}
            }
        });

        // MindAR 啟動失敗時會觸發 arError，把真正原因顯示出來
        sceneEl.addEventListener('arError', (evt) => {
            clearTimeout(mobileARStartTimeoutId);
            const statusEl = document.getElementById('mobile-scan-status');
            const triggerBox = document.getElementById('camera-trigger-box');
            const detail = (evt && evt.detail) ? JSON.stringify(evt.detail) : '未知錯誤';
            if (statusEl) statusEl.innerHTML = `⚠️ 相機啟動失敗（arError）：${detail}`;
            if (triggerBox) triggerBox.style.display = 'block';
        });
    }
}

window.startMobileAR = function(taskNum) {
    goToScreen('screen-mobile-ar');
    document.getElementById('mobile-task-badge').innerText = `📱 手機專屬 AR 掃描器 (Task ${taskNum})`;
    document.getElementById('mobile-scan-status').innerHTML = `📱 正在準備 Task ${taskNum} 鏡頭，請點擊下方橘色按鈕授權相機！`;

    // 等畫面真正切換為可見狀態之後，再建立 a-scene
    setTimeout(ensureMobileARScene, 100);
}

window.forceStartMobileCamera = function() {
    ensureMobileARScene();

    const triggerBox = document.getElementById('camera-trigger-box');
    const statusEl = document.getElementById('mobile-scan-status');

    if (triggerBox) triggerBox.style.display = 'none';
    if (statusEl) statusEl.innerHTML = `📸 正在請求相機權限，請稍候...`;

    const sceneEl = document.getElementById('ar-scene-mobile');

    function tryStartCamera() {
        try {
            if (!sceneEl || !sceneEl.systems || !sceneEl.systems["mindar-image-system"]) {
                if (statusEl) statusEl.innerHTML = `⚠️ 相機系統尚未準備完成，請稍等一下再點一次按鈕`;
                if (triggerBox) triggerBox.style.display = 'block';
                return;
            }

            if (statusEl) statusEl.innerHTML = `🔄 正在啟動相機，請稍候...`;
            const result = sceneEl.systems["mindar-image-system"].start();

            if (result && typeof result.catch === 'function') {
                result.catch(err => {
                    const msg = (err && err.message) ? err.message : String(err);
                    if (statusEl) statusEl.innerHTML = `⚠️ 相機啟動失敗：${msg}`;
                    if (triggerBox) triggerBox.style.display = 'block';
                });
            }

            // 如果過了 8 秒還沒收到 arReady（相機真的顯示出來）或掃到任何卡片，
            // 就顯示明確的診斷訊息，而不是讓畫面一直停在灰色沒有任何說明。
            mobileARReadyFired = false;
            clearTimeout(mobileARStartTimeoutId);
            mobileARStartTimeoutId = setTimeout(() => {
                if (!mobileARReadyFired && statusEl) {
                    statusEl.innerHTML = `⚠️ 相機已開啟，但畫面沒有反應。請確認 targets.mind 這個檔案是否存在（可在網址列直接打開「你的網址/targets.mind」測試看看能不能下載），或改用 Chrome 瀏覽器再試一次。`;
                    if (triggerBox) triggerBox.style.display = 'block';
                }
            }, 8000);

        } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            if (statusEl) statusEl.innerHTML = `⚠️ 相機啟動失敗：${msg}`;
            if (triggerBox) triggerBox.style.display = 'block';
        }
    }

    function afterSceneReady() {
        // 先實際檢查 targets.mind 是否真的抓得到，抓不到就直接告訴你，不用用猜的
        fetch('./targets.mind', { method: 'GET', cache: 'no-store' })
            .then(res => {
                if (!res.ok) {
                    if (statusEl) statusEl.innerHTML = `⚠️ 找不到 targets.mind 檔案（HTTP ${res.status}）。請確認這個檔案有上傳到跟 index.html 同一層目錄，檔名大小寫也要完全一致。`;
                    if (triggerBox) triggerBox.style.display = 'block';
                    return;
                }
                tryStartCamera();
            })
            .catch(err => {
                const msg = (err && err.message) ? err.message : String(err);
                if (statusEl) statusEl.innerHTML = `⚠️ 讀取 targets.mind 檔案時發生網路錯誤：${msg}`;
                if (triggerBox) triggerBox.style.display = 'block';
            });
    }

    if (sceneEl && !sceneEl.hasLoaded) {
        sceneEl.addEventListener('loaded', afterSceneReady, { once: true });
    } else {
        afterSceneReady();
    }
}

window.switchMobileTask = function(taskNum) {
    startMobileAR(taskNum);
}

// 【深度擴充版：教科書級別完整 10 頁詳細基礎教學】
const tutorialPages = [
    {
        title: "1. 什麼是關聯規則（Association Rules）？",
        content: `
            <p>關聯規則（Association Rules）是商用大數據分析、資料探勘（Data Mining）與商業智慧中極為核心且強大的分析方法，主要用來發掘不同商品、事件或消費者行為之間隱含的關聯性與規律。</p>
            <p>簡單來說，它就像是一位經驗豐富的超級店長，能夠自動從成千上萬筆雜亂無章的結帳明細中去抽絲剝繭，找出：<strong><span>「哪些商品或行為經常在同一個情境下頻繁一起出現？」</span></strong></p>
            <p>例如：當顧客在結帳時購買了吐司與麵包，是否也經常順便購買鮮奶？這種「同現關係」正是關聯分析最想幫企業找出的黃金規律。</p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #e9ecef;">
            <p><strong>生活中的經典情境舉例：</strong><br>假設一家社區便利商店在一天之內產生了以下幾筆基礎交易紀錄：</p>
            <ul style="text-align: left; display: inline-block; margin: 3px 0 6px 15px; line-height: 1.5;">
                <li><strong>交易 1：</strong> 麵包、牛奶</li>
                <li><strong>交易 2：</strong> 麵包、牛奶、香醇咖啡</li>
                <li><strong>交易 3：</strong> 麵包、香醇咖啡</li>
                <li><strong>交易 4：</strong> 牛奶、香醇咖啡</li>
                <li><strong>交易 5：</strong> 麵包、牛奶</li>
            </ul>
            <p>透過系統化的統計與觀察，我們很容易就能發現「麵包」與「牛奶」經常手牽手出現在同一筆交易單中。這種類型的規律，就是關聯規則最基礎也最重要的雛形。</p>
        `
    },
    {
        title: "2. 為什麼現代企業需要尋找「商品關聯」？",
        content: `
            <p>在當今競爭激烈的零售與電子商務環境中，每天產生的交易資料極為龐大且複雜，光靠傳統的人工肉眼或個人直覺，根本無法逐筆檢視並看出其中的潛在脈絡。</p>
            <p>如果一間連鎖超商一天有高達 <strong>10,000 筆交易</strong>，隱藏在背後的顧客消費習慣如果沒有透過數據工具挖掘，就會被白白浪費。透過科學化的關聯分析，企業能夠達成以下關鍵目標：</p>
            <ul style="text-align: left; display: inline-block; margin: 6px 0; line-height: 1.6;">
                <li><strong>精準掌握隱性需求</strong>：發現顧客自己可能都沒意識到的共同購買習慣。</li>
                <li><strong>優化賣場商品陳列</strong>：將高關聯的商品擺放在相近的貨架區域（如洋芋片旁擺啤酒），增加順手購買率。</li>
                <li><strong>規劃高效組合促銷</strong>：設計「超值特餐」或「買 A 送 B 優惠包」，有效帶動滯銷品的銷量。</li>
                <li><strong>提升整體營運效益</strong>：拉高效能客單價，替企業創造更高的商業價值。</li>
            </ul>
            <p><strong>因此請記住：</strong>關聯規則絕對不是單純去找出「誰賣得最好（熱門商品）」而已，而是要深入挖掘<strong><span>「商品與商品之間的深層動態關係」</span></strong>。</p>
        `
    },
    {
        title: "3. 核心指標一：支援度（Support）",
        content: `
            <p>在關聯規則分析中，第一個不可或缺的量化指標就是<strong>支援度（Support）</strong>。</p>
            <p>支援度是用來客觀衡量：<strong><span>某個特定的商品組合在全體交易資料中出現的頻率究竟有多高？</span></strong>它代表的是一種「宏觀的普及率」。</p>
            <p><strong>計算公式：</strong></p>
            <p style="background: #f8f9fa; padding: 8px; border-radius: 6px; font-family: monospace; text-align: center; font-weight: bold; color: #2c3e50;">支援度 ＝ 包含該商品組合的交易筆數 ÷ 總交易筆數</p>
            <p><strong>具體算術範例：</strong><br>假設全賣場總共有 <strong>100 筆交易</strong>，其中剛好有 <strong>20 筆交易</strong>同時購買了<strong><span>「麵包＋牛奶」</span></strong>，那麼這組商品的支援度計算方式為：<br><code>20 ÷ 100 ＝ 20%</code></p>
            <p>這代表在所有消費者的購物籃中，有 20% 的比例會同時裝著麵包和牛奶。</p>
            <p><strong>簡單理解心法：</strong>支援度數值越高 ➔ 代表這個商品組合在整個市場或賣場中越常集體出現，具備極高的普及與代表性。</p>
        `
    },
    {
        title: "4. 核心指標二：信心度（Confidence）",
        content: `
            <p>除了支援度之外，第二個關鍵指標就是<strong>信心度（Confidence）</strong>，它著重於「條件因果」的推論。</p>
            <p>信心度是用來衡量：<strong><span>當顧客已經購買了商品 A 的前提下，同時也購買商品 B 的「條件機率」有多高？</span></strong>它代表的是一種指向性的強弱。</p>
            <p><strong>計算公式：</strong></p>
            <p style="background: #f8f9fa; padding: 8px; border-radius: 6px; font-family: monospace; text-align: center; font-weight: bold; color: #2c3e50;">信心度 ＝ 同時包含 A 與 B 的交易筆數 ÷ 包含 A 的交易筆數</p>
            <p><strong>具體算術範例：</strong><br>假設在全部交易中，總共有 <strong>100 位顧客買了「麵包」</strong>，而在這 100 人之中，有 <strong>60 人同時也買了「牛奶」</strong>，那麼由麵包推導至牛奶的信心度計算方式為：<br><code>60 ÷ 100 ＝ 60%</code></p>
            <p>這代表購買麵包的客群中，有高達 60% 的人會順便把牛奶帶回家。</p>
            <p><strong>簡單理解心法：</strong>信心度數值越高 ➔ 代表商品 A 對商品 B 具有非常強大的連動帶動效果。</p>
        `
    },
    {
        title: "5. 深入解析：支援度與信心度的區別",
        content: `
            <p>許多初學者在剛接觸數據分析時，很容易將這兩個指標搞混。我們可以用簡單的表格與視角來幫大家釐清：</p>
            <table style="width:100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; text-align: left;">
                <tr style="background: #f1f2f6;"><th style="padding: 7px; border: 1px solid #dcdde1;">比較項目</th><th style="padding: 7px; border: 1px solid #dcdde1;">支援度 (Support)</th><th style="padding: 7px; border: 1px solid #dcdde1;">信心度 (Confidence)</th></tr>
                <tr><td style="padding: 7px; border: 1px solid #dcdde1;"><strong>核心思考視角</strong></td><td style="padding: 7px; border: 1px solid #dcdde1;">全體宏觀視角（全市場）</td><td style="padding: 7px; border: 1px solid #dcdde1;">條件因果視角（子集合）</td></tr>
                <tr><td style="padding: 7px; border: 1px solid #dcdde1;"><strong>想知道的問題</strong></td><td style="padding: 7px; border: 1px solid #dcdde1;">這個商品組合在全體有多常出現？</td><td style="padding: 7px; border: 1px solid #dcdde1;">買了 A 的人，有多少比例也買了 B？</td></tr>
            </table>
            <p style="margin-top: 8px;"><strong>可以這樣輕鬆記：</strong><br>• 支援度 ➔ 看的是<strong>「常見度與能見度」</strong>（全體有多大眾）。<br>• 信心度 ➔ 看的是<strong>「跟著買的強烈可能與因果」</strong>（A 發生時 B 發生的機率）。<br><br>在後續的實驗任務中，這兩個指標的計算與判斷將會是答題的核心關鍵！</p>
        `
    },
    {
        title: "6. 如何從原始資料中逐步找出關聯？",
        content: `
            <p>要從一堆零散的交易數據中萃取出有價值的商業關聯規則，通常需要依循一套標準的分析步驟：</p>
            <p><strong>第一步：匯集與整理交易資料</strong><br>將各個通路、不同時段的 POS 系統結帳明細、發票資料或會員消費日誌進行統整，確保每一筆交易包含哪些商品項目清清楚楚。</p>
            <p><strong>第二步：交叉比對與組合計算</strong><br>逐一統計各種商品組合（如「麵包＋牛奶」、「麵包＋咖啡」、「牛奶＋咖啡」）各自在所有交易中出現的次數與頻率。</p>
            <p><strong>第三步：計算指標並篩選規則</strong><br>運用前面學到的支援度與信心度公式進行量化計算，剔除隨機的雜訊，挑選出數值最高、最具商業參考價值的關聯規則作為後續行銷佈局的依據。</p>
        `
    },
    {
        title: "7. 數據不只是冷冰冰的數字：如何解讀？",
        content: `
            <p>在進行商業數據分析時，最忌諱的就是「只看到表面數字就直接下粗糙的結論」。舉個簡單的銷售排行榜為例：</p>
            <table style="width:100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; text-align: center;">
                <tr style="background: #f1f2f6;"><th style="padding: 5px; border: 1px solid #dcdde1;">商品代號</th><th style="padding: 5px; border: 1px solid #dcdde1;">當月總銷售量</th></tr>
                <tr><td style="padding: 5px; border: 1px solid #dcdde1;">商品 A</td><td style="padding: 5px; border: 1px solid #dcdde1;">100 件</td></tr>
                <tr><td style="padding: 5px; border: 1px solid #dcdde1;">商品 B</td><td style="padding: 5px; border: 1px solid #dcdde1;">80 件</td></tr>
                <tr><td style="padding: 5px; border: 1px solid #dcdde1;">商品 C</td><td style="padding: 5px; border: 1px solid #dcdde1;">150 件</td></tr>
            </table>
            <p>單從上表我們很容易看出「商品 C」的銷量最高。但如果我們身為管理者要做進一步的營運決策，光知道銷量還不夠，我們還必須深入探討以下問題：</p>
            <ul style="text-align: left; display: inline-block; margin: 4px 0 0 15px; line-height: 1.5;">
                <li>商品 C 是不是只有在特定促銷日才賣得好？平日表現如何？</li>
                <li>商品 C 是否經常與其他周邊商品一起被購買？</li>
                <li>目前的庫存水位是否足以應付即將到來的週末人潮？</li>
                <li>商品 C 近期的銷售趨勢是持續成長還是正在下滑？</li>
            </ul>
            <p style="margin-top: 8px;"><strong>核心觀念：</strong>真正的資料分析絕不只是「看數字的大小」，而是要從多維度的數據中抽絲剝繭，找出能真正輔助決策的實質洞察。</p>
        `
    },
    {
        title: "8. 什麼是資料導向決策（Data-Driven Decision Making）？",
        content: `
            <p><strong>資料導向決策（Data-Driven Decision Making）</strong>是指企業在面臨各項商業抉擇與營運調整時，徹底拋棄過去純粹依賴個人直覺、經驗猜測或主觀偏好的做法，改以<strong>客觀的量化數據、統計指標與趨勢預測</strong>作為決策的核心依據。</p>
            <p><strong>舉個生活中的對比情境：</strong><br>當便利商店主管要決定「本週到底該增加哪種商品的庫存？」時：</p>
            <p>• <strong>主管憑直覺：</strong><em>「我覺得最近天氣變涼了，大家應該會想買 A 商品，多進一點貨準沒錯！」</em> ➔ 這種做法屬於主觀猜測，存在高度庫存積壓風險。</p>
            <p>• <strong>主管看數據：</strong><em>「透過後台數據發現 A 商品最近三週銷售量持續成長 30%，且當前庫存僅剩 2 天安全存量，因此系統自動建議優先補貨。」</em> ➔ 這就是標準的客觀決策。</p>
            <p style="margin-top: 6px;">透過數據引導，能夠大幅降低因錯誤判斷而導致的資金卡住與營運虧損。</p>
        `
    },
    {
        title: "9. 資料導向決策的標準商業閉環流程",
        content: `
            <p>為了讓決策不再出錯，企業通常會建立一套標準的資料決策閉環流程：</p>
            <p style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-weight: bold; text-align: center; color: #2980b9; font-size: 14px;">
                資料蒐集 ➔ 數據分析 ➔ 發現規律 ➔ 商業判斷 ➔ 實際決策
            </p>
            <p><strong>我們用一個實務例子來對應：</strong><br>1. <strong>資料蒐集</strong>：匯集每日銷售與發票明細。<br>2. <strong>數據分析</strong>：計算各商品組合的支援度與銷售增長率。<br>3. <strong>發現規律</strong>：發現特定商品組合具有高達 80% 的強烈關聯。<br>4. <strong>商業判斷</strong>：判斷將兩者擺在相鄰貨架能有效提升客單價。<br>5. <strong>實際決策</strong>：調整實體陳列與備貨量。</p>
            <p style="margin-top: 8px; color: #e67e22; font-weight: bold;">這套思考邏輯會完美串聯你接下來在系統中所要執行的各項 AR 探索與實驗任務！</p>
        `
    },
    {
        title: "10. 學習總結：資料分析的終極心法",
        content: `
            <p>學習商用數據分析與 AR 互動系統，不一定要一開始就去學深奧難懂的高階程式碼或複雜數學模型。</p>
            <p>在日常的商業與職場環境中，最重要的是培養以下四個基本能力：</p>
            <ul style="text-align: left; display: inline-block; margin: 8px 0; line-height: 1.6;">
                <li><strong>看懂資料</strong>：能夠正確解讀報表與指標意義。</li>
                <li><strong>比較資料</strong>：懂得透過橫向與縱向對比看出差異。</li>
                <li><strong>找出規律</strong>：利用支援度與信心度找出隱藏的關聯。</li>
                <li><strong>做出決策</strong>：依據客觀證據提出合理的商業判斷。</li>
            </ul>
            <p style="margin-top: 12px; font-size: 16px; color: #2c3e50; text-align: center; font-weight: bold; background: #e8f8f0; padding: 10px; border-radius: 6px;">
                核心心法總結：資料 ➔ 比較 ➔ 找規律 ➔ 做決策
            </p>
            <p style="text-align: center; margin-top: 8px; color: #7f8c8d; font-size: 13px;">恭喜您完成所有詳細基礎教學！請點擊下方按鈕，準備進入手機 AR 實體卡片探索！</p>
        `
    }
];

let currentTutorialIndex = 0;
window.goToTutorial = function() {
    goToScreen('screen-tutorial');
    currentTutorialIndex = 0;
    renderTutorialPage();
    setDoc(getParticipantDocRef(), { currentStage: "tutorial" }, { merge: true }).catch(err => err);
}

function renderTutorialPage() {
    const page = tutorialPages[currentTutorialIndex];
    document.getElementById('tutorial-progress').innerText = `教學單元 ${currentTutorialIndex + 1} / ${tutorialPages.length}`;
    document.getElementById('tutorial-title').innerText = page.title;
    document.getElementById('tutorial-content').innerHTML = page.content;
    document.getElementById('tutorial-prev-btn').style.display = currentTutorialIndex === 0 ? "none" : "inline-block";
    document.getElementById('tutorial-next-btn').innerText = currentTutorialIndex === tutorialPages.length - 1 ? "完成教學：產生手機 AR 配對 QR Code" : "下一頁";
}

window.prevTutorialPage = function() { if (currentTutorialIndex > 0) { currentTutorialIndex--; renderTutorialPage(); } }

window.nextTutorialPage = function() {
    if (currentTutorialIndex < tutorialPages.length - 1) {
        currentTutorialIndex++;
        renderTutorialPage();
    } else {
        showARPairingScreen();
    }
}

function showARPairingScreen() {
    goToScreen('screen-ar-pairing');
    
    const baseUrl = window.location.origin + window.location.pathname;
    const pairingUrl = `${baseUrl}?session=${encodeURIComponent(sessionPrefix)}&participant=${encodeURIComponent(currentParticipantId)}&sessionId=${currentSessionId}&mode=ar`;

    const qrContainer = document.getElementById('qrcode-container');
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: pairingUrl,
        width: 160,
        height: 160,
        colorDark: "#2c3e50",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

window.scanARCard = function(taskId, cardId, cardDescription) {
    if (!scannedCardsByTask[taskId].has(cardId)) {
        scannedCardsByTask[taskId].add(cardId);
    }

    if (!cardScanDetails[cardId]) {
        cardScanDetails[cardId] = { scanCount: 0, firstScanTime: new Date().toISOString(), lastScanTime: null };
    }
    cardScanDetails[cardId].scanCount++;
    cardScanDetails[cardId].lastScanTime = new Date().toISOString();

    const scannedCount = scannedCardsByTask[taskId].size;
    const totalCount = requiredCards[taskId].length;

    const statusMsg = `📱 手機 AR 掃描狀態：${cardDescription} (已探索 ${scannedCount}/${totalCount} 張卡片)`;
    if (taskId === 'task1') document.getElementById('ar-scan-result-1').innerHTML = statusMsg;
    else if (taskId === 'task2') document.getElementById('ar-scan-result-2').innerHTML = statusMsg;
    else if (taskId === 'task3') document.getElementById('ar-scan-result-3').innerHTML = statusMsg;

    if (scannedCount === totalCount) {
        unlockTaskQuestions(taskId);
    }

    const basePath = getParticipantDocRef();
    const taskScanRef = doc(basePath, "arScans", taskId);
    setDoc(taskScanRef, {
        sessionId: currentSessionId || localStorage.getItem('ar_sessionId'),
        [cardId]: {
            scanCount: cardScanDetails[cardId].scanCount,
            firstScanTime: cardScanDetails[cardId].firstScanTime,
            lastScanTime: cardScanDetails[cardId].lastScanTime,
            updatedAt: new Date().toISOString()
        }
    }, { merge: true }).catch(err => console.error(err));
}

function unlockTaskQuestions(taskId) {
    const banner = document.getElementById(`${taskId}-lock-banner`);
    const area = document.getElementById(`${taskId}-questions-area`);
    if (banner && area) {
        banner.style.backgroundColor = "#27ae60";
        banner.innerHTML = "🔓 所有實體卡片已透過鏡頭全數掃描完畢！題目已解鎖。";
        area.style.opacity = "1";
        area.style.pointerEvents = "auto";
    }
}

window.saveTaskRecord = function(taskId) {
    if (recordSaveCounts[taskId] >= 3) {
        alert('⚠️ 每個任務的資料紀錄最多只能儲存 3 次！');
        return;
    }

    const textEl = document.getElementById(`${taskId}-record-text`);
    if (!textEl) return;
    const recordText = textEl.value.trim();
    if (!recordText) {
        alert('請先輸入一些資料紀錄再儲存！');
        return;
    }

    recordSaveCounts[taskId]++;
    const currentCount = recordSaveCounts[taskId];
    const recordId = `record_${currentCount}`;

    const basePath = getParticipantDocRef();
    const recordRef = doc(basePath, "records", taskId, "history", recordId);
    setDoc(recordRef, {
        recordId,
        recordText,
        savedSequence: currentCount,
        savedAt: serverTimestamp()
    }, { merge: true }).then(() => {
        alert(`💾 Task ${taskId.replace('task', '')} 第 ${currentCount} 次資料紀錄儲存成功！`);
    }).catch(err => console.error(err));
}

const task1Questions = [
    { qId: "t1_q1", q: "根據掃描的 5 張交易小卡，總共有幾位同學（幾筆交易）？", options: ["A. 3筆", "B. 4筆", "C. 5筆", "D. 6筆"], ans: "C" },
    { qId: "t1_q2", q: "在這 5 筆交易中，總共有幾筆交易包含「麵包」？", options: ["A. 2筆", "B. 3筆", "C. 4筆", "D. 5筆"], ans: "C" },
    { qId: "t1_q3", q: "在這 5 筆交易中，總共有幾筆交易同時包含「麵包」與「牛奶」？", options: ["A. 1筆", "B. 2筆", "C. 3筆", "D. 4筆"], ans: "C" },
    { qId: "t1_q4", q: "「麵包 ＋ 牛奶」同時出現的支援度（Support）計算公式為何？", options: ["A. 包含麵包牛奶的交易數 ÷ 總交易數", "B. 總交易數 ÷ 包含麵包牛奶數", "C. 只有麵包數 ÷ 總數", "D. 隨機猜測"], ans: "A" },
    { qId: "t1_q5", q: "根據上述資料與計算，「麵包 ＋ 牛奶」的支援度數值為多少？", options: ["A. 20%", "B. 40%", "C. 60%", "D. 80%"], ans: "C" }
];

window.startTask1 = function() {
    goToScreen('screen-task1');
    taskStartTime = Date.now();
    renderTaskQuestions('task1', task1Questions);
    setDoc(getParticipantDocRef(), { currentStage: "task1" }, { merge: true }).catch(err => err);
}

const task2Questions = [
    { qId: "t2_q1", q: "根據 Task 2 掃描的 5 張小卡，總共買了幾次「麵包」？", options: ["A. 2次", "B. 3次", "C. 4次", "D. 5次"], ans: "C" },
    { qId: "t2_q2", q: "在所有購買「麵包」的交易中，同時也購買「牛奶」的次數是多少？", options: ["A. 1次", "B. 2次", "C. 3次", "D. 4次"], ans: "C" },
    { qId: "t2_q3", q: "條件機率（信心度 Confidence：麵包 ➔ 牛奶）的正確計算方式為？", options: ["A. 買麵包又買牛奶 ÷ 買麵包總次數", "B. 買牛奶 ÷ 總次數", "C. 總次數 ÷ 買麵包", "D. 隨機"], ans: "A" },
    { qId: "t2_q4", q: "根據卡片資料，信心度（麵包 ➔ 牛奶）數值是多少？", options: ["A. 50%", "B. 60%", "C. 75%", "D. 100%"], ans: "C" },
    { qId: "t2_q5", q: "若信心度高達 75%，代表這兩項商品在實務商業上具有什麼意義？", options: ["A. 毫無關係", "B. 顧客買麵包時，有很高機率會順便買牛奶", "C. 應該馬上停售牛奶", "D. 兩者互斥"], ans: "B" }
];

window.startTask2 = function() {
    goToScreen('screen-task2');
    taskStartTime = Date.now();
    renderTaskQuestions('task2', task2Questions);
    setDoc(getParticipantDocRef(), { currentStage: "task2" }, { merge: true }).catch(err => err);
}

const task3Questions = [
    { qId: "t3_q1", q: "根據 Task 3 掃描的趨勢卡（Card 01），麵包與牛奶近期的銷售趨勢為何？", options: ["A. 持續下降", "B. 維持不變", "C. 持續成長", "D. 完全沒有人買"], ans: "C" },
    { qId: "t3_q2", q: "根據庫存卡（Card 03 與 04），目前麵包與牛奶的庫存狀態如何？", options: ["A. 非常充足", "B. 庫存偏低且有缺貨風險", "C. 庫存過多導致爆倉", "D. 沒有記錄"], ans: "B" },
    { qId: "t3_q3", q: "根據週末人潮預報卡（Card 05），預估本週末的客流量將有什麼變化？", options: ["A. 減少 50%", "B. 不變", "C. 增加 50%", "D. 店面休業"], ans: "C" },
    { qId: "t3_q4", q: "結合銷售趨勢、商品高關聯與低庫存數據，管理者最應採取何種行動？", options: ["A. 憑直覺減少進貨", "B. 根據數據優先增加麵包與牛奶的備貨量以迎接週末", "C. 隨機調漲價格", "D. 不作任何處理"], ans: "B" },
    { qId: "t3_q5", q: "下列何者最符合「資料導向決策（Data-Driven Decision Making）」的核心精神？", options: ["A. 依主管個人喜好決定", "B. 依據客觀數據與趨勢分析來做商業判斷", "C. 擲骰子決定", "D. 模仿競爭對手不管自家數據"], ans: "B" }
];

window.startTask3 = function() {
    goToScreen('screen-task3');
    taskStartTime = Date.now();
    renderTaskQuestions('task3', task3Questions);
    setDoc(getParticipantDocRef(), { currentStage: "task3" }, { merge: true }).catch(err => err);
}

function renderTaskQuestions(taskId, qList) {
    const container = document.getElementById(`${taskId}-q-list`);
    container.innerHTML = "";

    qList.forEach((qObj, idx) => {
        let html = `<div style="margin-bottom: 8px; border-bottom: 1px dashed #dcdde1; padding-bottom: 5px; text-align: left;">` +
                   `<p style="font-weight: bold; font-size: 12px; margin-bottom: 2px;">Q${idx + 1}. ${qObj.q}</p>`;
        qObj.options.forEach(opt => {
            const optLetter = opt.charAt(0);
            html += `<label style="display: block; font-size: 11px; margin-left: 8px; cursor: pointer;">` +
                    `<input type="radio" name="${taskId}-${qObj.qId}" value="${optLetter}"> ${opt}</label>`;
        });
        html += `</div>`;
        container.innerHTML += html;
    });
}

window.submitTaskQuestions = function(taskId) {
    let qList = taskId === 'task1' ? task1Questions : (taskId === 'task2' ? task2Questions : task3Questions);
    let allAnswered = true;
    let userAnswers = {};

    qList.forEach(qObj => {
        const selected = document.querySelector(`input[name="${taskId}-${qObj.qId}"]:checked`);
        if (!selected) allAnswered = false;
        else userAnswers[qObj.qId] = selected.value;
    });

    if (!allAnswered) {
        alert('請完整回答完本任務的所有 5 道題目再提交！');
        return;
    }

    const durationSec = parseFloat(((Date.now() - taskStartTime) / 1000).toFixed(2));
    let correctCount = 0;
    let answersObj = {};

    qList.forEach(qObj => {
        const userAns = userAnswers[qObj.qId];
        const isCorrect = userAns === qObj.ans;
        if (isCorrect) correctCount++;
        answersObj[qObj.qId] = { selectedAnswer: userAns, correctAnswer: qObj.ans, isCorrect: isCorrect };
    });

    const basePath = getParticipantDocRef();
    setDoc(doc(basePath, "taskAnswers", taskId), {
        taskId, answers: answersObj, correctCount, totalQuestions: qList.length, taskDurationSec: durationSec, submittedAt: serverTimestamp()
    }, { merge: true }).catch(err => console.error(err));

    setDoc(doc(basePath, "tasks", taskId), {
        taskId, isCompleted: true, correctCount, totalQuestions: qList.length, taskDurationSec: durationSec, completedAt: serverTimestamp()
    }, { merge: true }).catch(err => console.error(err));

    alert(`${taskId.toUpperCase()} 提交成功！答對 ${correctCount} / 5 題`);

    if (taskId === 'task1') startTask2();
    else if (taskId === 'task2') startTask3();
    else startPostTest();
}

const preTestQuestionsList = [
    { questionId: "pre_q1", question: "以下哪一項最能幫助我們客觀了解顧客的實際購買行為？", options: ["A. 店面牆壁的顏色", "B. 顧客的歷史購買紀錄與發票資料", "C. 員工制服的款式", "D. 店面距離捷運站的遠近"], correctAnswer: "B" },
    { questionId: "pre_q2", question: "當我們在分析店家一整天的銷售數據時，主要目的是為了什麼？", options: ["A. 隨便亂猜營業額", "B. 找出熱門時段與銷售規律，以優化人力與備貨", "C. 裝飾網頁版面", "D. 增加店租成本"], correctAnswer: "B" },
    { questionId: "pre_q3", question: "如果資料顯示『購買拿鐵咖啡的顧客中，有 78% 同時會購買培根三明治』，這代表什麼意義？", options: ["A. 這兩項商品毫無關係", "B. 這兩項商品具有強烈的共同購買關聯", "C. 顧客不喜歡吃三明治", "D. 拿鐵應該停售"], correctAnswer: "B" },
    { questionId: "pre_q4", question: "在進行商用數據分析與擬定行銷決策時，最核心的思考流程為何？", options: ["A. 憑個人直覺與喜好猜測", "B. 資料蒐集 ➔ 比較與發現規律 ➔ 資料導向決策", "C. 模仿競爭對手的招牌顏色", "D. 完全不管銷售數據直接決定庫存"], correctAnswer: "B" },
    { questionId: "pre_q5", question: "面對即將到來的週末人潮，管理者應該根據什麼來決定增加哪種商品的備貨量？", options: ["A. 當前庫存量與近期銷售量趨勢", "B. 管理員今天的心情", "C. 天氣晴雨隨機決定", "D. 進貨最貴的商品"], correctAnswer: "A" }
];
let currentPreTestIndex = 0;
let preTestUserAnswers = {};

window.goToPreTest = function() {
    goToScreen('screen-pretest');
    currentPreTestIndex = 0;
    preTestUserAnswers = {};
    setDoc(getParticipantDocRef(), { currentStage: "pretest" }, { merge: true }).catch(err => err);
    renderPreTestQuestion();
}

function renderPreTestQuestion() {
    if (preTestQuestionsList.length === 0) return;
    const q = preTestQuestionsList[currentPreTestIndex];
    document.getElementById('pretest-progress').innerText = `前測第 ${currentPreTestIndex + 1} 題 / 共 ${preTestQuestionsList.length} 題`;
    document.getElementById('pretest-question-title').innerText = q.question;
    const optionsContainer = document.getElementById('pretest-options');
    optionsContainer.innerHTML = "";

    q.options.forEach((opt) => {
        const optionLetter = opt.charAt(0);
        const savedAns = preTestUserAnswers[q.questionId] ? preTestUserAnswers[q.questionId].selectedAnswer : "";
        const isChecked = savedAns === optionLetter ? "checked" : "";
        const label = document.createElement('label');
        label.className = 'option-label';
        label.innerHTML = `<input type="radio" name="pretest-opt" value="${optionLetter}" ${isChecked}> ${opt}`;
        optionsContainer.appendChild(label);
    });

    document.getElementById('pretest-prev-btn').style.display = currentPreTestIndex === 0 ? "none" : "inline-block";
    document.getElementById('pretest-next-btn').innerText = currentPreTestIndex === preTestQuestionsList.length - 1 ? "提交前測" : "下一題";
}

function saveCurrentAnswerState() {
    const selected = document.querySelector('input[name="pretest-opt"]:checked');
    if (!selected) return;
    const q = preTestQuestionsList[currentPreTestIndex];
    const newAns = selected.value;
    if (!preTestUserAnswers[q.questionId]) {
        preTestUserAnswers[q.questionId] = { selectedAnswer: newAns, modifyCount: 0 };
    } else if (preTestUserAnswers[q.questionId].selectedAnswer !== newAns) {
        preTestUserAnswers[q.questionId].modifyCount += 1;
        preTestUserAnswers[q.questionId].selectedAnswer = newAns;
    }
}

window.prevPreTestQuestion = function() {
    saveCurrentAnswerState();
    if (currentPreTestIndex > 0) { currentPreTestIndex--; renderPreTestQuestion(); }
}

window.nextPreTestQuestion = function() {
    const selected = document.querySelector('input[name="pretest-opt"]:checked');
    if (!selected) { alert('請先選擇一個選項再繼續喔！'); return; }
    saveCurrentAnswerState();
    currentPreTestIndex++;
    if (currentPreTestIndex < preTestQuestionsList.length) {
        renderPreTestQuestion();
    } else {
        submitAllPreTestAnswers();
    }
}

function submitAllPreTestAnswers() {
    let score = 0;
    let correctCount = 0;
    let wrongItems = [];
    let answersObj = {};

    preTestQuestionsList.forEach((q, index) => {
        const ansData = preTestUserAnswers[q.questionId] || { selectedAnswer: "", modifyCount: 0 };
        const isCorrect = ansData.selectedAnswer === q.correctAnswer;
        if (isCorrect) { correctCount++; score += 20; }
        else { wrongItems.push({ displayNum: index + 1, question: q.question, selectedAnswer: ansData.selectedAnswer || "未作答", correctAnswer: q.correctAnswer }); }

        answersObj[q.questionId] = { selectedAnswer: ansData.selectedAnswer, correctAnswer: q.correctAnswer, isCorrect: isCorrect, modifyCount: ansData.modifyCount };
    });

    const basePath = getParticipantDocRef();
    setDoc(doc(basePath, "testAnswers", "preTest"), { answers: answersObj, submittedAt: serverTimestamp() }, { merge: true }).catch(err => console.error(err));

    preTestScoreCache = score;
    setDoc(basePath, { preTestScore: score, preTestCompleted: true, currentStage: "pretest_result" }, { merge: true }).catch(err => console.error(err));
    renderPreTestResult(score, correctCount, wrongItems);
}

function renderPreTestResult(score, correctCount, wrongItems) {
    goToScreen('screen-pretest-result');
    document.getElementById('pretest-score-summary').innerHTML = `本次前測共 5 題，答對 <strong>${correctCount}</strong> 題，答錯 <strong>${5 - correctCount}</strong> 題。<br>總成績：<strong style="color: #e74c3c; font-size: 26px;">${score} 分</strong>`;
    const reviewEl = document.getElementById('pretest-wrong-review');
    if (wrongItems.length === 0) {
        reviewEl.innerHTML = `<p style="color: #27ae60; font-weight: bold; text-align: center; padding: 20px;">太棒了！全部答對，沒有錯題！</p>`;
    } else {
        let html = `<h3 style="color: #c0392b; font-size: 16px; margin-bottom: 12px;">錯題詳解與正確答案：</h3><ul style="padding-left: 20px; line-height: 1.6; text-align: left;">`;
        wrongItems.forEach(item => {
            html += `<li style="margin-bottom: 12px;"><strong>[Q${item.displayNum}] ${item.question}</strong><br><span style="color: #c0392b;">你的選擇：${item.selectedAnswer}</span> | <span style="color: #27ae60; font-weight: bold;">正確答案：${item.correctAnswer}</span></li>`;
        });
        reviewEl.innerHTML = html + `</ul>`;
    }
}

const postTestQuestionsList = [
    { questionId: "post_q1", question: "在關聯規則分析中，『支援度 (Support)』主要用來衡量什麼？", options: ["A. 商品價格的高低", "B. 商品組合在全體交易中出現的頻率", "C. 顧客結帳的速度", "D. 店員補貨的次數"], correctAnswer: "B" },
    { questionId: "post_q2", question: "若商品 A ➔ 商品 B 的信心度 (Confidence) 很高，代表什麼意義？", options: ["A. 買 A 的顧客中，很高比例也會買 B", "B. 所有人都不買 B", "C. A 和 B 毫無關係", "D. B 的成本比 A 高"], correctAnswer: "A" },
    { questionId: "post_q3", question: "下列何者屬於『資料導向決策 (Data-Driven Decision Making)』的正確表現？", options: ["A. 憑個人直覺猜測熱銷商品", "B. 參考歷史銷售與庫存趨勢來安排補貨", "C. 隨機決定促銷品項", "D. 完全不管銷售數據"], correctAnswer: "B" },
    { questionId: "post_q4", question: "進行商用數據分析時，正確的思考與決策順序為何？", options: ["A. 決策 ➔ 猜測 ➔ 收集資料", "B. 資料 ➔ 分析 ➔ 發現 ➔ 判斷 ➔ 決策", "C. 完全不需要資料", "D. 隨機決定"], correctAnswer: "B" },
    { questionId: "post_q5", question: "如果分析發現『購買咖啡的顧客高達 80% 同時會購買點心』，管理者最適合採取什麼行動？", options: ["A. 將咖啡和點心放在完全不同的樓層", "B. 將咖啡與點心擺放在相近的陳列區以促進聯合銷售", "C. 馬上停售點心", "D. 調漲咖啡價格兩倍"], correctAnswer: "B" }
];

let currentPostTestIndex = 0;
let postTestUserAnswers = {};

window.startPostTest = function() {
    goToScreen('screen-posttest');
    currentPostTestIndex = 0;
    postTestUserAnswers = {};
    setDoc(getParticipantDocRef(), { currentStage: "posttest" }, { merge: true }).catch(err => err);
    renderPostTestQuestion();
}

function renderPostTestQuestion() {
    if (postTestQuestionsList.length === 0) return;
    const q = postTestQuestionsList[currentPostTestIndex];
    document.getElementById('posttest-progress').innerText = `後測第 ${currentPostTestIndex + 1} 題 / 共 ${postTestQuestionsList.length} 題`;
    document.getElementById('posttest-question-title').innerText = q.question;
    const optionsContainer = document.getElementById('posttest-options');
    optionsContainer.innerHTML = "";

    q.options.forEach((opt) => {
        const optionLetter = opt.charAt(0);
        const savedAns = postTestUserAnswers[q.questionId] ? postTestUserAnswers[q.questionId].selectedAnswer : "";
        const isChecked = savedAns === optionLetter ? "checked" : "";
        const label = document.createElement('label');
        label.className = 'option-label';
        label.innerHTML = `<input type="radio" name="posttest-opt" value="${optionLetter}" ${isChecked}> ${opt}`;
        optionsContainer.appendChild(label);
    });
    document.getElementById('posttest-next-btn').innerText = currentPostTestIndex === postTestQuestionsList.length - 1 ? "提交後測" : "下一題";
}

window.nextPostTestQuestion = function() {
    const selected = document.querySelector('input[name="posttest-opt"]:checked');
    if (!selected) { alert('請先選擇一個選項再繼續喔！'); return; }
    const q = postTestQuestionsList[currentPostTestIndex];
    postTestUserAnswers[q.questionId] = { selectedAnswer: selected.value };
    currentPostTestIndex++;
    if (currentPostTestIndex < postTestQuestionsList.length) {
        renderPostTestQuestion();
    } else {
        submitAllPostTestAnswers();
    }
}

function submitAllPostTestAnswers() {
    let score = 0;
    let correctCount = 0;
    let wrongItems = [];
    let answersObj = {};

    postTestQuestionsList.forEach((q, index) => {
        const userAns = postTestUserAnswers[q.questionId] ? postTestUserAnswers[q.questionId].selectedAnswer : "";
        const isCorrect = userAns === q.correctAnswer;
        if (isCorrect) { correctCount++; score += 20; }
        else { wrongItems.push({ displayNum: index + 1, question: q.question, selectedAnswer: userAns || "未作答", correctAnswer: q.correctAnswer }); }
        answersObj[q.questionId] = { selectedAnswer: userAns, correctAnswer: q.correctAnswer, isCorrect: isCorrect };
    });

    const basePath = getParticipantDocRef();
    setDoc(doc(basePath, "testAnswers", "postTest"), { answers: answersObj, submittedAt: serverTimestamp() }, { merge: true }).catch(err => console.error(err));

    const scoreGain = score - preTestScoreCache;
    setDoc(basePath, { postTestScore: score, scoreGain: scoreGain, postTestCompleted: true, currentStage: "posttest_result" }, { merge: true }).catch(err => console.error(err));

    renderPostTestResult(score, correctCount, wrongItems, scoreGain);
}

function renderPostTestResult(score, correctCount, wrongItems, scoreGain) {
    goToScreen('screen-posttest-result');
    document.getElementById('posttest-score-summary').innerHTML = `本次後測共 5 題，答對 <strong>${correctCount}</strong> 題，答錯 <strong>${5 - correctCount}</strong> 題。<br>後測成績：<strong style="color: #27ae60; font-size: 24px;">${score} 分</strong> | 前測成績：${preTestScoreCache} 分<br>學習進步幅度：<strong style="color: #2980b9; font-size: 22px;">+${scoreGain} 分</strong>`;
    const reviewEl = document.getElementById('posttest-wrong-review');
    if (wrongItems.length === 0) {
        reviewEl.innerHTML = `<p style="color: #27ae60; font-weight: bold; text-align: center; padding: 20px;">太棒了！後測全部答對，沒有錯題！</p>`;
    } else {
        let html = `<h3 style="color: #c0392b; font-size: 16px; margin-bottom: 12px;">後測錯題詳解與正確答案：</h3><ul style="padding-left: 20px; line-height: 1.6; text-align: left;">`;
        wrongItems.forEach(item => {
            html += `<li style="margin-bottom: 12px;"><strong>[Q${item.displayNum}] ${item.question}</strong><br><span style="color: #c0392b;">你的選擇：${item.selectedAnswer}</span> | <span style="color: #27ae60; font-weight: bold;">正確答案：${item.correctAnswer}</span></li>`;
        });
        reviewEl.innerHTML = html + `</ul>`;
    }
}

window.goToQuestionnaire = function() {
    goToScreen('screen-questionnaire');
    setDoc(getParticipantDocRef(), { currentStage: "questionnaire" }, { merge: true }).catch(err => err);
}

window.finishExperiment = function() {
    setDoc(getParticipantDocRef(), { currentStage: "completed", questionnaireCompletedByQR: true, endTime: serverTimestamp() }, { merge: true }).catch(err => console.error(err));
    goToScreen('screen-complete');
}

window.openAdminLogin = function() {
    document.getElementById('adminPassword').value = "";
    window._hamsterVerified = false;
    renderHamsterVerification();
    goToScreen('screen-admin-login');
}

const animalPool = ["🐱 貓咪", "🐶 狗狗", "🐹 倉鼠", "🐰 兔子", "🦊 狐狸", "🐼 熊貓", "🐨 無尾熊"];
function renderHamsterVerification() {
    const container = document.getElementById('hamster-options');
    container.innerHTML = "";
    let options = ["🐹 倉鼠"];
    while (options.length < 4) {
        const randomAnimal = animalPool[Math.floor(Math.random() * animalPool.length)];
        if (!options.includes(randomAnimal)) options.push(randomAnimal);
    }
    options.sort(() => Math.random() - 0.5);
    options.forEach(animal => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "secondary-btn";
        btn.style.padding = "8px 14px";
        btn.style.fontSize = "14px";
        btn.innerText = animal;
        btn.onclick = () => {
            if (animal === "🐹 倉鼠") {
                window._hamsterVerified = true;
                btn.style.backgroundColor = "#27ae60";
                btn.style.color = "white";
                btn.innerText = "✅ 驗證成功";
                container.querySelectorAll('button').forEach(b => b.disabled = true);
            } else {
                alert("❌ 驗證失敗，請選倉鼠！");
                renderHamsterVerification();
            }
        };
        container.appendChild(btn);
    });
}

window.verifyAdminLogin = async function() {
    const pwd = document.getElementById('adminPassword').value.trim();
    if (pwd !== "m1157111") { alert("❌ 管理者密碼錯誤！"); return; }
    if (!window._hamsterVerified) { alert("⚠️ 請先完成圖示安全驗證！"); return; }
    goToScreen('screen-admin-dashboard');
    await loadAdminDashboardData();
}

let cachedParticipantsMeta = [];
async function loadAdminDashboardData() {
    const statsEl = document.getElementById('admin-summary-stats');
    const tableContainer = document.getElementById('admin-participants-table-container');
    statsEl.innerHTML = "正在向雲端資料庫同步所有受試者資料...";
    tableContainer.innerHTML = "載入中...";

    try {
        cachedParticipantsMeta = [];
        const rootSnap = await getDocs(collection(db, "participants"));
        let totalPreScore = 0, totalPostScore = 0, totalGain = 0;

        for (const pDoc of rootSnap.docs) {
            const docId = pDoc.id;
            const pInfo = pDoc.data();
            const preScore = pInfo.preTestScore || 0;
            const postScore = pInfo.postTestScore || 0;
            const gain = pInfo.scoreGain || 0;
            totalPreScore += preScore; totalPostScore += postScore; totalGain += gain;

            cachedParticipantsMeta.push({
                session: pInfo.sessionName || "A",
                participantId: pInfo.participantId || docId,
                sessionId: pInfo.sessionId || "N/A",
                currentStage: pInfo.currentStage || "進行中",
                preTestScore: preScore,
                postTestScore: postScore,
                scoreGain: gain,
                questionnaireQR: pInfo.questionnaireCompletedByQR ? "已完成" : "未完成",
                docId: docId
            });
        }

        const totalParticipants = cachedParticipantsMeta.length;
        statsEl.innerHTML = `<strong>📈 實驗數據即時摘要：</strong><br>` +
                            `• 參與總人數：<strong>${totalParticipants}</strong> 人<br>` +
                            `• 平均前測成績：<strong>${totalParticipants ? (totalPreScore/totalParticipants).toFixed(1) : 0} 分</strong> | 平均後測成績：<strong>${totalParticipants ? (totalPostScore/totalParticipants).toFixed(1) : 0} 分</strong><br>` +
                            `• 平均進步幅度：<strong style="color: #27ae60;">+${totalParticipants ? (totalGain/totalParticipants).toFixed(1) : 0} 分</strong>`;

        if (totalParticipants === 0) {
            tableContainer.innerHTML = "<p style='text-align: center; color: #7f8c8d; padding: 20px;'>目前資料庫尚無任何受試者測驗紀錄。</p>";
            return;
        }

        let tableHtml = `<table style="width:100%; border-collapse: collapse; font-size: 12px; text-align: left;">` +
                        `<tr style="background: #f1f2f6;"><th style="padding: 6px; border: 1px solid #dcdde1;">場次</th>` +
                        `<th style="padding: 6px; border: 1px solid #dcdde1;">編號</th>` +
                        `<th style="padding: 6px; border: 1px solid #dcdde1;">目前進度</th>` +
                        `<th style="padding: 6px; border: 1px solid #dcdde1;">前測</th>` +
                        `<th style="padding: 6px; border: 1px solid #dcdde1;">後測</th>` +
                        `<th style="padding: 6px; border: 1px solid #dcdde1;">進步</th>` +
                        `<th style="padding: 6px; border: 1px solid #dcdde1;">問卷</th></tr>`;

        cachedParticipantsMeta.forEach(p => {
            tableHtml += `<tr>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1;">${p.session}</td>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1; font-weight: bold;">${p.participantId}</td>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1;">${p.currentStage}</td>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1;">${p.preTestScore}</td>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1;">${p.postTestScore}</td>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1; color: #27ae60; font-weight: bold;">+${p.scoreGain}</td>` +
                         `<td style="padding: 5px; border: 1px solid #dcdde1;">${p.questionnaireQR}</td>` +
                         `</tr>`;
        });
        tableContainer.innerHTML = tableHtml + `</table>`;
    } catch (error) {
        statsEl.innerHTML = "<span style='color: #c0392b;'>載入數據發生錯誤。</span>";
        tableContainer.innerHTML = "";
    }
}

window.exportDataToCSV = async function() {
    if (cachedParticipantsMeta.length === 0) await loadAdminDashboardData();
    if (cachedParticipantsMeta.length === 0) { alert("目前沒有可匯出的受試者數據！"); return; }

    let csvContent = "\uFEFF" + "實驗場次,受試者編號,Session代碼,目前進度,前測成績,後測成績,進步分數,問卷狀態\n";
    cachedParticipantsMeta.forEach(p => {
        csvContent += `"${p.session}","${p.participantId}","${p.sessionId}","${p.currentStage}",${p.preTestScore},${p.postTestScore},${p.scoreGain},"${p.questionnaireQR}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AR_Experiment_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
