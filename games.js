/* =========================================
   GLOBAL HELPER: TEXT TO SPEECH
   ========================================= */
function speakGerman(text) {
    if (!text) return;
    
    // --- ČISTIČKA TEXTU PRO HLASOVÝ MODUL ---
    // Odstraní gramatické značky z databáze, na kterých TTS padá
    let cleanedText = text
        .replace(/\|/g, '')          // Odstraní svislítka: "an|machen" -> "anmachen"
        .replace(/[\(\)]/g, '')      // Odstraní závorky: "(sich) schminken" -> "sich schminken"
        .replace(/\//g, ' oder ')    // Lomítka přečte jako "nebo": "das/der" -> "das oder der"
        .replace(/…/g, '')           // Odstraní trojtečky
        .trim();

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(v => v.lang.includes('de'));
    if (germanVoice) utterance.voice = germanVoice;
    window.speechSynthesis.speak(utterance);
}

/* =========================================
   1. SNAKE GAME LOGIC (WORD BLOCKS v3)
   ========================================= */
class SnakeGameLogic {
    constructor(words, container, gridBackground, scoreEl, highScoreEl, targetWordEl, overlay, overlayTitle, overlayBtn, speedEl, isReverse) {
        if (!words || words.length === 0) { this.words = []; }
        else { this.isReverse = isReverse; this.words = this.convertWordsForSnake(words); }

        this.container = container;
        this.gridBackground = gridBackground;
        this.scoreEl = scoreEl;
        this.highScoreEl = highScoreEl;
        this.targetWordEl = targetWordEl;
        this.overlay = overlay;
        this.overlayTitle = overlayTitle;
        this.overlayBtn = overlayBtn;
        this.speedEl = speedEl;
        this.gameType = 'snake';
        this.GRID_SIZE = 16;
        this.BASE_SPEED = 250;
        this.currentSpeed = this.BASE_SPEED;
        this.speedMultiplier = 1.0;
        this.wordsCollected = 0;
        this.INITIAL_SNAKE = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
        this.INITIAL_DIRECTION = { x: 1, y: 0 };
        this.snake = [];
        this.direction = { ...this.INITIAL_DIRECTION };
        this.nextDirection = { ...this.INITIAL_DIRECTION };
        this.inputBuffer = [];
        this.MAX_BUFFER_SIZE = 3;
        this.status = 'idle';
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('snake-german-highscore') || '0', 10);
        this.targetWord = null;
        this.fieldWords = [];
        this.gameInterval = null;
        this.lastFrameTime = 0;
        this.animationFrameId = null;

        // collision: "x,y" -> word.id
        this.collisionMap = new Map();
        // dom: word.id -> element
        this.wordDom = new Map();

        // Měřič textu - skrytý span
        this.measurer = document.createElement('span');
        this.measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:clamp(0.6rem,1.8vw,0.9rem);padding:0 6px;';
        document.body.appendChild(this.measurer);

        this.init();
    }

    convertWordsForSnake(words) {
        var clean = function(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); };
        var rev = this.isReverse;
        return words.map(function(word) {
            if (rev) return { targetDisplay: word.german, collectItem: clean(word.czech), speak: word.german };
            else return { targetDisplay: clean(word.czech), collectItem: word.german, speak: word.german };
        });
    }

    // Změří skutečnou šířku textu v pixelech a vrátí počet grid polí
    measureWordCells(text) {
        this.measurer.textContent = text;
        var textPx = this.measurer.offsetWidth + 12; // +padding+border
        var areaEl = this.container;
        var areaPx = areaEl.offsetWidth || 400;
        var cellPx = areaPx / this.GRID_SIZE;
        if (cellPx < 1) cellPx = 25;
        var cells = Math.ceil(textPx / cellPx);
        if (cells < 2) cells = 2;
        if (cells > this.GRID_SIZE - 2) cells = this.GRID_SIZE - 2;
        return cells;
    }

    init() {
        this.snake = this.INITIAL_SNAKE.map(function(p) {
            return { x: p.x, y: p.y, targetX: p.x, targetY: p.y, lerpProgress: 1.0 };
        });
        this.updateUI();
        this.renderGridBackground();
        this._boundKeyDown = this.handleGlobalKeyDown.bind(this);
        window.addEventListener('keydown', this._boundKeyDown);
        this._overlayBtnHandler = this.startGame.bind(this);
        if (this.overlayBtn) this.overlayBtn.addEventListener('click', this._overlayBtnHandler);
        this._touchStartHandler = this.handleTouchStart.bind(this);
        this._touchEndHandler = this.handleTouchEnd.bind(this);
        this._touchMoveHandler = function(e) { if (this.status === 'playing') e.preventDefault(); }.bind(this);
        document.addEventListener('touchstart', this._touchStartHandler, { passive: false });
        document.addEventListener('touchend', this._touchEndHandler, { passive: false });
        document.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

        // --- BINDING PRO MOBILNÍ ŠIPKY ---
        this.dpadBtns = this.container.querySelectorAll('.dpad-btn');
        this._dpadHandler = function(e) {
            e.preventDefault();
            if (this.status !== 'playing') return;
            var dir = e.currentTarget.dataset.dir;
            var nd = null;
            if (dir === 'up' && this.direction.y !== 1) nd = {x:0,y:-1};
            if (dir === 'down' && this.direction.y !== -1) nd = {x:0,y:1};
            if (dir === 'left' && this.direction.x !== 1) nd = {x:-1,y:0};
            if (dir === 'right' && this.direction.x !== -1) nd = {x:1,y:0};
            if (nd) {
                if (this.inputBuffer.length < this.MAX_BUFFER_SIZE) this.inputBuffer.push(nd);
                else { this.inputBuffer.shift(); this.inputBuffer.push(nd); }
            }
        }.bind(this);
        for (var i=0; i<this.dpadBtns.length; i++) {
            this.dpadBtns[i].addEventListener('touchstart', this._dpadHandler, {passive: false});
            this.dpadBtns[i].addEventListener('mousedown', this._dpadHandler);
        }
    }

    destroy() {
        if (this._boundKeyDown) window.removeEventListener('keydown', this._boundKeyDown);
        if (this.overlayBtn && this._overlayBtnHandler) this.overlayBtn.removeEventListener('click', this._overlayBtnHandler);
        if (this._touchStartHandler) document.removeEventListener('touchstart', this._touchStartHandler);
        if (this._touchEndHandler) document.removeEventListener('touchend', this._touchEndHandler);
        if (this._touchMoveHandler) document.removeEventListener('touchmove', this._touchMoveHandler);
        clearInterval(this.gameInterval);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this.measurer && this.measurer.parentNode) this.measurer.parentNode.removeChild(this.measurer);
        if (this.dpadBtns) {
            for (var i=0; i<this.dpadBtns.length; i++) {
                this.dpadBtns[i].removeEventListener('touchstart', this._dpadHandler);
                this.dpadBtns[i].removeEventListener('mousedown', this._dpadHandler);
            }
        }
        this.status = 'idle';
    }

    handleGlobalKeyDown(e) {
        var gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (gameKeys.indexOf(e.key) !== -1 && (this.status === 'playing' || !this.overlay.classList.contains('hidden'))) {
            e.preventDefault();
        }
        if (this.gameType === 'snake' && this.status === 'playing') {
            this.handleKeyInput(e);
        } else if ((this.status === 'idle' || this.status === 'gameover') && (e.key === 'Enter' || e.key === ' ')) {
            if (!this.overlay.classList.contains('hidden')) this.startGame();
        }
    }

    handleKeyInput(e) {
        var nd = null;
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': if (this.direction.y !== 1) nd = {x:0,y:-1}; break;
            case 'ArrowDown': case 's': case 'S': if (this.direction.y !== -1) nd = {x:0,y:1}; break;
            case 'ArrowLeft': case 'a': case 'A': if (this.direction.x !== 1) nd = {x:-1,y:0}; break;
            case 'ArrowRight': case 'd': case 'D': if (this.direction.x !== -1) nd = {x:1,y:0}; break;
        }
        if (nd) {
            if (this.inputBuffer.length < this.MAX_BUFFER_SIZE) this.inputBuffer.push(nd);
            else { this.inputBuffer.shift(); this.inputBuffer.push(nd); }
        }
    }

    processInputBuffer() {
        if (this.inputBuffer.length > 0) {
            var nextDir = this.inputBuffer[0];
            if (this.direction.x !== -nextDir.x || this.direction.y !== -nextDir.y) {
                this.nextDirection = nextDir;
                this.inputBuffer.shift();
            } else {
                this.inputBuffer = [];
            }
        }
    }

    startGame() {
        if (!this.words || this.words.length < 5) {
            alert("Mindestens 5 W\u00f6rter ben\u00f6tigt!");
            return;
        }
        this.snake = this.INITIAL_SNAKE.map(function(p) {
            return { x: p.x, y: p.y, targetX: p.x, targetY: p.y, lerpProgress: 1.0 };
        });
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.inputBuffer = [];
        this.score = 0;
        this.wordsCollected = 0;
        this.currentSpeed = this.BASE_SPEED;
        this.speedMultiplier = 1.0;
        this.status = 'playing';
        this.clearAllWords();
        this.updateUI();
        this.generateNewRound();
        if (this.gameInterval) clearInterval(this.gameInterval);
        var self = this;
        this.gameInterval = setInterval(function() { self.gameLogicUpdate(); }, this.currentSpeed);
        this.lastFrameTime = performance.now();
        this.animate();
        this.overlay.classList.add('hidden');
    }

    rebuildCollisionMap() {
        this.collisionMap.clear();
        for (var i = 0; i < this.fieldWords.length; i++) {
            var w = this.fieldWords[i];
            for (var j = 0; j < w.cells.length; j++) {
                this.collisionMap.set(w.cells[j].x + ',' + w.cells[j].y, w.id);
            }
        }
    }

    findWordById(id) {
        for (var i = 0; i < this.fieldWords.length; i++) {
            if (this.fieldWords[i].id === id) return { word: this.fieldWords[i], index: i };
        }
        return null;
    }

    gameLogicUpdate() {
        if (this.status !== 'playing') return;
        this.processInputBuffer();
        this.direction = this.nextDirection;

        var head = this.snake[0];
        var newHead = {
            x: head.targetX + this.direction.x,
            y: head.targetY + this.direction.y,
            targetX: head.targetX + this.direction.x,
            targetY: head.targetY + this.direction.y,
            lerpProgress: 0.0
        };

        if (newHead.targetX < 0 || newHead.targetX >= this.GRID_SIZE ||
            newHead.targetY < 0 || newHead.targetY >= this.GRID_SIZE) {
            this.gameOver(); return;
        }

        // Kolize se slovem přes collision mapu (vrací word ID)
        var key = newHead.targetX + ',' + newHead.targetY;
        var hitId = this.collisionMap.has(key) ? this.collisionMap.get(key) : null;

        var isGrowing = false, shouldShrink = false;
        var hitResult = null;
        if (hitId) {
            hitResult = this.findWordById(hitId);
            if (hitResult) {
                if (hitResult.word.isCorrect) {
                    isGrowing = true;
                    this.wordsCollected++;
                    speakGerman(this.isReverse ? this.targetWord.targetDisplay : this.targetWord.collectItem);
                    if (this.wordsCollected % 3 === 0) this.increaseSpeed();
                } else {
                    shouldShrink = true;
                }
            }
        }

        // Self kolize
        var tailIdx = isGrowing ? -1 : this.snake.length - 1;
        var selfHit = false;
        for (var si = 0; si < this.snake.length; si++) {
            if (si === tailIdx) continue;
            if (Math.round(this.snake[si].targetX) === newHead.targetX &&
                Math.round(this.snake[si].targetY) === newHead.targetY) {
                selfHit = true; break;
            }
        }
        if (selfHit) { this.gameOver(); return; }

        if (isGrowing) {
            this.snake.unshift(newHead);
        } else if (shouldShrink && hitResult) {
            var tmp = [newHead].concat(this.snake);
            if (tmp.length <= 3) { this.gameOver(); return; }
            this.snake = tmp.slice(0, tmp.length - 3);
            this.removeWord(hitResult.word.id);
        } else {
            for (var i = this.snake.length - 1; i > 0; i--) {
                this.snake[i].targetX = this.snake[i-1].targetX;
                this.snake[i].targetY = this.snake[i-1].targetY;
                this.snake[i].lerpProgress = 0.0;
            }
            this.snake[0] = newHead;
        }

        if (isGrowing) this.generateNewRound();
        this.updateUI();
    }

    increaseSpeed() {
        this.speedMultiplier *= 0.95;
        this.currentSpeed = Math.max(50, Math.floor(this.BASE_SPEED * this.speedMultiplier));
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            var self = this;
            this.gameInterval = setInterval(function() { self.gameLogicUpdate(); }, this.currentSpeed);
        }
    }

    gameOver() {
        this.status = 'gameover';
        clearInterval(this.gameInterval);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        var finalScore = this.snake.length;
        if (finalScore > this.highScore) {
            this.highScore = finalScore;
            localStorage.setItem('snake-german-highscore', this.highScore.toString());
        }
        this.updateUI();
        this.overlayTitle.innerText = 'Spiel vorbei \u2013 ' + finalScore + ' Punkte';
        this.overlayBtn.innerText = 'Nochmal';
        this.overlay.classList.remove('hidden');
    }

    generateNewRound() {
        this.clearAllWords();

        var pair = this.words[Math.floor(Math.random() * this.words.length)];
        this.targetWord = pair;

        var wrongs = [];
        var safety = 0;
        while (wrongs.length < 4 && safety < 100) {
            safety++;
            var p = this.words[Math.floor(Math.random() * this.words.length)];
            if (p.collectItem !== pair.collectItem) {
                var dup = false;
                for (var k = 0; k < wrongs.length; k++) { if (wrongs[k] === p.collectItem) { dup = true; break; } }
                if (!dup) wrongs.push(p.collectItem);
            }
        }

        var toPlace = [{ text: pair.collectItem, isCorrect: true }];
        for (var i = 0; i < Math.min(4, wrongs.length); i++) {
            toPlace.push({ text: wrongs[i], isCorrect: false });
        }
        // Shuffle
        for (var i = toPlace.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = toPlace[i]; toPlace[i] = toPlace[j]; toPlace[j] = t;
        }

        // Obsazeno: had + safety zóna
        var occ = new Set();
        for (var i = 0; i < this.snake.length; i++) {
            occ.add(Math.round(this.snake[i].targetX) + ',' + Math.round(this.snake[i].targetY));
        }
        var hd = this.snake[0];
        for (var i = 1; i <= 5; i++) {
            occ.add((hd.targetX + this.direction.x * i) + ',' + (hd.targetY + this.direction.y * i));
        }
        for (var i = 0; i <= 5; i++) {
            var fx = hd.targetX + this.direction.x * i;
            var fy = hd.targetY + this.direction.y * i;
            occ.add((fx + this.direction.y) + ',' + (fy + this.direction.x));
            occ.add((fx - this.direction.y) + ',' + (fy - this.direction.x));
        }

        var allUsed = new Set(occ);

        for (var w = 0; w < toPlace.length; w++) {
            var wd = toPlace[w];
            var gridW = this.measureWordCells(wd.text);
            var pos = this.findPosition(gridW, allUsed);
            if (!pos) continue;

            var id = Math.random().toString(36).substr(2, 9);
            var cells = [];
            for (var dx = 0; dx < gridW; dx++) {
                var cx = pos.x + dx;
                var cy = pos.y;
                cells.push({ x: cx, y: cy });
                // Blokuj pole + okolí
                for (var px = -1; px <= 1; px++) {
                    for (var py = -1; py <= 1; py++) {
                        allUsed.add((cx + px) + ',' + (cy + py));
                    }
                }
            }

            this.fieldWords.push({
                id: id,
                text: wd.text,
                isCorrect: wd.isCorrect,
                cells: cells,
                gx: pos.x,
                gy: pos.y,
                gw: gridW
            });
        }

        this.rebuildCollisionMap();
        this.renderAllWords();
    }

    findPosition(w, occupied) {
        var maxX = this.GRID_SIZE - w;
        if (maxX < 0) maxX = 0;
        for (var att = 0; att < 500; att++) {
            var sx = Math.floor(Math.random() * (maxX + 1));
            var sy = Math.floor(Math.random() * this.GRID_SIZE);
            var ok = true;
            for (var dx = 0; dx < w; dx++) {
                if (occupied.has((sx + dx) + ',' + sy)) { ok = false; break; }
            }
            if (ok) return { x: sx, y: sy };
        }
        return null;
    }

    renderAllWords() {
        var cp = 100 / this.GRID_SIZE;
        for (var i = 0; i < this.fieldWords.length; i++) {
            var w = this.fieldWords[i];

            var el = document.createElement('div');
            el.className = 'snake-word-block';
            el.style.left = (w.gx * cp) + '%';
            el.style.top = (w.gy * cp) + '%';
            el.style.width = (w.gw * cp) + '%';
            el.style.height = cp + '%';

            var txt = document.createElement('span');
            txt.className = 'snake-word-block-text';
            txt.textContent = w.text;
            el.appendChild(txt);

            this.container.appendChild(el);
            this.wordDom.set(w.id, el);
        }
    }

    removeWord(id) {
        // Animace + smazání DOM
        var el = this.wordDom.get(id);
        if (el) {
            el.classList.add('snake-word-block-eaten');
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
            this.wordDom.delete(id);
        }
        // Smazání z pole
        for (var i = 0; i < this.fieldWords.length; i++) {
            if (this.fieldWords[i].id === id) {
                this.fieldWords.splice(i, 1);
                break;
            }
        }
        this.rebuildCollisionMap();
    }

    clearAllWords() {
        this.wordDom.forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });
        this.wordDom.clear();
        this.fieldWords = [];
        this.collisionMap.clear();
    }

    updateUI() {
        if (this.scoreEl) this.scoreEl.innerText = this.snake.length;
        if (this.highScoreEl) this.highScoreEl.innerText = this.highScore;
        if (this.speedEl) this.speedEl.innerText = (1 / this.speedMultiplier).toFixed(1) + 'x';
        if (this.targetWordEl) {
            this.targetWordEl.innerText =
                (this.status === 'playing' && this.targetWord)
                    ? this.targetWord.targetDisplay
                    : (this.status === 'gameover' ? 'Spiel vorbei' : 'Schlangen Spiel');
        }
    }

    renderGridBackground() {
        this.gridBackground.innerHTML = '';
        for (var i = 0; i < this.GRID_SIZE * this.GRID_SIZE; i++) {
            var cell = document.createElement('div');
            cell.className = 'snake-grid-cell';
            this.gridBackground.appendChild(cell);
        }
    }

    animate() {
        var self = this;
        this.animationFrameId = requestAnimationFrame(function(ts) {
            if (self.status !== 'playing') return;
            var dt = ts - self.lastFrameTime;
            self.lastFrameTime = ts;
            for (var i = 0; i < self.snake.length; i++) {
                var s = self.snake[i];
                if (s.lerpProgress < 1.0) {
                    s.lerpProgress = Math.min(1.0, s.lerpProgress + 0.2 * (dt / 16.67));
                    s.x += (s.targetX - s.x) * 0.3;
                    s.y += (s.targetY - s.y) * 0.3;
                } else {
                    s.x = s.targetX;
                    s.y = s.targetY;
                }
            }
            self.renderSnake();
            self.animate();
        });
    }

    renderSnake() {
        var old = this.container.querySelectorAll('.snake-segment');
        for (var i = 0; i < old.length; i++) old[i].remove();
        var cp = 100 / this.GRID_SIZE;

        for (var i = 0; i < this.snake.length; i++) {
            var seg = this.snake[i];
            var isHead = i === 0;
            var el = document.createElement('div');
            el.className = 'snake-segment ' + (isHead ? 'snake-head' : (i % 2 === 0 ? 'snake-body-even' : 'snake-body-odd'));
            el.style.left = (seg.x / this.GRID_SIZE) * 100 + '%';
            el.style.top = (seg.y / this.GRID_SIZE) * 100 + '%';
            el.style.width = cp + '%';
            el.style.height = cp + '%';

            if (isHead) {
                var e1 = document.createElement('div');
                var e2 = document.createElement('div');
                var ec = 'position:absolute;width:20%;height:20%;background:#0f1219;border-radius:50%;';
                e1.style.cssText = ec; e2.style.cssText = ec;
                if (this.direction.x === 1) { e1.style.right='15%'; e1.style.top='20%'; e2.style.right='15%'; e2.style.bottom='20%'; }
                else if (this.direction.x === -1) { e1.style.left='15%'; e1.style.top='20%'; e2.style.left='15%'; e2.style.bottom='20%'; }
                else if (this.direction.y === 1) { e1.style.right='20%'; e1.style.bottom='15%'; e2.style.left='20%'; e2.style.bottom='15%'; }
                else { e1.style.right='20%'; e1.style.top='15%'; e2.style.left='20%'; e2.style.top='15%'; }
                el.appendChild(e1); el.appendChild(e2);
            }
            this.container.appendChild(el);
        }
    }

    handleTouchStart(e) {
        if (e.touches.length > 0) { this.touchStartX = e.touches[0].clientX; this.touchStartY = e.touches[0].clientY; }
    }

    handleTouchEnd(e) {
        if (this.status !== 'playing' || e.changedTouches.length === 0) return;
        var dx = e.changedTouches[0].clientX - this.touchStartX;
        var dy = e.changedTouches[0].clientY - this.touchStartY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        var nd = null;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0 && this.direction.x !== -1) nd = {x:1,y:0};
            else if (dx < 0 && this.direction.x !== 1) nd = {x:-1,y:0};
        } else {
            if (dy > 0 && this.direction.y !== -1) nd = {x:0,y:1};
            else if (dy < 0 && this.direction.y !== 1) nd = {x:0,y:-1};
        }
        if (nd) this.inputBuffer.push(nd);
    }
}

