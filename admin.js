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

// DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const trainingForm = document.getElementById('training-form');
const trainingDataList = document.getElementById('training-data-list');
const logoutBtn = document.getElementById('logout-btn');
const docIdInput = document.getElementById('doc-id-input');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formTitle = document.getElementById('form-title');

if (sessionStorage.getItem('isAdminLoggedIn') === 'true') { showDashboard(); }

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if (username === 'ultimasquad@gmail.com' && password === '437666') {
        sessionStorage.setItem('isAdminLoggedIn', 'true');
        showDashboard();
    } else { alert('Username atau password salah!'); }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    loginContainer.style.display = 'block';
    dashboardContainer.style.display = 'none';
});

trainingForm.addEventListener('submit', handleFormSubmit);
cancelEditBtn.addEventListener('click', resetForm);
trainingDataList.addEventListener('click', handleListClick);

function showDashboard() {
    loginContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    loadTrainingData();
}

function normalizeAnswerFormat(answerString) {
    try {
        const parsedJson = JSON.parse(answerString);
        if (Array.isArray(parsedJson) && parsedJson.every(item => item.type && item.content)) {
            return JSON.stringify(parsedJson, null, 2);
        } else {
            const wrappedAsText = [{ type: 'text', content: `Format JSON tidak standar:\n\n${JSON.stringify(parsedJson, null, 2)}` }];
            return JSON.stringify(wrappedAsText, null, 2);
        }
    } catch (e) {
        const formattedText = [{ type: 'text', content: answerString }];
        return JSON.stringify(formattedText, null, 2);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // [MODIFIKASI] Mengambil data dari field baru
    const topic = document.getElementById('topic-input').value;
    const keywordsString = document.getElementById('keywords-input').value;
    const rawAnswer = document.getElementById('answer-textarea').value;
    const priority = parseInt(document.getElementById('priority-input').value) || 0;
    const context = document.getElementById('context-input').value.trim();
    
    const keywords = keywordsString.split(',').map(k => k.trim().toLowerCase());
    const finalAnswer = normalizeAnswerFormat(rawAnswer);
    const docId = docIdInput.value;

    // [MODIFIKASI] Objek data sekarang menyertakan priority dan context
    const dataToSave = { topic, keywords, answer: finalAnswer, priority, context };

    try {
        if (docId) {
            await knowledgeCollection.doc(docId).update(dataToSave);
            alert('Aturan berhasil diperbarui!');
        } else {
            dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await knowledgeCollection.add(dataToSave);
            alert('Aturan berhasil disimpan!');
        }
        resetForm();
        loadTrainingData();
    } catch (error) {
        console.error("Error saving data: ", error);
        alert('Gagal menyimpan data ke Firestore.');
    }
}

async function loadTrainingData() {
    trainingDataList.innerHTML = 'Memuat data...';
    try {
        const snapshot = await knowledgeCollection.orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            trainingDataList.innerHTML = '<p>Belum ada aturan tersimpan.</p>';
            return;
        }
        trainingDataList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const item = document.createElement('div');
            item.classList.add('training-item');
            
            // [MODIFIKASI] Menampilkan data priority dan context di list
            item.innerHTML = `
                <div class="training-item-content">
                    <p><strong>Topik:</strong> ${data.topic} | <strong>Prioritas:</strong> ${data.priority || 0} | <strong>Konteks:</strong> ${data.context || '-'}</p>
                    <p><strong>Kata Kunci:</strong> ${data.keywords.join(', ')}</p>
                    <p><strong>Jawaban:</strong> <pre>${data.answer.substring(0, 150)}...</pre></p>
                </div>
                <div class="action-buttons">
                    <button class="edit-btn" data-id="${doc.id}">Edit</button>
                    <button class="delete-btn" data-id="${doc.id}">Hapus</button>
                </div>
            `;
            trainingDataList.appendChild(item);
        });
    } catch (error) {
        console.error("Error loading data: ", error);
        trainingDataList.innerHTML = '<p>Gagal memuat data.</p>';
    }
}

async function handleListClick(e) {
    const target = e.target;
    const docId = target.dataset.id;

    if (target.classList.contains('delete-btn')) {
        if (confirm('Anda yakin ingin menghapus aturan ini?')) {
            try {
                await knowledgeCollection.doc(docId).delete();
                loadTrainingData();
            } catch (error) { console.error("Error:", error); alert('Gagal hapus.'); }
        }
    } else if (target.classList.contains('edit-btn')) {
        try {
            const doc = await knowledgeCollection.doc(docId).get();
            if (doc.exists) {
                const data = doc.data();
                // [MODIFIKASI] Memuat data priority dan context ke form
                document.getElementById('topic-input').value = data.topic;
                document.getElementById('keywords-input').value = data.keywords.join(', ');
                document.getElementById('answer-textarea').value = data.answer;
                document.getElementById('priority-input').value = data.priority || 0;
                document.getElementById('context-input').value = data.context || '';
                docIdInput.value = doc.id;

                formTitle.textContent = "Edit Aturan Chatbot";
                submitBtn.textContent = 'Update Aturan';
                cancelEditBtn.style.display = 'inline-block';
                window.scrollTo(0, 0);
            }
        } catch (error) { console.error("Error:", error); alert('Gagal memuat data.'); }
    }
}

function resetForm() {
    trainingForm.reset();
    docIdInput.value = '';
    formTitle.textContent = "Dashboard Pengetahuan Chatbot";
    submitBtn.textContent = 'Simpan Aturan';
    cancelEditBtn.style.display = 'none';
}
