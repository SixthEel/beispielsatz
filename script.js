class App {
    constructor() {
        this.data = { lessons: [] }; // Slovíčka
        this.sentenceData = [];      // Věty (nové)
        
        this.currentWords = [];
        this.currentSentences = [];  // Filtrované věty pro aktuální výběr

        this.selectedLessons = new Set();
        this.selectedPages = new Set();
        this.isReverseMode = false;

        // DOM Elements
        this.checkboxesLessons = document.getElementById('checkboxes-lessons');
        this.checkboxesPages = document.getElementById('checkboxes-pages');
        this.lessonMultiselect = document.getElementById('lessonMultiselect');
        this.pageMultiselect = document.getElementById('pageMultiselect');
        this.reverseModeToggle = document.getElementById('reverseModeToggle');
        this.wordListContainer = document.getElementById('wordListContainer');
        this.wordCountBadge = document.getElementById('wordCountBadge');
        this.navButtons = document.querySelectorAll('.nav-btn');
        this.views = {
            learn: document.getElementById('view-learn'),
            games: document.getElementById('view-games'),
            stats: null
        };

        this.init();
    }

    async init() {
        console.log("App initializing...");
        
        // 1. Soubory se slovíčky
        this.vocabFiles = [
            'database 1-4.json',
            'database 5-10.json',
            'database 11-14.json',
            'database 15-18.json'
        ];

        // 2. Soubory s větami (NOVÉ)
        this.sentenceFiles = [
            'sentences 1-4.json',
            'sentences 5-10.json',
            'sentences 11-14.json',
            'sentences 15-18.json'
        ];

        await this.loadAllData();
        this.setupEventListeners();
        this.setupMultiselectUI();
    }

    async loadAllData() {
        try {
            // A) Načtení slovíček
            const vocabPromises = this.vocabFiles.map(file => fetch(file).then(r => r.ok ? r.json() : null).catch(e => null));
            const vocabResults = await Promise.all(vocabPromises);
            
            let allLessons = [];
            vocabResults.filter(d => d && d.lessons).forEach(d => {
                allLessons = allLessons.concat(d.lessons);
            });
            allLessons.sort((a, b) => (a.number || 0) - (b.number || 0));
            this.data = { lessons: allLessons };

            // B) Načtení vět
            const sentPromises = this.sentenceFiles.map(file => fetch(file).then(r => r.ok ? r.json() : null).catch(e => null));
            const sentResults = await Promise.all(sentPromises);

            this.sentenceData = [];
            sentResults.filter(d => d && d.sentences).forEach(d => {
                this.sentenceData = this.sentenceData.concat(d.sentences);
            });

            console.log(`Loaded: ${allLessons.length} lessons, ${this.sentenceData.length} sentences.`);
            this.populateLessonCheckboxes();

        } catch (error) {
            console.error("Critical Error loading data:", error);
            this.wordListContainer.innerHTML = `<div class="empty-state glass-panel"><h2 style="color:#ff7675">Fehler</h2><p>Datenbank konnte nicht geladen werden.</p></div>`;
        }
    }

    populateLessonCheckboxes() {
        if (!this.data.lessons) return;
        this.checkboxesLessons.innerHTML = '';
        
        const selectAllLabel = document.createElement('label');
        selectAllLabel.innerHTML = `<input type="checkbox" id="selectAllLessons" /> <strong>Alles auswählen</strong>`;
        this.checkboxesLessons.appendChild(selectAllLabel);

        this.data.lessons.forEach((lesson) => {
            const label = document.createElement('label');
            const name = lesson.name ? ` - ${lesson.name}` : '';
            label.innerHTML = `<input type="checkbox" class="lesson-cb" /> ${lesson.number}${name}`;
            this.checkboxesLessons.appendChild(label);
        });
    }

    populatePageCheckboxes() {
        this.checkboxesPages.innerHTML = '';
        this.selectedPages.clear();
        let availablePages = [];
        
        this.selectedLessons.forEach(lessonNum => {
            const lesson = this.data.lessons.find(l => l.number == lessonNum);
            if (lesson && lesson.pages) {
                lesson.pages.forEach(p => {
                    availablePages.push({
                        lessonNum: lesson.number,
                        pageNum: p.number,
                        id: `${lesson.number}-${p.number}`
                    });
                });
            }
        });

        if (availablePages.length === 0) {
            this.checkboxesPages.innerHTML = '<label>Wähle zuerst eine Lektion...</label>';
            return;
        }

        const selectAllLabel = document.createElement('label');
        selectAllLabel.innerHTML = `<input type="checkbox" id="selectAllPages" checked /> <strong>Alle Seiten</strong>`;
        this.checkboxesPages.appendChild(selectAllLabel);

        availablePages.forEach(p => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${p.id}" class="page-cb" checked /> Seite ${p.pageNum} <span style="opacity:0.5; font-size:0.8em">(L${p.lessonNum})</span>`;
            this.checkboxesPages.appendChild(label);
            this.selectedPages.add(p.id);
        });
        this.updateCurrentWords();
    }

    setupMultiselectUI() {
        const toggle = (elem, state) => { 
            if(!state) elem.classList.add('active'); 
            else elem.classList.remove('active'); 
            return !state; 
        };
        
        let expL = false, expP = false;
        
        this.lessonMultiselect.querySelector('.selectBox').addEventListener('click', () => { expL = toggle(this.lessonMultiselect, expL); });
        this.pageMultiselect.querySelector('.selectBox').addEventListener('click', () => { expP = toggle(this.pageMultiselect, expP); });

        document.addEventListener('click', (e) => {
            if (!this.lessonMultiselect.contains(e.target)) { this.lessonMultiselect.classList.remove('active'); expL = false; }
            if (!this.pageMultiselect.contains(e.target)) { this.pageMultiselect.classList.remove('active'); expP = false; }
        });
    }

    setupEventListeners() {
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });

        this.checkboxesLessons.addEventListener('change', (e) => {
            if (e.target.id === 'selectAllLessons') {
                const cbs = this.checkboxesLessons.querySelectorAll('.lesson-cb');
                cbs.forEach(cb => { cb.checked = e.target.checked; const v = parseInt(cb.value); e.target.checked ? this.selectedLessons.add(v) : this.selectedLessons.delete(v); });
            } else if (e.target.classList.contains('lesson-cb')) {
                const v = parseInt(e.target.value);
                e.target.checked ? this.selectedLessons.add(v) : this.selectedLessons.delete(v);
                // Update select all logic
                const all = this.checkboxesLessons.querySelectorAll('.lesson-cb');
                const chk = this.checkboxesLessons.querySelectorAll('.lesson-cb:checked');
                document.getElementById('selectAllLessons').checked = (all.length === chk.length);
            }
            this.populatePageCheckboxes();
        });

        this.checkboxesPages.addEventListener('change', (e) => {
            if (e.target.id === 'selectAllPages') {
                const cbs = this.checkboxesPages.querySelectorAll('.page-cb');
                cbs.forEach(cb => { cb.checked = e.target.checked; e.target.checked ? this.selectedPages.add(cb.value) : this.selectedPages.delete(cb.value); });
            } else if (e.target.classList.contains('page-cb')) {
                e.target.checked ? this.selectedPages.add(e.target.value) : this.selectedPages.delete(e.target.value);
                const all = this.checkboxesPages.querySelectorAll('.page-cb');
                const chk = this.checkboxesPages.querySelectorAll('.page-cb:checked');
                document.getElementById('selectAllPages').checked = (all.length === chk.length);
                this.updateCurrentWords();
            }
        });

        this.reverseModeToggle.addEventListener('change', (e) => {
            this.isReverseMode = e.target.checked;
            if (window.GameManager) window.GameManager.setOptions({ reverse: this.isReverseMode });
        });
    }

    switchView(viewName) {
        this.navButtons.forEach(btn => {
            if (btn.dataset.view === viewName) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        Object.keys(this.views).forEach(key => {
            if(this.views[key]) {
                if (key === viewName) { this.views[key].classList.remove('hidden'); this.views[key].classList.add('active'); }
                else { this.views[key].classList.add('hidden'); this.views[key].classList.remove('active'); }
            }
        });
    }

    updateCurrentWords() {
        this.currentWords = [];
        this.currentSentences = [];

        if (this.selectedLessons.size > 0) {
            // 1. Filter Words (based on pages)
            this.selectedLessons.forEach(lessonNum => {
                const lesson = this.data.lessons.find(l => l.number == lessonNum);
                if (lesson && lesson.pages) {
                    lesson.pages.forEach(p => {
                        if (this.selectedPages.has(`${lesson.number}-${p.number}`)) {
                            this.currentWords = this.currentWords.concat(p.words || []);
                        }
                    });
                }
            });

            // 2. Filter Sentences (based on LESSONS only)
            // (Předpokládáme, že věty jsou přiřazené k lekci, ne ke stránce)
            this.currentSentences = this.sentenceData.filter(s => this.selectedLessons.has(s.lesson));
        }

        this.updateStats();
        this.renderWords();

        if (window.GameManager) {
            // PŘEDÁVÁME SLOVÍČKA I VĚTY
            window.GameManager.setData(this.currentWords, this.currentSentences);
            window.GameManager.setOptions({ reverse: this.isReverseMode });
        }
    }

    updateStats() {
        this.wordCountBadge.textContent = `${this.currentWords.length} Wörter`;
    }

    renderWords() {
        this.wordListContainer.innerHTML = '';
        if (this.currentWords.length === 0) {
            this.wordListContainer.innerHTML = `<div class="empty-state glass-panel"><h2>Wähle Lektionen</h2><p>Markiere Lektionen und Seiten im Menü oben.</p></div>`;
            return;
        }
        this.currentWords.forEach(word => {
            const german = word.german || "???";
            const czech = word.czech || "???";
            const plural = word.plural ? `(Pl. ${word.plural})` : "";
            const example = word.example ? `<div class="w-example">"${word.example}"</div>` : '';
            const card = document.createElement('div');
            card.className = 'word-card';
            card.innerHTML = `<div class="w-german">${german}</div><div class="w-czech">${czech}</div>${plural ? `<div class="w-meta">${plural}</div>` : ''}${example}`;
            this.wordListContainer.appendChild(card);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });