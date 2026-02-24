/* =========================================
   GLOBAL HELPER: TEXT TO SPEECH
   ========================================= */
function speakGerman(text) {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(v => v.lang.includes('de'));
    if (germanVoice) utterance.voice = germanVoice;
    window.speechSynthesis.speak(utterance);
}

/* =========================================
   [SNAKE, FLASHCARDS, QUIZ, MEMORY, TYPING - ZŮSTÁVAJÍ STEJNÉ]
   ========================================= */
   
/* =========================================
   1. SNAKE GAME LOGIC 
   ========================================= */
class SnakeGameLogic {
    constructor(words, container, gridBackground, scoreEl, highScoreEl, targetWordEl, overlay, overlayTitle, overlayBtn, speedEl, isReverse) {
        if (!words || words.length === 0) { this.words = []; } else { this.isReverse = isReverse; this.words = this.convertWordsForSnake(words); }
        this.container = container; this.gridBackground = gridBackground; this.scoreEl = scoreEl; this.highScoreEl = highScoreEl; this.targetWordEl = targetWordEl; this.overlay = overlay; this.overlayTitle = overlayTitle; this.overlayBtn = overlayBtn; this.speedEl = speedEl; this.gameType = 'snake'; this.GRID_SIZE = 16; this.BASE_SPEED = 250; this.currentSpeed = this.BASE_SPEED; this.speedMultiplier = 1.0; this.wordsCollected = 0; this.INITIAL_SNAKE = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }]; this.INITIAL_DIRECTION = { x: 1, y: 0 }; this.snake = []; this.direction = { ...this.INITIAL_DIRECTION }; this.nextDirection = { ...this.INITIAL_DIRECTION }; this.inputBuffer = []; this.MAX_BUFFER_SIZE = 3; this.status = 'idle'; this.score = 0; this.highScore = parseInt(localStorage.getItem('snake-german-highscore') || '0', 10); this.targetWord = null; this.fieldWords = []; this.gameInterval = null; this.lastFrameTime = 0; this.animationFrameId = null; this.init();
    }
    convertWordsForSnake(words) { const clean = (text) => text.split(',')[0].replace(/\(.*\)/g, '').trim(); return words.map(word => { if (this.isReverse) { return { targetDisplay: word.german, collectItem: clean(word.czech), speak: word.german }; } else { return { targetDisplay: clean(word.czech), collectItem: word.german, speak: word.german }; } }); }
    init() { this.snake = this.INITIAL_SNAKE.map(p => ({ x: p.x, y: p.y, targetX: p.x, targetY: p.y, lerpProgress: 1.0 })); this.updateUI(); this.renderGridBackground(); this._boundKeyDown = (e) => this.handleGlobalKeyDown(e); window.addEventListener('keydown', this._boundKeyDown); this._overlayBtnHandler = () => this.startGame(); if (this.overlayBtn) this.overlayBtn.addEventListener('click', this._overlayBtnHandler); this._touchStartHandler = (e) => this.handleTouchStart(e); this._touchEndHandler = (e) => this.handleTouchEnd(e); this._touchMoveHandler = (e) => { if (this.status === 'playing') e.preventDefault(); }; document.addEventListener('touchstart', this._touchStartHandler, { passive: false }); document.addEventListener('touchend', this._touchEndHandler, { passive: false }); document.addEventListener('touchmove', this._touchMoveHandler, { passive: false }); }
    destroy() { if (this._boundKeyDown) window.removeEventListener('keydown', this._boundKeyDown); if (this.overlayBtn && this._overlayBtnHandler) this.overlayBtn.removeEventListener('click', this._overlayBtnHandler); if (this._touchStartHandler) document.removeEventListener('touchstart', this._touchStartHandler); if (this._touchEndHandler) document.removeEventListener('touchend', this._touchEndHandler); if (this._touchMoveHandler) document.removeEventListener('touchmove', this._touchMoveHandler); clearInterval(this.gameInterval); if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId); this.status = 'idle'; }
    handleGlobalKeyDown(e) { const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D']; if (gameKeys.includes(e.key) && (this.status === 'playing' || !this.overlay.classList.contains('hidden'))) { e.preventDefault(); } if (this.gameType === 'snake' && this.status === 'playing') { this.handleKeyInput(e); } else if ((this.status === 'idle' || this.status === 'gameover') && (e.key === 'Enter' || e.key === ' ')) { if (!this.overlay.classList.contains('hidden')) this.startGame(); } }
    handleKeyInput(e) { let newDirection = null; switch (e.key) { case 'ArrowUp': case 'w': case 'W': if (this.direction.y !== 1) newDirection = { x: 0, y: -1 }; break; case 'ArrowDown': case 's': case 'S': if (this.direction.y !== -1) newDirection = { x: 0, y: 1 }; break; case 'ArrowLeft': case 'a': case 'A': if (this.direction.x !== 1) newDirection = { x: -1, y: 0 }; break; case 'ArrowRight': case 'd': case 'D': if (this.direction.x !== -1) newDirection = { x: 1, y: 0 }; break; } if (newDirection) { if (this.inputBuffer.length < this.MAX_BUFFER_SIZE) this.inputBuffer.push(newDirection); else { this.inputBuffer.shift(); this.inputBuffer.push(newDirection); } } }
    processInputBuffer() { if (this.inputBuffer.length > 0) { const nextDir = this.inputBuffer[0]; if (this.direction.x !== -nextDir.x || this.direction.y !== -nextDir.y) { this.nextDirection = nextDir; this.inputBuffer.shift(); } else { this.inputBuffer = []; } } }
    startGame() { if (!this.words || this.words.length < 5) { alert("Du brauchst mindestens 5 Wörter für Snake!"); return; } this.snake = this.INITIAL_SNAKE.map(p => ({ x: p.x, y: p.y, targetX: p.x, targetY: p.y, lerpProgress: 1.0 })); this.direction = { ...this.INITIAL_DIRECTION }; this.nextDirection = { ...this.INITIAL_DIRECTION }; this.inputBuffer = []; this.score = 0; this.wordsCollected = 0; this.currentSpeed = this.BASE_SPEED; this.speedMultiplier = 1.0; this.status = 'playing'; this.updateUI(); this.generateNewRound(); if (this.gameInterval) clearInterval(this.gameInterval); this.gameInterval = setInterval(() => this.gameLogicUpdate(), this.currentSpeed); this.lastFrameTime = performance.now(); this.animate(); this.overlay.classList.add('hidden'); }
    gameLogicUpdate() { if (this.status !== 'playing') return; this.processInputBuffer(); this.direction = this.nextDirection; const currentHead = this.snake[0]; const newHead = { x: currentHead.targetX + this.direction.x, y: currentHead.targetY + this.direction.y, targetX: currentHead.targetX + this.direction.x, targetY: currentHead.targetY + this.direction.y, lerpProgress: 0.0 }; if (newHead.targetX < 0 || newHead.targetX >= this.GRID_SIZE || newHead.targetY < 0 || newHead.targetY >= this.GRID_SIZE) { this.gameOver(); return; } const hitWordIndex = this.fieldWords.findIndex(w => Math.round(w.position.x) === newHead.targetX && Math.round(w.position.y) === newHead.targetY); let isGrowing = false, shouldShrink = false; if (hitWordIndex !== -1) { const hitWord = this.fieldWords[hitWordIndex]; if (hitWord.isCorrect) { isGrowing = true; this.wordsCollected++; speakGerman(this.isReverse ? this.targetWord.targetDisplay : this.targetWord.collectItem); if (this.wordsCollected % 3 === 0) this.increaseSpeed(); } else { shouldShrink = true; } } const ignoreTailIndex = isGrowing ? -1 : this.snake.length - 1; const isSelfCollision = this.snake.some((segment, index) => { if (index === ignoreTailIndex) return false; return Math.round(segment.targetX) === newHead.targetX && Math.round(segment.targetY) === newHead.targetY; }); if (isSelfCollision) { this.gameOver(); return; } if (isGrowing) { this.snake.unshift(newHead); } else if (shouldShrink) { let tempSnake = [newHead, ...this.snake]; if (tempSnake.length <= 3) { this.gameOver(); return; } this.snake = tempSnake.slice(0, tempSnake.length - 3); this.fieldWords.splice(hitWordIndex, 1); } else { for (let i = this.snake.length - 1; i > 0; i--) { this.snake[i].targetX = this.snake[i-1].targetX; this.snake[i].targetY = this.snake[i-1].targetY; this.snake[i].lerpProgress = 0.0; } this.snake[0] = newHead; } if (isGrowing) this.generateNewRound(); this.updateUI(); }
    increaseSpeed() { this.speedMultiplier *= 0.95; this.currentSpeed = Math.max(50, Math.floor(this.BASE_SPEED * this.speedMultiplier)); if (this.gameInterval) { clearInterval(this.gameInterval); this.gameInterval = setInterval(() => this.gameLogicUpdate(), this.currentSpeed); } this.showSpeedUpEffect(); }
    showSpeedUpEffect() { const effect = document.createElement('div'); effect.textContent = '⚡ Schneller!'; effect.style.cssText = `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; font-weight: bold; color: #10b981; text-shadow: 0 0 10px rgba(16, 185, 129, 0.8); opacity: 0; z-index: 40; pointer-events: none; animation: speedUpAnim 1s ease-out;`; if (!document.getElementById('speedUpStyle')) { const style = document.createElement('style'); style.id = 'speedUpStyle'; style.textContent = `@keyframes speedUpAnim { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1); } }`; document.head.appendChild(style); } this.container.appendChild(effect); setTimeout(() => effect.remove(), 1000); }
    gameOver() { this.status = 'gameover'; clearInterval(this.gameInterval); if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId); const finalScore = this.snake.length; if (finalScore > this.highScore) { this.highScore = finalScore; localStorage.setItem('snake-german-highscore', this.highScore.toString()); } this.updateUI(); this.overlayTitle.innerText = `Game Over - Punkte: ${finalScore}`; this.overlayBtn.innerText = 'Neustart'; this.overlay.classList.remove('hidden'); }
    generateNewRound() { const randomPair = this.words[Math.floor(Math.random() * this.words.length)]; this.targetWord = randomPair; const wrongWords = []; let loopSafety = 0; while (wrongWords.length < 4 && loopSafety < 100) { loopSafety++; const p = this.words[Math.floor(Math.random() * this.words.length)]; if (p.collectItem !== randomPair.collectItem && !wrongWords.includes(p.collectItem)) { wrongWords.push(p.collectItem); } } const head = this.snake[0]; const safetyZone = new Set(); for (let i = 1; i <= 3; i++) safetyZone.add(`${head.targetX + this.direction.x * i},${head.targetY + this.direction.y * i}`); safetyZone.add(`${head.targetX - this.direction.y},${head.targetY + this.direction.x}`); safetyZone.add(`${head.targetX + this.direction.y},${head.targetY - this.direction.x}`); const finalPositions = []; let attempts = 0; const maxAttempts = 500; while (finalPositions.length < 5 && attempts < maxAttempts) { attempts++; const cx = Math.floor(Math.random() * this.GRID_SIZE); const cy = Math.floor(Math.random() * this.GRID_SIZE); const key = `${cx},${cy}`; const onSnake = this.snake.some(s => Math.round(s.targetX) === cx && Math.round(s.targetY) === cy); if (onSnake || safetyZone.has(key)) continue; let isFarEnough = true; for (const pos of finalPositions) { if (Math.abs(pos.x - cx) < 3 && Math.abs(pos.y - cy) < 3) { isFarEnough = false; break; } } if (isFarEnough) finalPositions.push({ x: cx, y: cy }); } const count = Math.min(finalPositions.length, wrongWords.length + 1); const wordsToSpawn = [{ text: randomPair.collectItem, isCorrect: true }]; for(let i=0; i<count-1; i++) { if(wrongWords[i]) wordsToSpawn.push({ text: wrongWords[i], isCorrect: false }); } for (let i = wordsToSpawn.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [wordsToSpawn[i], wordsToSpawn[j]] = [wordsToSpawn[j], wordsToSpawn[i]]; } this.fieldWords = wordsToSpawn.map((w, i) => ({ id: Math.random().toString(36).substr(2, 9), text: w.text, isCorrect: w.isCorrect, position: finalPositions[i] })); }
    updateUI() { if (this.scoreEl) this.scoreEl.innerText = this.snake.length; if (this.highScoreEl) this.highScoreEl.innerText = this.highScore; if (this.speedEl) this.speedEl.innerText = `${(1/this.speedMultiplier).toFixed(1)}x`; if (this.targetWordEl) this.targetWordEl.innerText = (this.status === 'playing' && this.targetWord) ? this.targetWord.targetDisplay : (this.status === 'gameover' ? 'Game Over' : 'Snake Deutsch'); }
    renderGridBackground() { this.gridBackground.innerHTML = ''; for (let i = 0; i < this.GRID_SIZE * this.GRID_SIZE; i++) { const cell = document.createElement('div'); cell.className = 'snake-grid-cell'; this.gridBackground.appendChild(cell); } }
    animate() { this.animationFrameId = requestAnimationFrame((timestamp) => { const deltaTime = timestamp - this.lastFrameTime; this.lastFrameTime = timestamp; const lerpSpeed = 0.2; this.snake.forEach(segment => { if (segment.lerpProgress < 1.0) { segment.lerpProgress = Math.min(1.0, segment.lerpProgress + lerpSpeed * (deltaTime / 16.67)); segment.x = segment.x + (segment.targetX - segment.x) * 0.2; segment.y = segment.y + (segment.targetY - segment.y) * 0.2; } else { segment.x = segment.targetX; segment.y = segment.targetY; } }); this.renderGame(); this.animate(); }); }
    renderGame() { const dynamicElements = this.container.querySelectorAll('.snake-segment, .snake-word-item, .snake-grid-marker'); dynamicElements.forEach(el => el.remove()); this.snake.forEach((segment, index) => { const isHead = index === 0; const el = document.createElement('div'); el.className = `snake-segment ${isHead ? 'snake-head' : (index % 2 === 0 ? 'snake-body-even' : 'snake-body-odd')}`; el.style.left = `${(segment.x / this.GRID_SIZE) * 100}%`; el.style.top = `${(segment.y / this.GRID_SIZE) * 100}%`; el.style.width = `${100 / this.GRID_SIZE}%`; el.style.height = `${100 / this.GRID_SIZE}%`; el.style.backgroundColor = '#10b981'; if (isHead) { el.style.backgroundColor = '#ef4444'; const eye1 = document.createElement('div'); const eye2 = document.createElement('div'); const eyeStyle = `position: absolute; width: 20%; height: 20%; background: #0f1219; border-radius: 50%;`; eye1.style.cssText = eyeStyle; eye2.style.cssText = eyeStyle; if (this.direction.x === 1) { eye1.style.right = '15%'; eye1.style.top = '20%'; eye2.style.right = '15%'; eye2.style.bottom = '20%'; } else if (this.direction.x === -1) { eye1.style.left = '15%'; eye1.style.top = '20%'; eye2.style.left = '15%'; eye2.style.bottom = '20%'; } else if (this.direction.y === 1) { eye1.style.right = '20%'; eye1.style.bottom = '15%'; eye2.style.left = '20%'; eye2.style.bottom = '15%'; } else { eye1.style.right = '20%'; eye1.style.top = '15%'; eye2.style.left = '20%'; eye2.style.top = '15%'; } el.appendChild(eye1); el.appendChild(eye2); } this.container.appendChild(el); }); this.fieldWords.forEach(word => { const marker = document.createElement('div'); marker.className = 'snake-grid-marker'; marker.style.left = `${(word.position.x / this.GRID_SIZE) * 100}%`; marker.style.top = `${(word.position.y / this.GRID_SIZE) * 100}%`; marker.style.width = `${100 / this.GRID_SIZE}%`; marker.style.height = `${100 / this.GRID_SIZE}%`; this.container.appendChild(marker); const el = document.createElement('div'); el.className = 'snake-word-item'; el.style.left = `${(word.position.x / this.GRID_SIZE) * 100}%`; el.style.top = `${(word.position.y / this.GRID_SIZE) * 100}%`; el.style.width = `${100 / this.GRID_SIZE}%`; el.style.height = `${100 / this.GRID_SIZE}%`; const tag = document.createElement('div'); tag.className = 'snake-word-tag'; tag.innerText = word.text; tag.style.cssText = `opacity: 1; background-color: #151922; color: #ffffff; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 4px; font-size: 0.7rem; box-shadow: 0 2px 4px rgba(0,0,0,0.3); position: absolute; white-space: nowrap; z-index: 10; top: 50%;`; if (word.position.x < 2) { tag.style.left = '0'; tag.style.transform = 'translate(0, -50%)'; } else if (word.position.x > this.GRID_SIZE - 3) { tag.style.right = '0'; tag.style.left = 'auto'; tag.style.transform = 'translate(0, -50%)'; } else { tag.style.left = '50%'; tag.style.transform = 'translate(-50%, -50%)'; } el.appendChild(tag); this.container.appendChild(el); }); }
    handleTouchStart(e) { if (e.touches.length > 0) { this.touchStartX = e.touches[0].clientX; this.touchStartY = e.touches[0].clientY; } }
    handleTouchEnd(e) { if (this.status !== 'playing' || e.changedTouches.length === 0) return; const dx = e.changedTouches[0].clientX - this.touchStartX; const dy = e.changedTouches[0].clientY - this.touchStartY; if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return; let newDir = null; if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0 && this.direction.x !== -1) newDir = { x: 1, y: 0 }; else if (dx < 0 && this.direction.x !== 1) newDir = { x: -1, y: 0 }; } else { if (dy > 0 && this.direction.y !== -1) newDir = { x: 0, y: 1 }; else if (dy < 0 && this.direction.y !== 1) newDir = { x: 0, y: -1 }; } if (newDir) this.inputBuffer.push(newDir); }
}