/* =========================================
   2. FLASHCARDS LOGIC
   ========================================= */
class FlashcardsGameLogic {
    constructor(words, container, frontEl, backEl, revealBtn, nextBtn, prevBtn, isReverse) {
        // ZAMÍCHÁNÍ SLOVÍČEK NA ZAČÁTKU
        this.words = [...words].sort(() => Math.random() - 0.5); 
        this.container = container; this.frontEl = frontEl; this.backEl = backEl; this.revealBtn = revealBtn; this.nextBtn = nextBtn; this.prevBtn = prevBtn; this.currentIndex = 0; this.isFlipped = false; this.isReverse = isReverse;
        this._flipHandler = () => this.flip(); this._nextHandler = () => this.next(); this._prevHandler = () => this.prev();
        revealBtn.addEventListener('click', this._flipHandler); nextBtn.addEventListener('click', this._nextHandler); prevBtn.addEventListener('click', this._prevHandler);
        this.speaker = document.createElement('button'); this.speaker.innerHTML = '🔊'; this.speaker.className = 'speaker-btn'; 
        this.speaker.addEventListener('click', (e) => { e.stopPropagation(); this.speakCurrent(); });
        this.updateCard();
    }
    speakCurrent() {
        const word = this.words[this.currentIndex];
        if (!word) return;
        let textToSpeak = word.german;
        let pl = word.plural ? word.plural.trim() : '';
        if (pl && pl !== '-' && pl.indexOf('(') === -1 && pl.indexOf('/') === -1) {
            let pluralWord = pl;
            let cleanBase = word.german.replace(/^(der|die|das)\s+/i, '');
            if (pl.startsWith('-')) pluralWord = cleanBase + pl.substring(1);
            textToSpeak += ". die " + pluralWord;
        }
        speakGerman(textToSpeak);
    }
    updateCard() {
        if (!this.words || this.words.length === 0) return;
        const word = this.words[this.currentIndex];
        this.isFlipped = false;
        this.container.querySelector('.flashcard-inner').style.transform = 'rotateY(0deg)';
        setTimeout(() => {
            this.speaker.remove();
            let pl = '';
            if (word.plural && word.plural.trim() !== '' && word.plural !== '-') pl = `<div style="font-size: 0.55em; color: #fbbf24; margin-top: 5px; font-weight: 600; letter-spacing: 1px;">(Pl: ${word.plural})</div>`;
            let textWrapper = `<div style="display:flex; flex-direction:column; align-items:center;"><span>${word.german}</span>${pl}</div>`;
            if (this.isReverse) { this.frontEl.innerHTML = textWrapper; this.frontEl.appendChild(this.speaker); this.backEl.innerHTML = word.czech; } 
            else { this.frontEl.innerHTML = word.czech; this.backEl.innerHTML = textWrapper; this.backEl.appendChild(this.speaker); }
        }, 200);
    }
    flip() { this.isFlipped = !this.isFlipped; this.container.querySelector('.flashcard-inner').style.transform = this.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'; if ((this.isReverse && !this.isFlipped) || (!this.isReverse && this.isFlipped)) { this.speakCurrent(); } }
    next() { if (!this.words || this.words.length === 0) return; this.currentIndex = (this.currentIndex + 1) % this.words.length; this.updateCard(); }
    prev() { if (!this.words || this.words.length === 0) return; this.currentIndex = (this.currentIndex - 1 + this.words.length) % this.words.length; this.updateCard(); }
    destroy() { if(this.revealBtn) this.revealBtn.removeEventListener('click', this._flipHandler); if(this.nextBtn) this.nextBtn.removeEventListener('click', this._nextHandler); if(this.prevBtn) this.prevBtn.removeEventListener('click', this._prevHandler); }
}
/* =========================================
   3. QUIZ LOGIC (PLURAL MIX)
   ========================================= */
class QuizGameLogic {
    constructor(words, container, questionEl, optionsEl, feedbackEl, nextBtn, isReverse, pluralMode) {
        this.words = words; this.container = container; this.questionEl = questionEl; this.optionsEl = optionsEl; this.feedbackEl = feedbackEl; this.score = 0; this.isReverse = isReverse; this.pluralMode = pluralMode || false;
        this.pluralWords = this.words.filter(w => w.plural && w.plural.trim() !== '' && w.plural !== '-' && w.plural.indexOf('(') === -1);
        
        // VÁHOVÝ SYSTÉM
        this.weights = this.words.map(w => ({ word: w, weight: 10 }));
        this.pluralWeights = this.pluralWords.map(w => ({ word: w, weight: 10 }));
        
        this.nextQuestion();
        
    }
    
