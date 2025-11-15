// TODO: PASTE KONFIGURASI FIREBASE ANDA DI SINI
 const firebaseConfig = {
    apiKey: "AIzaSyDkSAxnbKHUbc4T-jQg6xVUiHyd4i0XiP0",
    authDomain: "chatbot-dolan-sawah-v2.firebaseapp.com",
    projectId: "chatbot-dolan-sawah-v2",
    storageBucket: "chatbot-dolan-sawah-v2.firebasestorage.app",
    messagingSenderId: "337869888557",
    appId: "1:337869888557:web:4416d6f89d8089c7096ca4"
  };

//---------------------------------------------------------
// Sisa kode di bawah ini jangan diubah
//---------------------------------------------------------

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const knowledgeCollection = db.collection('knowledgeBase');
const unansweredCollection = db.collection('unanswered_queries'); // [BARU] Koleksi untuk pertanyaan tak terjawab

const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const messageContainer = document.getElementById('message-container');
const chatWindow = document.getElementById('chat-window');

let knowledgeBase = [];
let currentContext = null; // [BARU] Variabel untuk menyimpan konteks percakapan

// [BARU] Jawaban fallback yang proaktif dengan sugesti
const fallbackAnswer = `[
    {"type": "text", "content": "Maaf, saya belum mengerti pertanyaan Anda. Mungkin salah satu topik di bawah ini bisa membantu?"},
    {"type": "buttons", "content": [
        {"label": "Lihat Promo", "url": "#tanya_promo"},
        {"label": "Paket Jeep", "url": "#tanya_jeep"},
        {"label": "Menu Resto", "url": "#tanya_menu"}
    ]}
]`;

// Memuat semua aturan dari Firestore saat halaman dibuka
async function loadKnowledgeBase() {
    try {
        const snapshot = await knowledgeCollection.get();
        knowledgeBase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Basis Pengetahuan dimuat.");
    } catch (error) {
        console.error("Gagal memuat basis pengetahuan:", error);
    }
}

// [BARU] Fungsi untuk mencatat pertanyaan yang tidak bisa dijawab
async function logUnansweredQuery(message) {
    try {
        await unansweredCollection.add({
            query: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Pertanyaan tak terjawab dicatat:", message);
    } catch (error) {
        console.error("Gagal mencatat pertanyaan:", error);
    }
}


/**
 * =================================================================
 * [LOGIKA INTI BARU] - Menggunakan Skoring dan Konteks
 * =================================================================
 */
function getSmartResponse(userMessage) {
    const lowerCaseMessage = userMessage.toLowerCase();
    let bestMatch = { score: 0, rule: null };

    // Loop melalui SEMUA aturan untuk mencari skor terbaik
    for (const rule of knowledgeBase) {
        let currentScore = 0;
        const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];

        // 1. Hitung skor berdasarkan kata kunci
        for (const keyword of keywords) {
            if (lowerCaseMessage.includes(keyword.toLowerCase())) {
                currentScore += 10; // Setiap kata kunci yang cocok mendapat 10 poin
            }
        }

        // 2. Beri bonus besar jika konteksnya cocok
        if (rule.context && rule.context === currentContext) {
            currentScore += 30; // Bonus konteks 30 poin, sangat kuat
        }

        // 3. Tambahkan skor prioritas dari aturan itu sendiri
        currentScore += rule.priority || 0;

        // 4. Bandingkan dengan skor terbaik sejauh ini
        if (currentScore > bestMatch.score) {
            bestMatch = { score: currentScore, rule: rule };
        }
    }

    // Jika ada aturan yang cocok dengan skor di atas 0
    if (bestMatch.score > 0) {
        // Atur konteks untuk pertanyaan selanjutnya
        currentContext = bestMatch.rule.context || null;
        console.log("Konteks diatur menjadi:", currentContext);
        return bestMatch.rule.answer;
    } else {
        // Jika tidak ada yang cocok sama sekali
        logUnansweredQuery(userMessage); // Catat pertanyaan gagal
        currentContext = null; // Reset konteks jika gagal
        return fallbackAnswer;
    }
}

function appendMessage(htmlContent, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    messageElement.innerHTML = htmlContent; 
    messageContainer.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderBotMessage(messageString) {
    const messageDiv = document.createElement('div');
    try {
        const parsedData = JSON.parse(messageString);
        if (Array.isArray(parsedData)) {
            parsedData.forEach(part => {
                if (part.type === 'text') {
                    const p = document.createElement('p');
                    p.textContent = part.content;
                    messageDiv.appendChild(p);
                } else if (part.type === 'image') {
                    const img = document.createElement('img');
                    img.src = part.content;
                    img.className = 'chat-image';
                    img.alt = 'Gambar dari chatbot';
                    messageDiv.appendChild(img);
                } else if (part.type === 'buttons') {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'button-container';
                    part.content.forEach(buttonData => {
                        const button = document.createElement('a');
                        button.textContent = buttonData.label;
                        button.href = buttonData.url;
                        button.target = '_blank';
                        button.className = 'chat-button';
                        buttonContainer.appendChild(button);
                    });
                    messageDiv.appendChild(buttonContainer);
                }
            });
        } else {
            throw new Error("Format JSON harus berupa Array.");
        }
    } catch (error) {
        const p = document.createElement('p');
        p.textContent = messageString;
        messageDiv.appendChild(p);
    }
    appendMessage(messageDiv.innerHTML, 'bot');
}


chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    appendMessage(`<p>${userMessage}</p>`, 'user');
    userInput.value = '';

    // Gunakan fungsi logika yang baru
    const botResponseString = getSmartResponse(userMessage);

    // Tampilkan loading/typing indicator (opsional)
    setTimeout(() => {
        renderBotMessage(botResponseString);
    }, 500);
});

document.addEventListener('DOMContentLoaded', loadKnowledgeBase);