/* =========================================
   2. FLASHCARDS LOGIC
   ========================================= */
class FlashcardsGameLogic {
    constructor(words, container, frontEl, backEl, revealBtn, nextBtn, prevBtn, isReverse) {
        this.words = words; this.container = container; this.frontEl = frontEl; this.backEl = backEl; this.revealBtn = revealBtn; this.nextBtn = nextBtn; this.prevBtn = prevBtn; this.currentIndex = 0; this.isFlipped = false; this.isReverse = isReverse;
        this._flipHandler = () => this.flip(); this._nextHandler = () => this.next(); this._prevHandler = () => this.prev();
        revealBtn.addEventListener('click', this._flipHandler); nextBtn.addEventListener('click', this._nextHandler); prevBtn.addEventListener('click', this._prevHandler);
        this.speaker = document.createElement('button'); this.speaker.innerHTML = '🔊'; this.speaker.className = 'speaker-btn'; this.speaker.addEventListener('click', (e) => { e.stopPropagation(); const word = this.words[this.currentIndex]; speakGerman(word.german); });
        this.updateCard();
    }
    updateCard() { if (!this.words || this.words.length === 0) return; const word = this.words[this.currentIndex]; this.isFlipped = false; this.container.querySelector('.flashcard-inner').style.transform = 'rotateY(0deg)'; setTimeout(() => { this.speaker.remove(); if (this.isReverse) { this.frontEl.textContent = word.german; this.frontEl.appendChild(this.speaker); this.backEl.textContent = word.czech; } else { this.frontEl.textContent = word.czech; this.backEl.textContent = word.german; this.backEl.appendChild(this.speaker); } }, 200); }
    flip() { this.isFlipped = !this.isFlipped; this.container.querySelector('.flashcard-inner').style.transform = this.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'; const word = this.words[this.currentIndex]; if ((this.isReverse && !this.isFlipped) || (!this.isReverse && this.isFlipped)) { speakGerman(word.german); } }
    next() { if (!this.words || this.words.length === 0) return; this.currentIndex = (this.currentIndex + 1) % this.words.length; this.updateCard(); }
    prev() { if (!this.words || this.words.length === 0) return; this.currentIndex = (this.currentIndex - 1 + this.words.length) % this.words.length; this.updateCard(); }
    destroy() { if(this.revealBtn) this.revealBtn.removeEventListener('click', this._flipHandler); if(this.nextBtn) this.nextBtn.removeEventListener('click', this._nextHandler); if(this.prevBtn) this.prevBtn.removeEventListener('click', this._prevHandler); }
}

/* =========================================
   3. QUIZ LOGIC
   ========================================= */
class QuizGameLogic {
    constructor(words, container, questionEl, optionsEl, feedbackEl, nextBtn, isReverse) { this.words = words; this.container = container; this.questionEl = questionEl; this.optionsEl = optionsEl; this.feedbackEl = feedbackEl; this.score = 0; this.isReverse = isReverse; this.nextQuestion(); }
    clean(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); }
    nextQuestion() { if (!this.words || this.words.length < 4) { this.questionEl.textContent = "Du brauchst mindestens 4 Wörter für das Quiz!"; return; } this.feedbackEl.textContent = ''; this.optionsEl.innerHTML = ''; const target = this.words[Math.floor(Math.random() * this.words.length)]; this.currentAnswer = target; if (this.isReverse) { this.questionEl.textContent = target.german; speakGerman(target.german); } else { this.questionEl.textContent = this.clean(target.czech); } let options = [target]; while(options.length < 4) { const w = this.words[Math.floor(Math.random() * this.words.length)]; if(!options.includes(w)) options.push(w); } options.sort(() => Math.random() - 0.5); options.forEach(opt => { const btn = document.createElement('button'); btn.className = 'game-btn secondary'; btn.style.cssText = `display: flex; align-items: center; justify-content: center; padding: 1.5rem; font-size: 1.1rem; height: 100%; width: 100%; min-height: 80px; background-color: rgba(16, 185, 129, 0.05); color: #ffffff; border: 1px solid rgba(16, 185, 129, 0.2);`; if (this.isReverse) { btn.textContent = this.clean(opt.czech); } else { btn.textContent = opt.german; } btn.addEventListener('click', () => this.checkAnswer(opt, btn)); this.optionsEl.appendChild(btn); }); }
    checkAnswer(selected, btn) { const buttons = this.optionsEl.querySelectorAll('button'); buttons.forEach(b => b.disabled = true); if (selected === this.currentAnswer) { btn.style.backgroundColor = '#10b981'; btn.style.borderColor = '#10b981'; this.score++; this.feedbackEl.textContent = 'Richtig!'; this.feedbackEl.style.color = '#10b981'; speakGerman(this.currentAnswer.german); } else { btn.style.backgroundColor = '#ef4444'; btn.style.borderColor = '#ef4444'; const correctText = this.isReverse ? this.clean(this.currentAnswer.czech) : this.currentAnswer.german; this.feedbackEl.textContent = `Falsch! Richtig ist: ${correctText}`; this.feedbackEl.style.color = '#ef4444'; speakGerman(this.currentAnswer.german); } setTimeout(() => this.nextQuestion(), 1500); }
    destroy() {} 
}