    // Získá slovo na základě váhy (čím větší váha, tím vyšší šance)
    getWeightedRandom(weightedArray) {
        let total = weightedArray.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * total;
        for (let item of weightedArray) {
            if (random < item.weight) return item.word;
            random -= item.weight;
        }
        return weightedArray[0].word;
    }

    // Upraví váhu podle toho, zda odpověděl správně
    updateWeight(weightedArray, targetWord, isCorrect) {
        let item = weightedArray.find(i => i.word === targetWord);
        
        if (item) {
            // 1. Změna váhy podle odpovědi
            if (isCorrect) {
                item.weight = item.weight / 2; // Snížíme váhu na polovinu
            } else {
                item.weight = item.weight * 2 + 50; // Tvrdá penalizace (zdvojnásobíme a přidáme)
            }
        }
        
        // 2. NORMALIZACE: Přepočet všech vah tak, aby součet byl vždy přesně 1000
        let currentSum = weightedArray.reduce((acc, val) => acc + val.weight, 0);
        
        if (currentSum > 0) {
            let factor = 1000 / currentSum; // Zjistíme, jakým číslem musíme násobit, abychom dostali 1000
            
            weightedArray.forEach(i => {
                i.weight = i.weight * factor; // Aplikujeme normu
                
                // Pojistka: Váha nesmí klesnout pod 1, aby šance nikdy nebyla absolutní nula (0 %)
                if (i.weight < 1) i.weight = 1; 
            });
        }
    }
    

