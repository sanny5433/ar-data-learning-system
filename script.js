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

window.startMobileAR = function(taskNum) {
    goToScreen('screen-mobile-ar');
    document.getElementById('mobile-task-badge').innerText = `📱 手機專屬 AR 掃描器 (Task ${taskNum})`;
    document.getElementById('mobile-scan-status').innerHTML = `📱 正在準備 Task ${taskNum} 鏡頭，請點擊下方橘色按鈕授權相機！`;
}

window.forceStartMobileCamera = function() {
    const triggerBox = document.getElementById('camera-trigger-box');
    if (triggerBox) triggerBox.style.display = 'none';

    document.getElementById('mobile-scan-status').innerHTML = `📸 相機權限已獲取，正在掃描實體卡片...`;

    const sceneEl = document.getElementById('ar-scene-mobile');
    if (sceneEl && sceneEl.systems && sceneEl.systems["mindar-image-system"]) {
        try {
            sceneEl.systems["mindar-image-system"].start();
        } catch (e) {
            console.error("啟動相機失敗:", e);
        }
    }
}

window.switchMobileTask = function(taskNum) {
    startMobileAR(taskNum);
}

// 【完整 10 頁詳細基礎教學內容】
const tutorialPages = [
    {
        title: "1. 什麼是關聯規則（Association Rules）？",
        content: `
            <p>關聯規則是一種用來發掘不同商品、事件或行為之間關聯性的方法。</p>
            <p>簡單來說，就是從大量資料中找出：<strong><span>「哪些東西經常一起出現？」</span></strong></p>
            <p>例如：顧客購買麵包時，也經常購買牛奶。這時候我們可以進一步觀察兩種商品之間是否存在穩定的關聯。</p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #e9ecef;">
            <p><strong>生活中的例子：</strong><br>假設一家便利商店有很多筆交易：</p>
            <ul style="text-align: left; display: inline-block; margin: 3px 0 6px 15px; line-height: 1.4;">
                <li>交易 1：麵包、牛奶</li>
                <li>交易 2：麵包、牛奶、咖啡</li>
                <li>交易 3：麵包、咖啡</li>
                <li>交易 4：牛奶、咖啡</li>
                <li>交易 5：麵包、牛奶</li>
            </ul>
            <p>從這些交易中，我們可能發現麵包和牛奶經常一起出現。這就是關聯規則希望找出的商品之間的關聯模式。</p>
        `
    },
    {
        title: "2. 為什麼需要找「關聯」？",
        content: `
            <p>當資料量很大的時候，人很難一筆一筆查看所有交易。</p>
            <p>例如一間商店一天有 <strong>10,000 筆交易</strong>，如果只靠人工觀察，很難發現商品之間的隱藏關係。</p>
            <p>因此可以透過資料分析找出：</p>
            <ul style="text-align: left; display: inline-block; margin: 6px 0; line-height: 1.5;">
                <li>哪些商品常一起購買？</li>
                <li>哪些商品可能具有關聯？</li>
                <li>哪些商品可以一起促銷？</li>
                <li>哪些商品適合放在相近的位置？</li>
            </ul>
            <p><strong>所以：</strong>關聯規則不是單純找出「熱門商品」，而是找出<strong><span>「商品之間的關係」</span></strong>。</p>
        `
    },
    {
        title: "3. 支援度（Support）",
        content: `
            <p>支援度可以用來了解：<strong><span>某個商品組合在全部交易中出現得有多頻繁。</span></strong></p>
            <p>例如總共有 100 筆交易，其中有 20 筆同時購買<strong><span>「麵包＋牛奶」</span></strong>：</p>
            <p style="background: #f8f9fa; padding: 8px; border-radius: 6px; font-family: monospace; text-align: center;">支援度 = 20 ÷ 100 = 20%</p>
            <p>代表：所有交易中，有 20% 同時出現麵包和牛奶。</p>
            <p><strong>簡單理解：</strong>支援度越高 ➔ 這個商品組合越常出現。</p>
        `
    },
    {
        title: "4. 信心度（Confidence）",
        content: `
            <p>信心度則是用來了解：<strong><span>當顧客購買商品 A 時，同時購買商品 B 的可能性有多高。</span></strong></p>
            <p>例如 100 位購買麵包的顧客中，有 60 人也購買牛奶：</p>
            <p style="background: #f8f9fa; padding: 8px; border-radius: 6px; font-family: monospace; text-align: center;">信心度 = 60 ÷ 100 = 60%</p>
            <p>意思是：購買麵包的顧客中，有 60% 同時購買牛奶。</p>
            <p><strong>簡單理解：</strong>信心度越高 ➔ A 出現時，B 也出現的可能性越高。</p>
        `
    },
    {
        title: "5. 支援度和信心度有什麼不同？",
        content: `
            <p>這裡可以特別讓學生理解，因為之後你的任務可能會用到。</p>
            <table style="width:100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; text-align: left;">
                <tr style="background: #f1f2f6;"><th style="padding: 6px; border: 1px solid #dcdde1;">指標</th><th style="padding: 6px; border: 1px solid #dcdde1;">想知道什麼？</th></tr>
                <tr><td style="padding: 6px; border: 1px solid #dcdde1;"><strong>支援度</strong></td><td style="padding: 6px; border: 1px solid #dcdde1;">這個組合有多常出現？</td></tr>
                <tr><td style="padding: 6px; border: 1px solid #dcdde1;"><strong>信心度</strong></td><td style="padding: 6px; border: 1px solid #dcdde1;">買 A 的人，有多少也買 B？</td></tr>
            </table>
            <p style="margin-top: 6px;"><strong>可以簡單記成：</strong><br>支援度 ➔ 看「常不常見」<br>信心度 ➔ 看「跟著買的可能性」</p>
        `
    },
    {
        title: "6. 如何從資料中找出關聯？",
        content: `
            <p>進行資料分析時，可以先觀察：</p>
            <p><strong>第一步：整理交易資料</strong>（例如記錄交易各自買了什麼）。</p>
            <p><strong>第二步：比較商品組合</strong>（觀察麵包＋牛奶、麵包＋咖啡、牛奶＋咖啡各出現幾次）。</p>
            <p><strong>第三步：找出可能的關聯</strong>（再利用支援度、信心度等指標判斷哪些關聯比較值得注意）。</p>
        `
    },
    {
        title: "7. 資料不只是「數字」",
        content: `
            <p>進行數據分析時，不能只看到數字就直接下結論。</p>
            <table style="width:100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; text-align: center;">
                <tr style="background: #f1f2f6;"><th style="padding: 5px; border: 1px solid #dcdde1;">商品</th><th style="padding: 5px; border: 1px solid #dcdde1;">銷售量</th></tr>
                <tr><td style="padding: 5px; border: 1px solid #dcdde1;">A</td><td style="padding: 5px; border: 1px solid #dcdde1;">100</td></tr>
                <tr><td style="padding: 5px; border: 1px solid #dcdde1;">B</td><td style="padding: 5px; border: 1px solid #dcdde1;">80</td></tr>
                <tr><td style="padding: 5px; border: 1px solid #dcdde1;">C</td><td style="padding: 5px; border: 1px solid #dcdde1;">150</td></tr>
            </table>
            <p>我們可以知道 C 的銷售量最高。但如果要做決策，還可以進一步問：</p>
            <ul style="text-align: left; display: inline-block; margin: 4px 0 0 15px; line-height: 1.4;">
                <li>C 是不是只有某個時段特別熱賣？</li>
                <li>C 是否常和其他商品一起購買？</li>
                <li>C 的庫存是否足夠？</li>
                <li>C 的銷售量最近是上升還是下降？</li>
            </ul>
            <p style="margin-top: 8px;"><strong>因此：</strong>資料分析不只是「看數字」，而是從資料中找出可以幫助決策的資訊。</p>
        `
    },
    {
        title: "8. 資料導向決策（Data-Driven Decision Making）",
        content: `
            <p>資料導向決策是指：<strong><span>利用客觀的資料與數據作為決策依據，而不是只依靠個人直覺。</span></strong></p>
            <p>例如便利商店要決定「哪一種商品需要增加庫存？」</p>
            <p>如果只憑感覺：<strong>「我覺得 A 商品應該很好賣。」</strong>這是主觀判斷。</p>
            <p>如果查看歷史銷售量、銷售趨勢、庫存數量、銷售時段與商品關聯，再做決定：<strong><span>「A 商品最近銷售量持續增加，而且目前庫存偏低，因此優先補貨。」</span></strong></p>
            <p style="margin-top: 8px;">這就是：<strong>資料導向決策。</strong></p>
        `
    },
    {
        title: "9. 資料導向決策的基本流程",
        content: `
            <p>可以讓學生記住這個流程：</p>
            <p style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-weight: bold; text-align: center; color: #2980b9;">
                資料 ➔ 分析 ➔ 發現 ➔ 判斷 ➔ 決策
            </p>
            <p><strong>例如：</strong><br>銷售資料 ➔ 比較不同商品銷售量 ➔ 發現 A 商品近期銷售增加 ➔ 判斷可能有缺貨風險 ➔ 決定增加 A 商品庫存。</p>
            <p style="margin-top: 8px; color: #e67e22; font-weight: bold;">這也會直接銜接你後面的實驗任務。</p>
        `
    },
    {
        title: "10. 資料分析最重要的不是算得多複雜",
        content: `
            <p>學習數據分析，不一定要先學習複雜的程式或數學。</p>
            <p>在日常商業情境中，首先需要學會：</p>
            <ul style="text-align: left; display: inline-block; margin: 8px 0; line-height: 1.5;">
                <li>看懂資料</li>
                <li>比較資料</li>
                <li>找出資料中的關聯或規律</li>
                <li>利用資料做出合理的決策</li>
            </ul>
            <p style="margin-top: 10px; font-size: 15px; color: #2c3e50; text-align: center; font-weight: bold;">
                也就是：資料 ➔ 比較 ➔ 找規律 ➔ 做決策
            </p>
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

document.addEventListener("DOMContentLoaded", () => {
    for (let i = 0; i < 15; i++) {
        const mobEl = document.getElementById(`mob-target-${Math.floor(i/5)+1}-${i%5}`);
        const taskId = i < 5 ? 'task1' : (i < 10 ? 'task2' : 'task3');
        const cardId = `${taskId.toUpperCase()}-Card0${(i%5)+1}`;

        if (mobEl) {
            mobEl.addEventListener("targetFound", () => {
                scanARCard(taskId, cardId, `偵測到 ${cardId}！`);
                document.getElementById('mobile-scan-status').innerHTML = `✅ 成功掃描並記錄：<strong>${cardId}</strong>`;
            });
        }
    }
});

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