/* =========================================
   4. MEMORY LOGIC
   ========================================= */
class MemoryGameLogic {
    constructor(words, container, boardEl, statusEl) { this.words = words.slice(0, 8); this.boardEl = boardEl; this.statusEl = statusEl; this.flippedCards = []; this.matchedCount = 0; this.lockBoard = false; this.initBoard(); }
    clean(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); }
    initBoard() { if (this.words.length < 2) { this.statusEl.textContent = "Wähle eine Lektion mit mehr Wörtern!"; return; } let cards = []; this.words.forEach(w => { cards.push({ id: w.german, text: w.german, isGerman: true }); cards.push({ id: w.german, text: this.clean(w.czech), isGerman: false }); }); cards.sort(() => Math.random() - 0.5); this.boardEl.innerHTML = ''; this.boardEl.style.display = 'grid'; this.boardEl.style.gridTemplateColumns = 'repeat(4, 1fr)'; this.boardEl.style.gap = '15px'; this.boardEl.style.width = '100%'; this.boardEl.style.maxWidth = '600px'; cards.forEach(cardData => { const card = document.createElement('div'); card.className = 'memory-card'; card.dataset.id = cardData.id; card.dataset.isGerman = cardData.isGerman; card.innerHTML = `<span class="memory-text">${cardData.text}</span>`; card.style.cssText = `background-color: #151922; border: 2px solid rgba(16, 185, 129, 0.2); aspect-ratio: 1 / 1; width: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 5px; cursor: pointer; border-radius: 8px; user-select: none; transition: transform 0.2s, background-color 0.2s; color: #ffffff; font-weight: bold; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); word-break: break-word; font-size: clamp(0.7rem, 2vw, 1rem);`; const textSpan = card.querySelector('.memory-text'); textSpan.style.opacity = '0'; textSpan.style.transition = 'opacity 0.2s'; card.addEventListener('click', () => this.flipCard(card)); this.boardEl.appendChild(card); }); }
    flipCard(card) { if (this.lockBoard || card === this.flippedCards[0] || card.classList.contains('matched')) return; card.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; card.style.borderColor = '#10b981'; card.style.color = '#10b981'; card.style.transform = 'scale(1.05)'; card.querySelector('.memory-text').style.opacity = '1'; if (card.dataset.isGerman === "true") { speakGerman(card.querySelector('.memory-text').textContent); } this.flippedCards.push(card); if (this.flippedCards.length === 2) { this.checkForMatch(); } }
    checkForMatch() { this.lockBoard = true; const [card1, card2] = this.flippedCards; const isMatch = card1.dataset.id === card2.dataset.id; if (isMatch) { setTimeout(() => { card1.classList.add('matched'); card2.classList.add('matched'); card1.style.backgroundColor = '#10b981'; card1.style.borderColor = '#10b981'; card1.style.color = 'white'; card2.style.backgroundColor = '#10b981'; card2.style.borderColor = '#10b981'; card2.style.color = 'white'; card1.style.cursor = 'default'; card2.style.cursor = 'default'; this.matchedCount += 2; this.resetBoard(); if (this.matchedCount === this.words.length * 2) { this.statusEl.innerHTML = '<span style="color:#10b981; font-size:1.5rem">Sieg! Gut gemacht!</span>'; } }, 500); } else { setTimeout(() => { const resetStyle = (c) => { c.style.backgroundColor = '#151922'; c.style.borderColor = 'rgba(16, 185, 129, 0.2)'; c.style.color = '#ffffff'; c.style.transform = 'scale(1)'; c.querySelector('.memory-text').style.opacity = '0'; }; resetStyle(card1); resetStyle(card2); this.resetBoard(); }, 1000); } }
    resetBoard() { this.flippedCards = []; this.lockBoard = false; }
    destroy() {}
}