    clean(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); }
    buildPlural(word) {
        var base = word.german; var pl = word.plural.trim();
        if (!pl || pl === '-') return null; if (pl.indexOf('(') !== -1) return null;
        if (pl.startsWith('-')) { var clean = base.replace(/^(der|die|das)\s+/i, ''); return clean + pl.substring(1); }
        return pl;
    }
    nextQuestion() {
        if (!this.words || this.words.length < 4) { this.questionEl.textContent = "Mindestens 4 W\u00f6rter n\u00f6tig!"; return; }
        this.feedbackEl.textContent = ''; this.optionsEl.innerHTML = '';
        if (this.pluralMode && this.pluralWords.length >= 4) this.askPlural();
        else this.askNormal();
    }
    askNormal() {
        this.currentType = 'normal';
        this.currentAnswer = this.getWeightedRandom(this.weights); // CHYTRÝ VÝBĚR

        if (this.isReverse) { this.questionEl.textContent = this.currentAnswer.german; speakGerman(this.currentAnswer.german); } 
        else { this.questionEl.textContent = this.clean(this.currentAnswer.czech); }

        var options = [this.currentAnswer];
        while (options.length < 4) {
            var w = this.words[Math.floor(Math.random() * this.words.length)];
            if (options.indexOf(w) === -1) options.push(w);
        }
        options.sort(() => Math.random() - 0.5);

        var self = this;
        options.forEach(opt => {
            var btn = document.createElement('button'); btn.className = 'game-btn secondary quiz-option-btn';
            btn.textContent = self.isReverse ? self.clean(opt.czech) : opt.german;
            btn.addEventListener('click', () => self.checkNormal(opt, btn));
            self.optionsEl.appendChild(btn);
        });
    }
    askPlural() {
        this.currentType = 'plural';
        this.currentPluralWord = this.getWeightedRandom(this.pluralWeights); // CHYTRÝ VÝBĚR
        var correctPlural = this.buildPlural(this.currentPluralWord);
        if (!correctPlural) { this.askNormal(); return; }
        this.correctPluralText = correctPlural;

        var baseWord = this.currentPluralWord.german.replace(/^(der|die|das)\s+/i, '');
        this.questionEl.innerHTML = '<span style="color:#b2bec3;font-size:0.85em;">Plural von:</span><br>' + baseWord;
        speakGerman(baseWord);

        var options = [correctPlural];
        var safety = 0;
        while (options.length < 4 && safety < 50) {
            safety++; var rw = this.pluralWords[Math.floor(Math.random() * this.pluralWords.length)]; var rp = this.buildPlural(rw);
            if (rp && options.indexOf(rp) === -1) options.push(rp);
        }
        while (options.length < 4) {
            var rw2 = this.words[Math.floor(Math.random() * this.words.length)]; var fb = rw2.german.replace(/^(der|die|das)\s+/i, '') + 'e';
            if (options.indexOf(fb) === -1) options.push(fb);
        }
        options.sort(() => Math.random() - 0.5);

        var self = this;
        options.forEach(optText => {
            var btn = document.createElement('button'); btn.className = 'game-btn secondary quiz-option-btn'; btn.textContent = optText;
            btn.addEventListener('click', () => self.checkPlural(optText, btn));
            self.optionsEl.appendChild(btn);
        });
    }
    checkNormal(selected, btn) {
        var buttons = this.optionsEl.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
        if (selected === this.currentAnswer) {
            btn.style.backgroundColor = '#10b981'; btn.style.borderColor = '#10b981'; this.score++; this.feedbackEl.textContent = 'Richtig!'; this.feedbackEl.style.color = '#10b981';
            this.updateWeight(this.weights, this.currentAnswer, true); // Znal = menší šance
        } else {
            btn.style.backgroundColor = '#ef4444'; btn.style.borderColor = '#ef4444';
            var ct = this.isReverse ? this.clean(this.currentAnswer.czech) : this.currentAnswer.german;
            this.feedbackEl.textContent = 'Falsch! Richtig: ' + ct; this.feedbackEl.style.color = '#ef4444';
            this.updateWeight(this.weights, this.currentAnswer, false); // NEZNAL = VĚTŠÍ ŠANCE
        }
        speakGerman(this.currentAnswer.german);
        setTimeout(() => this.nextQuestion(), 1500);
    }
    checkPlural(selectedText, btn) {
        var buttons = this.optionsEl.querySelectorAll('button'); buttons.forEach(b => b.disabled = true);
        if (selectedText === this.correctPluralText) {
            btn.style.backgroundColor = '#10b981'; btn.style.borderColor = '#10b981'; this.score++; this.feedbackEl.textContent = 'Richtig!'; this.feedbackEl.style.color = '#10b981';
            this.updateWeight(this.pluralWeights, this.currentPluralWord, true);
        } else {
            btn.style.backgroundColor = '#ef4444'; btn.style.borderColor = '#ef4444'; this.feedbackEl.textContent = 'Falsch! Richtig: ' + this.correctPluralText; this.feedbackEl.style.color = '#ef4444';
            this.updateWeight(this.pluralWeights, this.currentPluralWord, false);
        }
        speakGerman(this.correctPluralText);
        setTimeout(() => this.nextQuestion(), 1500);
    }
    destroy() {}
}
/* =========================================
   4. MEMORY LOGIC (PLURAL MIX + MODE)
   ========================================= */
