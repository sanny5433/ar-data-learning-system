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

// 手機掃描進來時，自動切換到純 AR 掃描畫面
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

// 啟動手機專屬 AR 掃描模式
window.startMobileAR = function(taskNum) {
    goToScreen('screen-mobile-ar');
    document.getElementById('mobile-task-badge').innerText = `📱 手機專屬 AR 掃描器 (Task ${taskNum})`;
    document.getElementById('mobile-scan-status').innerHTML = `📱 正在準備 Task ${taskNum} 鏡頭，請點擊下方橘色按鈕授權相機！`;
}

// 強制呼叫相機權限並啟動 MindAR
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

// 【完整保留 10 頁詳細版】基礎教學內容
const tutorialPages = [
    { title: "1. 什麼是關聯規則（Association Rules）？", content: `<p>關聯規則是一種用來發掘不同商品、事件或行為之間關聯性的方法。</p><p>簡單來說，就是從大量資料中找出：<strong><span>「哪些東西經常一起出現？」</span></strong>例如在超市購物籃中，顧客買了麵包是否常順便買牛奶？這就是關聯分析的核心。</p>` },
    { title: "2. 為什麼需要找「關聯」？", content: `<p>當資料量龐大時，單靠人工無法逐筆檢視交易明細。透過數據分析，企業能精準掌握顧客的「隱性需求」與「共同購買行為」，進而優化商品陳列、規劃組合促銷與提升營運效益。</p>` },
    { title: "3. 核心指標一：支援度（Support）", content: `<p>支援度用來衡量：<strong><span>某個商品組合在全體交易中出現的頻率有多高。</span></strong></p><p>計算方式：<code>包含該組合的交易筆數 ÷ 總交易筆數</code><br>支援度越高，代表該商品組合越具代表性與市場能見度。</p>` },
    { title: "4. 核心指標二：信心度（Confidence）", content: `<p>信心度用來衡量：<strong><span>當顧客購買商品 A 時，同時購買商品 B 的條件機率有多高。</span></strong></p><p>計算方式：<code>同時包含 A 與 B 的交易筆數 ÷ 包含 A 的交易筆數</code><br>信心度越高，代表 A 與 B 的聯動購買強度越大。</p>` },
    { title: "5. 支援度與信心度的區別", content: `<p>• <strong>支援度 (Support)</strong>：從「整體宏觀視角」出發，看這個組合在所有交易中有多常見。<br>• <strong>信心度 (Confidence)</strong>：從「條件因果視角」出發，看買了 A 之後會順便買 B 的可能性有多大。</p>` },
    { title: "6. 關聯規則分析的三大步驟", content: `<p>1. <strong>資料蒐集與整理</strong>：匯集原始交易紀錄與發票數據。<br>2. <strong>計算與指標評估</strong>：逐一計算各商品組合的支援度與信心度。<br>3. <strong>解讀與決策</strong>：挑選出高支援度與高信心度的規則作為行銷佈局依據。</p>` },
    { title: "7. 數據不只是冷冰冰的數字", content: `<p>在商業環境中，資料分析的真正價值在於<strong>將數位足跡轉化為洞察</strong>。每一筆結帳紀錄背後，都是顧客真實的生活型態與消費習慣。</p>` },
    { title: "8. 什麼是資料導向決策（Data-Driven Decision Making）？", content: `<p>資料導向決策是指在進行商業判斷時，拋棄純粹的個人直覺與經驗猜測，改以<strong>客觀的數據、量化指標與趨勢分析</strong>作為決策的核心依據，降低決策風險。</p>` },
    { title: "9. 資料導向決策的標準閉環流程", content: `<p style="text-align: center; color: #2980b9; font-weight: bold; padding: 5px 0;">資料蒐集 ➔ 數據分析 ➔ 發現規律 ➔ 商業判斷 ➔ 實際決策</p><p>每一個環節環環相扣，確保每次調整都能對應市場真實需求。</p>` },
    { title: "10. 學習總結：核心精神", content: `<p style="text-align: center; font-weight: bold; color: #27ae60;">資料 ➔ 比較 ➔ 找規律 ➔ 做決策</p><p>掌握這套思考邏輯，您就能在商用數據分析與 AR 互動情境中，輕鬆做出最具商業價值的智慧決策！</p>` }
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

// 卡片掃描偵測
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

// 題目與測驗邏輯
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

// 前測
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

// 後測與管理員邏輯
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