/* =========================================
   5. TYPING LOGIC
   ========================================= */
class TypingGameLogic {
    constructor(words, container, promptEl, inputEl, checkBtn, hintBtn, feedbackEl, nextBtn, isReverse) { this.words = words; this.container = container; this.promptEl = promptEl; this.inputEl = inputEl; this.feedbackEl = feedbackEl; this.checkBtn = checkBtn; this.hintBtn = hintBtn; this.isReverse = isReverse; const title = this.container.querySelector('h3'); if (title) title.textContent = this.isReverse ? "Übersetze ins Tschechische:" : "Übersetze ins Deutsche:"; this.checkBtn.addEventListener('click', () => this.check()); this.hintBtn.addEventListener('click', () => this.showHint()); this.nextWord(); }
    clean(text) { return text.split(',')[0].replace(/\(.*\)/g, '').trim(); }
    nextWord() { if (!this.words || this.words.length === 0) return; this.target = this.words[Math.floor(Math.random() * this.words.length)]; if (this.isReverse) { this.promptEl.textContent = this.target.german; speakGerman(this.target.german); } else { this.promptEl.textContent = this.clean(this.target.czech); } this.inputEl.value = ''; this.feedbackEl.textContent = ''; this.inputEl.focus(); }
    check() { const inputVal = this.inputEl.value.trim().toLowerCase(); let correctVal = this.isReverse ? this.clean(this.target.czech).toLowerCase() : this.target.german.toLowerCase(); if (inputVal === correctVal) { this.feedbackEl.textContent = 'Richtig!'; this.feedbackEl.style.color = '#10b981'; speakGerman(this.target.german); setTimeout(() => this.nextWord(), 1000); } else { this.feedbackEl.textContent = `Falsch. Richtig ist: ${this.isReverse ? this.clean(this.target.czech) : this.target.german}`; this.feedbackEl.style.color = '#ef4444'; speakGerman(this.target.german); } }
    showHint() { const targetText = this.isReverse ? this.clean(this.target.czech) : this.target.german; if (targetText) { const hint = targetText.substring(0, 3); this.inputEl.value = hint; this.inputEl.focus(); } }
    destroy() {}
}