class MemoryGameLogic {
    constructor(words, container, pluralMode) {
        this.allWords = words;
        this.container = container;
        this.pluralMode = pluralMode || false;

        this.boardEl = container.querySelector('#memory-board');
        this.statusEl = container.querySelector('#memory-status');
        this.scoreBoard = container.querySelector('.memory-scoreboard');
        this.modeSelect = container.querySelector('#memory-mode-select');
        this.p1El = container.querySelector('#p1-score');
        this.p2El = container.querySelector('#p2-score');
        this.s1El = container.querySelector('#score-val-1');
        this.s2El = container.querySelector('#score-val-2');
        this.btnSolo = container.querySelector('#btn-solo');
        this.btnMulti = container.querySelector('#btn-multi');

        this.flippedCards = [];
        this.matchedCount = 0;
        this.lockBoard = false;
        this.mode = 'solo';
        this.currentPlayer = 1;
        this.scores = { 1: 0, 2: 0 };
        this.words = [];

        this.pluralWords = this.allWords.filter(function(w) {
            return w.plural && w.plural.trim() !== '' && w.plural !== '-'
                && w.plural.indexOf('(') === -1;
        });

        this._soloHandler = this.startGame.bind(this, 'solo');
        this._multiHandler = this.startGame.bind(this, 'multi');
        this.btnSolo.addEventListener('click', this._soloHandler);
        this.btnMulti.addEventListener('click', this._multiHandler);

        this.resetUI();
    }

    buildPlural(word) {
        var pl = word.plural.trim();
        if (!pl || pl === '-' || pl.indexOf('(') !== -1) return null;
        if (pl.startsWith('-')) {
            return word.german.replace(/^(der|die|das)\s+/i, '') + pl.substring(1);
        }
        return pl;
    }

    resetUI() {
        this.modeSelect.style.display = 'flex';
        this.scoreBoard.style.display = 'none';
        this.boardEl.style.display = 'none';
        this.statusEl.textContent = '';
    }

    startGame(mode) {
        this.mode = mode;
        this.modeSelect.style.display = 'none';
        this.boardEl.style.display = 'grid';
        this.matchedCount = 0;
        this.scores = { 1: 0, 2: 0 };
        this.currentPlayer = 1;
        this.flippedCards = [];
        this.lockBoard = false;

        if (this.pluralMode && this.pluralWords.length >= 2) {
            this.statusEl.textContent = 'Mix: \u00dcbersetzung + Plural';
        } else {
            this.statusEl.textContent = 'Finde die Paare';
        }

        if (this.mode === 'multi') {
            this.scoreBoard.style.display = 'flex';
            this.statusEl.textContent += ' \u2013 Spieler 1';
        } else {
            this.scoreBoard.style.display = 'none';
        }

        this.initBoard();
    }

    clean(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); }

    initBoard() {
        var maxPairs = 8;
        var cards = [];
        var self = this;
        var usedIds = new Set();

        if (this.pluralMode && this.pluralWords.length >= 2) {
            // MIX: polovina plural páry, polovina DE↔CZ páry
            var numPluralPairs = Math.min(Math.floor(maxPairs / 2), this.pluralWords.length);
            var numNormalPairs = maxPairs - numPluralPairs;

            // Zamíchej plural slova
            var shuffledPlural = this.pluralWords.slice().sort(function() { return Math.random() - 0.5; });
            var shuffledNormal = this.allWords.slice().sort(function() { return Math.random() - 0.5; });

            // Plural páry
            for (var i = 0; i < numPluralPairs && i < shuffledPlural.length; i++) {
                var w = shuffledPlural[i];
                var plural = this.buildPlural(w);
                if (!plural) { numNormalPairs++; continue; }
                var singular = w.german.replace(/^(der|die|das)\s+/i, '');
                var id = 'pl_' + w.german;
                cards.push({ id: id, text: singular, side: 'a', speakText: w.german, isPlural: true });
                cards.push({ id: id, text: plural, side: 'b', speakText: plural, isPlural: true });
                usedIds.add(w.german);
            }

            // Normální DE↔CZ páry (vyhnout se duplicitám)
            var normalAdded = 0;
            for (var i = 0; i < shuffledNormal.length && normalAdded < numNormalPairs; i++) {
                var w = shuffledNormal[i];
                if (usedIds.has(w.german)) continue;
                var id = 'tr_' + w.german;
                cards.push({ id: id, text: w.german, side: 'a', speakText: w.german, isPlural: false });
                cards.push({ id: id, text: self.clean(w.czech), side: 'b', speakText: null, isPlural: false });
                usedIds.add(w.german);
                normalAdded++;
            }
        } else {
            // Jen normální
            var shuffled = this.allWords.slice().sort(function() { return Math.random() - 0.5; }).slice(0, maxPairs);
            shuffled.forEach(function(w) {
                var id = 'tr_' + w.german;
                cards.push({ id: id, text: w.german, side: 'a', speakText: w.german, isPlural: false });
                cards.push({ id: id, text: self.clean(w.czech), side: 'b', speakText: null, isPlural: false });
            });
        }

        if (cards.length < 4) {
            this.statusEl.textContent = "Zu wenig W\u00f6rter!";
            return;
        }

        cards.sort(function() { return Math.random() - 0.5; });

        this.boardEl.innerHTML = '';
        this.totalCards = cards.length;

        cards.forEach(function(cd) {
            var card = document.createElement('div');
            card.className = 'memory-card';
            card.dataset.id = cd.id;
            card.dataset.side = cd.side;
            if (cd.speakText) card.dataset.speak = cd.speakText;
            if (cd.isPlural) card.dataset.plural = '1';

            var label = cd.isPlural ? '<span class="memory-plural-badge">\u2605</span>' : '';
            card.innerHTML = '<span class="memory-text">' + label + cd.text + '</span>';
            card.style.cssText = 'background-color:#151922;border:2px solid rgba(16,185,129,0.2);aspect-ratio:1/1;width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:5px;cursor:pointer;border-radius:8px;user-select:none;transition:transform 0.2s,background-color 0.2s;color:#ffffff;font-weight:bold;box-shadow:0 4px 6px -1px rgba(0,0,0,0.2);word-break:break-word;font-size:clamp(0.7rem,2vw,1rem);';
            card.querySelector('.memory-text').style.cssText = 'opacity:0;transition:opacity 0.2s;';
            card.addEventListener('click', function() { self.flipCard(card); });
            self.boardEl.appendChild(card);
        });

        if (this.mode === 'multi') this.updatePlayerUI();
    }

    flipCard(card) {
        if (this.lockBoard || card === this.flippedCards[0] || card.classList.contains('matched')) return;
        card.style.backgroundColor = 'rgba(16,185,129,0.1)';
        card.style.borderColor = card.dataset.plural === '1' ? '#fbbf24' : '#10b981';
        card.style.color = card.dataset.plural === '1' ? '#fbbf24' : '#10b981';
        card.style.transform = 'scale(1.05)';
        card.querySelector('.memory-text').style.opacity = '1';
        if (card.dataset.speak) speakGerman(card.dataset.speak);
        this.flippedCards.push(card);
        if (this.flippedCards.length === 2) this.checkForMatch();
    }

    checkForMatch() {
        this.lockBoard = true;
        var c1 = this.flippedCards[0], c2 = this.flippedCards[1];
        var isMatch = c1.dataset.id === c2.dataset.id && c1.dataset.side !== c2.dataset.side;
        var self = this;
        if (isMatch) setTimeout(function() { self.handleMatch(c1, c2); }, 500);
        else setTimeout(function() { self.handleMismatch(c1, c2); }, 1200);
    }

    handleMatch(c1, c2) {
        c1.classList.add('matched'); c2.classList.add('matched');
        var ms = function(c) {
            var isPl = c.dataset.plural === '1';
            c.style.backgroundColor = isPl ? '#b45309' : '#10b981';
            c.style.borderColor = isPl ? '#fbbf24' : '#10b981';
            c.style.color = 'white'; c.style.cursor = 'default';
        };
        ms(c1); ms(c2);
        if (this.mode === 'multi') { this.scores[this.currentPlayer]++; this.updatePlayerUI(); }
        this.resetTurn(false);
        this.matchedCount += 2;
        if (this.matchedCount >= this.totalCards) this.endGame();
    }

    handleMismatch(c1, c2) {
        var rs = function(c) { c.style.backgroundColor='#151922'; c.style.borderColor='rgba(16,185,129,0.2)'; c.style.color='#ffffff'; c.style.transform='scale(1)'; c.querySelector('.memory-text').style.opacity='0'; };
        rs(c1); rs(c2);
        if (this.mode === 'multi') { this.currentPlayer = this.currentPlayer === 1 ? 2 : 1; this.updatePlayerUI(); }
        this.resetTurn(this.mode === 'multi');
    }

    resetTurn(switched) {
        this.flippedCards = []; this.lockBoard = false;
        if (this.mode === 'multi') {
            this.statusEl.textContent = switched ? 'Spieler ' + this.currentPlayer + ' ist dran' : 'Spieler ' + this.currentPlayer + ' \u2013 Paar gefunden!';
        }
    }

    updatePlayerUI() {
        this.s1El.textContent = this.scores[1]; this.s2El.textContent = this.scores[2];
        if (this.currentPlayer === 1) { this.p1El.classList.add('active-turn'); this.p2El.classList.remove('active-turn'); }
        else { this.p1El.classList.remove('active-turn'); this.p2El.classList.add('active-turn'); }
    }

    endGame() {
        var msg = '';
        if (this.mode === 'multi') {
            if (this.scores[1] > this.scores[2]) msg = '\ud83c\udf89 Spieler 1 gewinnt! (' + this.scores[1] + ':' + this.scores[2] + ')';
            else if (this.scores[2] > this.scores[1]) msg = '\ud83c\udf89 Spieler 2 gewinnt! (' + this.scores[2] + ':' + this.scores[1] + ')';
            else msg = '\ud83e\udd1d Unentschieden! (' + this.scores[1] + ':' + this.scores[1] + ')';
        } else {
            msg = '<span style="color:#10b981;font-size:1.5rem">Sieg! Gut gemacht!</span>';
        }
        this.statusEl.innerHTML = '';
        this.boardEl.innerHTML = '<div class="memory-winner-msg">' + msg + '</div>';
        this.boardEl.style.display = 'block';
    }

    destroy() {
        if (this.btnSolo) this.btnSolo.removeEventListener('click', this._soloHandler);
        if (this.btnMulti) this.btnMulti.removeEventListener('click', this._multiHandler);
    }
}

/* =========================================
   5. TYPING LOGIC (PLURAL MIX)
   ========================================= */
class TypingGameLogic {
    constructor(words, container, promptEl, inputEl, checkBtn, hintBtn, feedbackEl, nextBtn, isReverse, pluralMode) {
        this.words = words; this.container = container; this.promptEl = promptEl; this.inputEl = inputEl; this.feedbackEl = feedbackEl; this.checkBtn = checkBtn; this.hintBtn = hintBtn; this.isReverse = isReverse; this.pluralMode = pluralMode || false;
        this.pluralWords = this.words.filter(w => w.plural && w.plural.trim() !== '' && w.plural !== '-' && w.plural.indexOf('(') === -1);
        
        // VÁHOVÝ SYSTÉM
        this.weights = this.words.map(w => ({ word: w, weight: 10 }));
        this.pluralWeights = this.pluralWords.map(w => ({ word: w, weight: 10 }));

        this.checkBtn.addEventListener('click', () => this.check());
        this.hintBtn.addEventListener('click', () => this.showHint());
        this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.check(); });

        this.nextWord();
        
    }
    getWeightedRandom(weightedArray) {
        let total = weightedArray.reduce((sum, item) => sum + item.weight, 0); let random = Math.random() * total;
        for (let item of weightedArray) { if (random < item.weight) return item.word; random -= item.weight; }
        return weightedArray[0].word;
    }
    updateWeight(weightedArray, targetWord, isCorrect) {
        let item = weightedArray.find(i => i.word === targetWord);
        
        if (item) {
            // 1. Změna váhy podle odpovědi
            if (isCorrect) {
                item.weight = item.weight / 2; // Snížíme váhu na polovinu
            } else {
                item.weight = item.weight * 2 + 50; // Tvrdá penalizace (zdvojnásobíme a přidáme)
            }
        }
        
        // 2. NORMALIZACE: Přepočet všech vah tak, aby součet byl vždy přesně 1000
        let currentSum = weightedArray.reduce((acc, val) => acc + val.weight, 0);
        
        if (currentSum > 0) {
            let factor = 1000 / currentSum; // Zjistíme, jakým číslem musíme násobit, abychom dostali 1000
            
            weightedArray.forEach(i => {
                i.weight = i.weight * factor; // Aplikujeme normu
                
                // Pojistka: Váha nesmí klesnout pod 1, aby šance nikdy nebyla absolutní nula (0 %)
                if (i.weight < 1) i.weight = 1; 
            });
        }
    }
    
    clean(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); }
    buildPlural(word) {
        var pl = word.plural.trim(); if (!pl || pl === '-' || pl.indexOf('(') !== -1) return null;
        if (pl.startsWith('-')) { var clean = word.german.replace(/^(der|die|das)\s+/i, ''); return clean + pl.substring(1); }
        return pl;
    }
    nextWord() {
        if (!this.words || this.words.length === 0) return;
        this.inputEl.value = ''; this.feedbackEl.textContent = '';
        var title = this.container.querySelector('h3');

        if (this.pluralMode && this.pluralWords.length >= 3) {
            this.currentType = 'plural';
            this.target = this.getWeightedRandom(this.pluralWeights); // CHYTRÝ VÝBĚR
            this.correctAnswer = this.buildPlural(this.target);
            if (!this.correctAnswer) { this.currentType = 'normal'; this.askNormal(title); this.inputEl.focus(); return; }
            var baseWord = this.target.german.replace(/^(der|die|das)\s+/i, '');
            if (title) title.textContent = 'Schreib den Plural:';
            this.promptEl.innerHTML = baseWord + ' <span style="color:#b2bec3;font-size:0.8em;">(Plural?)</span>';
            speakGerman(baseWord);
        } else {
            this.currentType = 'normal';
            this.askNormal(title);
        }
        this.inputEl.focus();
    }
    askNormal(title) {
        this.target = this.getWeightedRandom(this.weights); // CHYTRÝ VÝBĚR
        if (this.isReverse) {
            if (title) title.textContent = '\u00dcbersetze ins Tschechische:'; this.promptEl.textContent = this.target.german; this.correctAnswer = this.clean(this.target.czech); speakGerman(this.target.german);
        } else {
            if (title) title.textContent = '\u00dcbersetze ins Deutsche:'; this.promptEl.textContent = this.clean(this.target.czech); this.correctAnswer = this.target.german;
        }
    }
    check() {
        var input = this.inputEl.value.trim().toLowerCase();
        var correct = this.correctAnswer.toLowerCase();
        if (input === correct) {
            this.feedbackEl.textContent = 'Richtig!'; this.feedbackEl.style.color = '#10b981';
            if (this.currentType === 'plural') this.updateWeight(this.pluralWeights, this.target, true); else this.updateWeight(this.weights, this.target, true);
            speakGerman(this.currentType === 'plural' ? this.correctAnswer : this.target.german);
            setTimeout(() => this.nextWord(), 1000);
        } else {
            this.feedbackEl.textContent = 'Falsch. Richtig: ' + this.correctAnswer; this.feedbackEl.style.color = '#ef4444';
            if (this.currentType === 'plural') this.updateWeight(this.pluralWeights, this.target, false); else this.updateWeight(this.weights, this.target, false);
            speakGerman(this.currentType === 'plural' ? this.correctAnswer : this.target.german);
        }
    }
    showHint() { if (this.correctAnswer) { this.inputEl.value = this.correctAnswer.substring(0, 3); this.inputEl.focus(); } }
    destroy() {}
}
/* =========================================
   6. SENTENCE BUILDER LOGIC
   ========================================= */