/* =========================================
   6. SENTENCE BUILDER LOGIC (PURE DATA DRIVEN)
   ========================================= */
class SentenceGameLogic {
    constructor(sentences, container, promptEl, areaEl, bankEl, checkBtn, feedbackEl) {
        // Accept direct sentence objects: { german: "...", czech: "..." }
        this.sentences = sentences || [];
        
        this.container = container;
        this.promptEl = promptEl;
        this.areaEl = areaEl;
        this.bankEl = bankEl;
        this.checkBtn = checkBtn;
        this.feedbackEl = feedbackEl;
        
        this.currentSentence = [];
        this.builtSentence = [];

        this.checkBtn.addEventListener('click', () => this.check());
        this.nextRound();
    }

    nextRound() {
        if (!this.sentences || this.sentences.length === 0) {
            this.promptEl.innerHTML = "Keine Sätze für die gewählten Lektionen gefunden!";
            this.bankEl.innerHTML = "";
            return;
        }

        this.feedbackEl.textContent = '';
        this.areaEl.innerHTML = '';
        this.bankEl.innerHTML = '';
        this.areaEl.className = 'sentence-area';
        this.builtSentence = [];

        // Pick a random sentence object
        const target = this.sentences[Math.floor(Math.random() * this.sentences.length)];
        
        // Split German sentence into words (tokenize)
        // Basic regex to keep punctuation attached or split? 
        // Simple approach: Split by spaces.
        this.currentSentence = target.german.split(' ');

        // Show Czech prompt
        this.promptEl.textContent = target.czech;

        // Create Shuffle Bank
        let partsForBank = [...this.currentSentence];
        partsForBank.sort(() => Math.random() - 0.5);

        partsForBank.forEach((word) => {
            const el = document.createElement('div');
            el.className = 'sentence-word';
            el.textContent = word;
            el.addEventListener('click', () => {
                // Optional: Speak word on click? speakGerman(word);
                this.moveToArea(el, word);
            });
            this.bankEl.appendChild(el);
        });
    }