class SentenceGameLogic {
    constructor(sentences, container, promptEl, areaEl, bankEl, checkBtn, feedbackEl) { this.sentences = sentences || []; this.container = container; this.promptEl = promptEl; this.areaEl = areaEl; this.bankEl = bankEl; this.checkBtn = checkBtn; this.feedbackEl = feedbackEl; this.currentSentence = []; this.builtSentence = []; this.checkBtn.addEventListener('click', () => this.check()); this.nextRound(); }
    nextRound() { if (!this.sentences || this.sentences.length === 0) { this.promptEl.innerHTML = "Keine Sätze gefunden!"; this.bankEl.innerHTML = ""; return; } this.feedbackEl.textContent = ''; this.areaEl.innerHTML = ''; this.bankEl.innerHTML = ''; this.areaEl.className = 'sentence-area'; this.builtSentence = []; const target = this.sentences[Math.floor(Math.random() * this.sentences.length)]; this.currentSentence = target.german.split(' '); this.promptEl.textContent = target.czech; let partsForBank = [...this.currentSentence]; partsForBank.sort(() => Math.random() - 0.5); partsForBank.forEach((word) => { const el = document.createElement('div'); el.className = 'sentence-word'; el.textContent = word; el.addEventListener('click', () => this.moveToArea(el, word)); this.bankEl.appendChild(el); }); }
    moveToArea(el, word) { if (el.classList.contains('used')) return; el.classList.add('used'); const inArea = document.createElement('div'); inArea.className = 'sentence-word'; inArea.textContent = word; inArea.addEventListener('click', () => { inArea.remove(); el.classList.remove('used'); const index = this.builtSentence.indexOf(word); if (index > -1) this.builtSentence.splice(index, 1); }); this.areaEl.appendChild(inArea); this.builtSentence.push(word); }
    check() { const attempt = this.builtSentence.join(" "); const correct = this.currentSentence.join(" "); if (attempt === correct) { this.feedbackEl.textContent = "Perfekt!"; this.feedbackEl.style.color = '#10b981'; this.areaEl.classList.add('correct-flash'); speakGerman(correct); setTimeout(() => this.nextRound(), 2500); } else { this.feedbackEl.textContent = "Versuch es nochmal."; this.feedbackEl.style.color = '#ef4444'; this.areaEl.classList.add('wrong-flash'); setTimeout(() => this.areaEl.classList.remove('wrong-flash'), 500); } }
    destroy() {}
}

/* =========================================
   7. GAME MANAGER
   ========================================= */
class GameManager {
    constructor() {
        this.gameCards = document.querySelectorAll('.game-card');
        this.activeContainer = document.getElementById('activeGameContainer');
        this.gameViewport = document.getElementById('gameViewport');
        this.backBtn = document.querySelector('#activeGameContainer .back-btn');
        this.restartBtn = document.querySelector('.restart-btn');
        this.pluralBtn = document.getElementById('pluralToggleBtn');
        this.words = []; this.sentences = []; this.activeGame = null; this.currentGameId = null;
        
        this.options = { reverse: false, plural: false };
        this.setupListeners();
    }

    setupListeners() {
        var self = this;
        this.gameCards.forEach(function(card) { card.addEventListener('click', function() { self.openGame(card.dataset.game); }); });
        if (this.backBtn) this.backBtn.addEventListener('click', function() { self.closeActiveGame(); });
        if (this.restartBtn) this.restartBtn.addEventListener('click', function() { self.restartActiveGame(); });
        if (this.pluralBtn) this.pluralBtn.addEventListener('click', function() { self.togglePlural(); });
    }

    togglePlural() {
        this.options.plural = !this.options.plural;
        if (this.pluralBtn) {
            this.pluralBtn.textContent = 'Plural: ' + (this.options.plural ? 'An' : 'Aus');
            if (this.options.plural) this.pluralBtn.classList.add('active');
            else this.pluralBtn.classList.remove('active');
        }
        if (this.activeGame && this.currentGameId) this.restartActiveGame();
    }

    setData(words, sentences) { this.words = words || []; this.sentences = sentences || []; }
    setOptions(options) { var p = this.options.plural; this.options = { plural: p, reverse: false, ...options }; }

    openGame(gameId) {
        if (this.words.length === 0) { alert("W\u00e4hle zuerst eine Lektion!"); return; }
        this.currentGameId = gameId;
        this.activeContainer.classList.remove('hidden');
        this.gameViewport.innerHTML = '';
        var isReverse = this.options.reverse;
        var isPlural = this.options.plural;

        var pluralGames = ['quiz', 'memory', 'typing'];
        if (this.pluralBtn) {
            this.pluralBtn.style.display = pluralGames.indexOf(gameId) !== -1 ? 'inline-block' : 'none';
        }

        if (gameId === 'snake') { var ui = this._createSnakeUI(); this.gameViewport.appendChild(ui.container); this.activeGame = new SnakeGameLogic(this.words, ui.gameArea, ui.gridBackground, ui.scoreEl, ui.highScoreEl, ui.targetWordEl, ui.overlay, ui.overlayTitle, ui.overlayBtn, ui.speedEl, isReverse); }
        else if (gameId === 'flashcards') { var ui = this._createFlashcardsUI(); this.gameViewport.appendChild(ui.container); this.activeGame = new FlashcardsGameLogic(this.words, ui.container, ui.frontEl, ui.backEl, ui.revealBtn, ui.nextBtn, ui.prevBtn, isReverse); }
        else if (gameId === 'quiz') { var ui = this._createQuizUI(); this.gameViewport.appendChild(ui.container); this.activeGame = new QuizGameLogic(this.words, ui.container, ui.questionEl, ui.optionsEl, ui.feedbackEl, null, isReverse, isPlural); }
        else if (gameId === 'memory') { var ui = this._createMemoryUI(); this.gameViewport.appendChild(ui.container); this.activeGame = new MemoryGameLogic(this.words, ui.container, isPlural); }
        else if (gameId === 'typing') { var ui = this._createTypingUI(); this.gameViewport.appendChild(ui.container); this.activeGame = new TypingGameLogic(this.words, ui.container, ui.promptEl, ui.inputEl, ui.checkBtn, ui.hintBtn, ui.feedbackEl, null, isReverse, isPlural); }
        else if (gameId === 'sentences') { var ui = this._createSentenceUI(); this.gameViewport.appendChild(ui.container); this.activeGame = new SentenceGameLogic(this.sentences, ui.container, ui.promptEl, ui.areaEl, ui.bankEl, ui.checkBtn, ui.feedbackEl); }

        this.activeContainer.scrollIntoView({ behavior: 'smooth' });
    }

    closeActiveGame() {
        if (this.activeGame && typeof this.activeGame.destroy === 'function') this.activeGame.destroy();
        this.activeGame = null; window.speechSynthesis.cancel();
        this.gameViewport.innerHTML = ''; this.activeContainer.classList.add('hidden'); this.currentGameId = null;
        
    }

    restartActiveGame() {
        if (this.activeGame && this.currentGameId) {
            if (typeof this.activeGame.destroy === 'function') this.activeGame.destroy();
            this.openGame(this.currentGameId);
        }
    }