    moveToArea(el, word) {
        if (el.classList.contains('used')) return;
        el.classList.add('used');
        const inArea = document.createElement('div');
        inArea.className = 'sentence-word';
        inArea.textContent = word;
        inArea.addEventListener('click', () => {
            inArea.remove();
            el.classList.remove('used');
            // Remove first occurrence
            const index = this.builtSentence.indexOf(word);
            if (index > -1) this.builtSentence.splice(index, 1);
        });
        this.areaEl.appendChild(inArea);
        this.builtSentence.push(word);
    }

    check() {
        const attempt = this.builtSentence.join(" ");
        const correct = this.currentSentence.join(" ");

        if (attempt === correct) {
            this.feedbackEl.textContent = "Perfekt!";
            this.feedbackEl.style.color = '#10b981';
            this.areaEl.classList.add('correct-flash');
            speakGerman(correct); // Speak full German sentence
            setTimeout(() => this.nextRound(), 2500);
        } else {
            this.feedbackEl.textContent = "Versuch es nochmal.";
            this.feedbackEl.style.color = '#ef4444';
            this.areaEl.classList.add('wrong-flash');
            setTimeout(() => this.areaEl.classList.remove('wrong-flash'), 500);
        }
    }
    destroy() {}
}

/* =========================================
   7. GAME MANAGER (UPDATED)
   ========================================= */
class GameManager {
    constructor() {
        this.gameCards = document.querySelectorAll('.game-card');
        this.activeContainer = document.getElementById('activeGameContainer');
        this.gameViewport = document.getElementById('gameViewport');
        this.backBtn = document.querySelector('#activeGameContainer .back-btn');
        this.restartBtn = document.querySelector('.restart-btn');
        this.words = [];
        this.sentences = []; // NEW: Store sentences
        this.activeGame = null;
        this.currentGameId = null; 
        this.options = { reverse: false };

        this.setupListeners();
    }

    setupListeners() {
        this.gameCards.forEach(card => {
            card.addEventListener('click', () => this.openGame(card.dataset.game));
        });
        if (this.backBtn) this.backBtn.addEventListener('click', () => this.closeActiveGame());
        if (this.restartBtn) this.restartBtn.addEventListener('click', () => this.restartActiveGame());
    }

    // NEW METHOD SIGNATURE
    setData(words, sentences) {
        this.words = words || [];
        this.sentences = sentences || [];
        console.log(`GameManager: ${this.words.length} words, ${this.sentences.length} sentences.`);
    }

    // OLD METHOD BACKWARD COMPATIBILITY
    setWords(words) {
        this.words = words || [];
    }

    setOptions(options) {
        this.options = { ...this.options, ...options };
    }

    openGame(gameId) {
        if (this.words.length === 0) {
            alert("Wähle zuerst eine Lektion und Seiten im Bereich 'Lernen' aus!");
            return;
        }

        this.currentGameId = gameId; 
        this.activeContainer.classList.remove('hidden');
        this.gameViewport.innerHTML = '';
        const isReverse = this.options.reverse;

        if (gameId === 'snake') {
            const ui = this._createSnakeUI();
            this.gameViewport.appendChild(ui.container);
            this.activeGame = new SnakeGameLogic(this.words, ui.gameArea, ui.gridBackground, ui.scoreEl, ui.highScoreEl, ui.targetWordEl, ui.overlay, ui.overlayTitle, ui.overlayBtn, ui.speedEl, isReverse);
        } else if (gameId === 'flashcards') {
            const ui = this._createFlashcardsUI();
            this.gameViewport.appendChild(ui.container);
            this.activeGame = new FlashcardsGameLogic(this.words, ui.container, ui.frontEl, ui.backEl, ui.revealBtn, ui.nextBtn, ui.prevBtn, isReverse);
        } else if (gameId === 'quiz') {
            const ui = this._createQuizUI();
            this.gameViewport.appendChild(ui.container);
            this.activeGame = new QuizGameLogic(this.words, ui.container, ui.questionEl, ui.optionsEl, ui.feedbackEl, ui.nextBtn, isReverse);
        } else if (gameId === 'memory') {
            const ui = this._createMemoryUI();
            this.gameViewport.appendChild(ui.container);
            this.activeGame = new MemoryGameLogic(this.words, ui.container, ui.boardEl, ui.statusEl);
        } else if (gameId === 'typing') {
            const ui = this._createTypingUI();
            this.gameViewport.appendChild(ui.container);
            this.activeGame = new TypingGameLogic(this.words, ui.container, ui.promptEl, ui.inputEl, ui.checkBtn, ui.hintBtn, ui.feedbackEl, ui.nextBtn, isReverse);
        } else if (gameId === 'sentences') {
            const ui = this._createSentenceUI();
            this.gameViewport.appendChild(ui.container);
            // PASS SENTENCES INSTEAD OF WORDS
            this.activeGame = new SentenceGameLogic(this.sentences, ui.container, ui.promptEl, ui.areaEl, ui.bankEl, ui.checkBtn, ui.feedbackEl);
        }
    }

    closeActiveGame() {
        if (this.activeGame) {
            if (typeof this.activeGame.destroy === 'function') this.activeGame.destroy();
            this.activeGame = null;
        }
        window.speechSynthesis.cancel();
        this.gameViewport.innerHTML = '';
        this.activeContainer.classList.add('hidden');
        this.currentGameId = null;
    }

    restartActiveGame() {
        if (this.activeGame && this.currentGameId) {
            if (typeof this.activeGame.destroy === 'function') { this.activeGame.destroy(); }
            this.openGame(this.currentGameId);
        }
    }