    _createSnakeUI() {
        var c = document.createElement('div');
        c.className = 'snake-game-container';
        c.innerHTML = '<div class="snake-header"><div class="snake-stats"><div><div>Punkte</div><span id="snakeScore">0</span></div><div><div>Tempo</div><span id="snakeSpeed">1.0x</span></div><div><div>Rekord</div><span id="snakeHigh">0</span></div></div><div class="snake-word-display"><div class="snake-word-label">Ziel</div><h2 class="snake-target-word" id="snakeTarget">Schlangen Spiel</h2></div></div><div class="snake-game-area"><div class="snake-grid-background"></div><div class="snake-overlay"><div class="snake-overlay-card"><h2>Schlangen Spiel</h2><p>Sammle die richtigen \u00dcbersetzungen.</p><button class="snake-btn">Start</button></div></div></div>' +
        '<div class="snake-dpad"><button class="dpad-btn" data-dir="up">▲</button><div class="dpad-row"><button class="dpad-btn" data-dir="left">◀</button><button class="dpad-btn" data-dir="right">▶</button></div><button class="dpad-btn" data-dir="down">▼</button></div>';
        return { container: c, gameArea: c.querySelector('.snake-game-area'), gridBackground: c.querySelector('.snake-grid-background'), scoreEl: c.querySelector('#snakeScore'), highScoreEl: c.querySelector('#snakeHigh'), targetWordEl: c.querySelector('#snakeTarget'), overlay: c.querySelector('.snake-overlay'), overlayTitle: c.querySelector('.snake-overlay h2'), overlayBtn: c.querySelector('.snake-btn'), speedEl: c.querySelector('#snakeSpeed') };
    }
    _createFlashcardsUI() { var c = document.createElement('div'); c.className = 'flashcard-game-container'; c.style.cssText = 'display:flex;flex-direction:column;align-items:center;height:100%;justify-content:center;gap:20px;'; c.innerHTML = '<div class="flashcard" style="width:300px;height:300px;perspective:1000px;cursor:pointer;"><div class="flashcard-inner" style="width:100%;height:100%;position:relative;text-align:center;transition:transform 0.6s;transform-style:preserve-3d;"><div class="fc-front" style="position:absolute;width:100%;height:100%;backface-visibility:hidden;background:#151922;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid rgba(16,185,129,0.2);border-radius:12px;font-size:1.8rem;font-weight:bold;padding:20px;word-break:break-word;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);"></div><div class="fc-back" style="position:absolute;width:100%;height:100%;backface-visibility:hidden;background:#10b981;color:#fff;transform:rotateY(180deg);display:flex;align-items:center;justify-content:center;border:2px solid #34d399;border-radius:12px;font-size:1.8rem;font-weight:bold;padding:20px;word-break:break-word;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);"></div></div></div><div class="controls" style="display:flex;gap:10px;"><button class="game-btn secondary" id="fc-prev">Zur\u00fcck</button><button class="game-btn" id="fc-flip">Umdrehen</button><button class="game-btn secondary" id="fc-next">Weiter</button></div>'; return { container: c, frontEl: c.querySelector('.fc-front'), backEl: c.querySelector('.fc-back'), revealBtn: c.querySelector('#fc-flip'), nextBtn: c.querySelector('#fc-next'), prevBtn: c.querySelector('#fc-prev') }; }
    _createQuizUI() { var c = document.createElement('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:2rem;width:100%;'; c.innerHTML = '<h2 id="quiz-question" style="margin-bottom:2rem;font-size:2rem;text-align:center;"></h2><div id="quiz-options" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;width:100%;max-width:600px;"></div><div id="quiz-feedback" style="margin-top:1.5rem;font-weight:bold;min-height:24px;font-size:1.2rem;"></div>'; return { container: c, questionEl: c.querySelector('#quiz-question'), optionsEl: c.querySelector('#quiz-options'), feedbackEl: c.querySelector('#quiz-feedback') }; }
    _createMemoryUI() { var c = document.createElement('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:20px;height:100%;overflow-y:auto;width:100%;'; c.innerHTML = '<div id="memory-mode-select" class="memory-mode-select"><h2 style="color:white;margin-bottom:20px;">Modus w\u00e4hlen</h2><button id="btn-solo" class="memory-mode-btn">Solo (1 Spieler)</button><button id="btn-multi" class="memory-mode-btn">Duell (2 Spieler)</button></div><div class="memory-scoreboard" style="display:none;"><div id="p1-score" class="player-score active-turn">Spieler 1 <span id="score-val-1">0</span></div><div id="p2-score" class="player-score">Spieler 2 <span id="score-val-2">0</span></div></div><div id="memory-status" style="text-align:center;margin-bottom:1rem;min-height:24px;color:#b2bec3;"></div><div id="memory-board" style="display:none;grid-template-columns:repeat(4,1fr);gap:10px;width:100%;max-width:600px;"></div>'; return { container: c }; }
    _createTypingUI() { var c = document.createElement('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;'; c.innerHTML = '<h3>\u00dcbersetze:</h3><h2 id="type-prompt" style="color:#10b981;"></h2><input type="text" id="type-input" style="padding:10px;font-size:1.2rem;border-radius:5px;border:1px solid rgba(16,185,129,0.2);background:#151922;color:white;" autocomplete="off"><div style="display:flex;gap:10px;"><button class="game-btn" id="type-check">Pr\u00fcfen</button><button class="game-btn secondary" id="type-hint">Hinweis</button></div><div id="type-feedback" style="min-height:20px;"></div>'; return { container: c, promptEl: c.querySelector('#type-prompt'), inputEl: c.querySelector('#type-input'), checkBtn: c.querySelector('#type-check'), hintBtn: c.querySelector('#type-hint'), feedbackEl: c.querySelector('#type-feedback') }; }
    _createSentenceUI() { var c = document.createElement('div'); c.className = 'sentence-container'; c.innerHTML = '<div id="sent-prompt" class="sentence-prompt"></div><div id="sent-area" class="sentence-area"></div><div id="sent-bank" class="word-bank"></div><div style="display:flex;justify-content:center;"><button class="game-btn" id="sent-check">Pr\u00fcfen</button></div><div id="sent-feedback" style="text-align:center;font-weight:bold;font-size:1.2rem;min-height:30px;"></div>'; return { container: c, promptEl: c.querySelector('#sent-prompt'), areaEl: c.querySelector('#sent-area'), bankEl: c.querySelector('#sent-bank'), checkBtn: c.querySelector('#sent-check'), feedbackEl: c.querySelector('#sent-feedback') }; }
}
window.GameManager = new GameManager();



function updateDebugWeights(weights, pluralWeights) {
    let panel = document.getElementById('weight-debug-panel');
    
    // Pokud je přepínač vypnutý, panel schováme a dál nepočítáme
    if (!window.srsEnabled) {
        if (panel) panel.style.display = 'none';
        return;
    }

    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'weight-debug-panel';
        document.body.appendChild(panel);
    }
    
    let html = '<h3>Wortgewichte (Chancen)</h3><ul>';
    let allWeights = [];
    
    if (weights) allWeights = allWeights.concat(weights.map(w => ({ text: w.word.german, weight: w.weight })));
    if (pluralWeights) allWeights = allWeights.concat(pluralWeights.map(w => ({ text: w.word.german + ' (Pl)', weight: w.weight })));
    
    // Výpočet SUMY všech vah (Tvůj jmenovatel pro výpočet procent!)
    let totalWeight = allWeights.reduce((sum, item) => sum + item.weight, 0);
    
    // Seřadit od největší šance
    allWeights.sort((a, b) => b.weight - a.weight);
    
    allWeights.forEach(item => {
        let color = item.weight > 10 ? '#ef4444' : (item.weight < 10 ? '#10b981' : '#b2bec3');
        // TVOJE ROVNICE V AKCI: 100 * (váha / suma)
        let percent = totalWeight > 0 ? (100 * (item.weight / totalWeight)).toFixed(1) : 0;
        
        html += `<li><span title="${item.text}">${item.text}</span> <strong style="color:${color}">${percent} %</strong></li>`;
    });
    
    html += '</ul>';
    panel.innerHTML = html;
    panel.style.display = 'block';
}

function hideDebugWeights() {
    let panel = document.getElementById('weight-debug-panel');
    if (panel) panel.style.display = 'none';
}
function updateDebugWeights(weights, pluralWeights) {
    let panel = document.getElementById('weight-debug-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'weight-debug-panel';
        document.body.appendChild(panel);
    }
    
    let html = '<h3>Wortgewichte</h3><ul>';
    let allWeights = [];
    
    if (weights) allWeights = allWeights.concat(weights.map(w => ({ text: w.word.german, weight: w.weight })));
    if (pluralWeights) allWeights = allWeights.concat(pluralWeights.map(w => ({ text: w.word.german + ' (Pl)', weight: w.weight })));
    
    // Seřadit od největší váhy (nejproblémovější slova nahoře)
    allWeights.sort((a, b) => b.weight - a.weight);
    
    allWeights.forEach(item => {
        let color = item.weight > 10 ? '#ef4444' : (item.weight < 10 ? '#10b981' : '#b2bec3');
        html += `<li><span title="${item.text}">${item.text}</span> <strong style="color:${color}">${item.weight.toFixed(1)}</strong></li>`;
    });
    
    html += '</ul>';
    panel.innerHTML = html;
    panel.style.display = 'block';
}

function hideDebugWeights() {
    let panel = document.getElementById('weight-debug-panel');
    if (panel) panel.style.display = 'none';
}