    // --- UI CREATORS ---
    _createSnakeUI() {
        const container = document.createElement('div');
        container.className = 'snake-game-container';
        container.innerHTML = `<div class="snake-header"><div class="snake-stats"><div><div>Punkte</div><span id="snakeScore">0</span></div><div><div>Tempo</div><span id="snakeSpeed">1.0x</span></div><div><div>Rekord</div><span id="snakeHigh">0</span></div></div><div class="snake-word-display"><div class="snake-word-label">Ziel</div><h2 class="snake-target-word" id="snakeTarget">Snake Deutsch</h2></div></div><div class="snake-game-area"><div class="snake-grid-background"></div><div class="snake-overlay"><h2>Snake Deutsch</h2><p>Sammle die richtigen Übersetzungen.</p><button class="snake-btn">Start</button></div></div>`;
        return { container, gameArea: container.querySelector('.snake-game-area'), gridBackground: container.querySelector('.snake-grid-background'), scoreEl: container.querySelector('#snakeScore'), highScoreEl: container.querySelector('#snakeHigh'), targetWordEl: container.querySelector('#snakeTarget'), overlay: container.querySelector('.snake-overlay'), overlayTitle: container.querySelector('.snake-overlay h2'), overlayBtn: container.querySelector('.snake-btn'), speedEl: container.querySelector('#snakeSpeed') };
    }

    _createFlashcardsUI() {
        const container = document.createElement('div');
        container.className = 'flashcard-game-container';
        container.style.cssText = 'display:flex; flex-direction:column; align-items:center; height:100%; justify-content:center; gap: 20px;';
        container.innerHTML = `<div class="flashcard" style="width: 300px; height: 300px; perspective: 1000px; cursor: pointer;"><div class="flashcard-inner" style="width: 100%; height: 100%; position: relative; text-align: center; transition: transform 0.6s; transform-style: preserve-3d;"><div class="fc-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #151922; color: #ffffff; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(16, 185, 129, 0.2); border-radius: 12px; font-size: 1.8rem; font-weight: bold; padding: 20px; word-break: break-word; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);"></div><div class="fc-back" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #10b981; color: #ffffff; transform: rotateY(180deg); display: flex; align-items: center; justify-content: center; border: 2px solid #34d399; border-radius: 12px; font-size: 1.8rem; font-weight: bold; padding: 20px; word-break: break-word; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);"></div></div></div><div class="controls" style="display:flex; gap:10px;"><button class="game-btn secondary" id="fc-prev">Zurück</button><button class="game-btn" id="fc-flip">Umdrehen</button><button class="game-btn secondary" id="fc-next">Weiter</button></div>`;
        return { container, frontEl: container.querySelector('.fc-front'), backEl: container.querySelector('.fc-back'), revealBtn: container.querySelector('#fc-flip'), nextBtn: container.querySelector('#fc-next'), prevBtn: container.querySelector('#fc-prev') };
    }

    _createQuizUI() {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; align-items:center; padding: 2rem; width: 100%;';
        container.innerHTML = `<h2 id="quiz-question" style="margin-bottom: 2rem; font-size: 2rem; text-align: center;"></h2><div id="quiz-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; width: 100%; max-width: 600px;"></div><div id="quiz-feedback" style="margin-top: 1.5rem; font-weight: bold; min-height: 24px; font-size: 1.2rem;"></div>`;
        return { container, questionEl: container.querySelector('#quiz-question'), optionsEl: container.querySelector('#quiz-options'), feedbackEl: container.querySelector('#quiz-feedback') };
    }

    _createMemoryUI() {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; align-items:center; padding: 20px; height: 100%; overflow-y: auto;';
        container.innerHTML = `<div id="memory-status" style="text-align:center; margin-bottom:1.5rem; font-weight:bold; font-size: 1.2rem;">Finde die Paare</div><div id="memory-board" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; width: 100%; max-width: 600px;"></div>`;
        return { container, boardEl: container.querySelector('#memory-board'), statusEl: container.querySelector('#memory-status') };
    }

    _createTypingUI() {
        const container = document.createElement('div');
        container.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap: 1rem;';
        container.innerHTML = `<h3>Übersetze:</h3><h2 id="type-prompt" style="color: #10b981;"></h2><input type="text" id="type-input" style="padding: 10px; font-size: 1.2rem; border-radius: 5px; border: 1px solid rgba(16, 185, 129, 0.2); background: #151922; color: white;" autocomplete="off"><div style="display:flex; gap:10px;"><button class="game-btn" id="type-check">Prüfen</button><button class="game-btn secondary" id="type-hint">Hinweis</button></div><div id="type-feedback" style="min-height: 20px;"></div>`;
        return { container, promptEl: container.querySelector('#type-prompt'), inputEl: container.querySelector('#type-input'), checkBtn: container.querySelector('#type-check'), hintBtn: container.querySelector('#type-hint'), feedbackEl: container.querySelector('#type-feedback') };
    }

    _createSentenceUI() {
        const container = document.createElement('div');
        container.className = 'sentence-container';
        container.innerHTML = `
            <div id="sent-prompt" class="sentence-prompt"></div>
            <div id="sent-area" class="sentence-area"></div>
            <div id="sent-bank" class="word-bank"></div>
            <div style="display:flex; justify-content:center;"><button class="game-btn" id="sent-check">Prüfen</button></div>
            <div id="sent-feedback" style="text-align:center; font-weight:bold; font-size:1.2rem; min-height:30px;"></div>
        `;
        return {
            container,
            promptEl: container.querySelector('#sent-prompt'),
            areaEl: container.querySelector('#sent-area'),
            bankEl: container.querySelector('#sent-bank'),
            checkBtn: container.querySelector('#sent-check'),
            feedbackEl: container.querySelector('#sent-feedback')
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.GameManager = new GameManager();
});