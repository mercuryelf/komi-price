/* ============================================================
   Цена Севера — игровая логика
   Данные: LOTS (js/data.js, генерируется _build/build.ps1)
   ============================================================ */
(function () {
  'use strict';

  var ROUNDS = 10;
  var SLIDER_MIN = 50000;
  var SLIDER_MAX = 2000000;
  var SLIDER_START = 1000000;
  var BEST_KEY = 'sever-cena-best';

  var state = {
    lots: [],
    round: 0,
    score: 0,
    results: []
  };

  /* ---------- DOM ---------- */

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    topbar: $('topbar'),
    roundLabel: $('round-label'),
    progress: $('progress'),
    progressFill: $('progress-fill'),
    screens: {
      start: $('screen-start'),
      game: $('screen-game'),
      result: $('screen-result'),
      final: $('screen-final')
    },
    galleryTrack: $('gallery-track'),
    galleryCounter: $('gallery-counter'),
    galleryDots: $('gallery-dots'),
    lotDesc: $('lot-desc'),
    lotStreet: $('lot-street'),
    guessValue: $('guess-value'),
    slider: $('price-slider'),
    btnStart: $('btn-start'),
    btnGuess: $('btn-guess'),
    btnNext: $('btn-next'),
    btnRestart: $('btn-restart'),
    btnHome: $('btn-home'),
    bestScore: $('best-score'),
    pointsBadge: $('points-badge'),
    pointsSub: $('points-sub'),
    resultPhoto: $('result-photo-img'),
    realPrice: $('real-price'),
    guessPrice: $('guess-price'),
    diffPrice: $('diff-price'),
    diffHint: $('diff-hint'),
    btnAvito: $('btn-avito'),
    finalScore: $('final-score'),
    finalScoreSub: $('final-score-sub'),
    personaEmoji: $('persona-emoji'),
    personaTitle: $('persona-title'),
    personaText: $('persona-text'),
    finalStats: $('final-stats'),
    finalOverpay: $('final-overpay'),
    roundsList: $('rounds-list')
  };

  /* ---------- Утилиты ---------- */

  function fmt(n) {
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function fmtSigned(n) {
    var sign = n > 0 ? '+' : (n < 0 ? '−' : '');
    return sign + Math.abs(Math.round(n)).toLocaleString('ru-RU') + ' ₽';
  }

  function fmtPct(x) {
    return (Math.round(x * 10) / 10).toLocaleString('ru-RU') + '%';
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- Балльная система ----------
     Ошибка = |оценка − реальная цена| / реальная цена.
     ≤5% → 10 баллов, ≤10% → 8, ≤20% → 6, ≤30% → 4, ≤50% → 2, >50% → 0. */
  function pointsFor(errPct) {
    if (errPct <= 5) return 10;
    if (errPct <= 10) return 8;
    if (errPct <= 20) return 6;
    if (errPct <= 30) return 4;
    if (errPct <= 50) return 2;
    return 0;
  }

  /* ---------- Экраны ---------- */

  function showScreen(name) {
    Object.keys(el.screens).forEach(function (k) {
      el.screens[k].classList.toggle('hidden', k !== name);
    });
    el.topbar.classList.toggle('hidden', name === 'start' || name === 'final');
    window.scrollTo(0, 0);
  }

  /* ---------- Прогресс-бар ---------- */

  function updateProgress(assessed) {
    el.roundLabel.textContent = 'Раунд ' + (state.round + 1) + ' из ' + ROUNDS +
      ' · ' + state.score + ' балл' + plural(state.score, '', 'а', 'ов');
    var pct = (assessed / ROUNDS) * 100;
    el.progressFill.style.width = pct + '%';
    el.progress.setAttribute('aria-valuenow', assessed);
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------- Галерея ---------- */

  function renderGallery(lot) {
    el.galleryTrack.innerHTML = '';
    lot.photos.forEach(function (src, i) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Фотография квартиры ' + (i + 1);
      img.loading = i === 0 ? 'eager' : 'lazy';
      img.draggable = false;
      el.galleryTrack.appendChild(img);
    });

    el.galleryDots.innerHTML = '';
    lot.photos.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Фото ' + (i + 1));
      dot.addEventListener('click', function () {
        scrollToPhoto(i);
      });
      el.galleryDots.appendChild(dot);
    });

    updateGalleryIndex(0);
    el.galleryTrack.scrollLeft = 0;
  }

  function scrollToPhoto(i) {
    var w = el.galleryTrack.clientWidth;
    el.galleryTrack.scrollTo({ left: i * w, behavior: 'smooth' });
  }

  function updateGalleryIndex(active) {
    el.galleryCounter.textContent = (active + 1) + '/' + state.lots[state.round].photos.length;
    var dots = el.galleryDots.children;
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === active);
    }
  }

  el.galleryTrack.addEventListener('scroll', function () {
    if (el.screens.game.classList.contains('hidden')) return;
    window.requestAnimationFrame(function () {
      var w = el.galleryTrack.clientWidth || 1;
      var idx = Math.min(
        state.lots[state.round].photos.length - 1,
        Math.max(0, Math.round(el.galleryTrack.scrollLeft / w))
      );
      updateGalleryIndex(idx);
    });
  }, { passive: true });

  /* ---------- Бегунок ---------- */

  function updateSlider() {
    var v = parseInt(el.slider.value, 10);
    el.guessValue.textContent = fmt(v);
    var pct = ((v - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
    el.slider.style.setProperty('--fill', pct + '%');
  }

  el.slider.addEventListener('input', updateSlider);

  /* ---------- Раунды ---------- */

  function startGame() {
    state.lots = shuffle(LOTS.slice()).slice(0, ROUNDS);
    state.round = 0;
    state.score = 0;
    state.results = [];
    renderRound();
    showScreen('game');
  }

  function renderRound() {
    var lot = state.lots[state.round];

    renderGallery(lot);
    el.lotDesc.textContent = lot.desc;
    el.lotStreet.textContent = lot.street;

    el.slider.value = SLIDER_START;
    updateSlider();

    updateProgress(state.round);
  }

  function submitGuess() {
    var lot = state.lots[state.round];
    var guess = parseInt(el.slider.value, 10);
    var diff = guess - lot.price;
    var errPct = Math.abs(diff) / lot.price * 100;
    var pts = pointsFor(errPct);

    state.results.push({
      lot: lot,
      guess: guess,
      diff: diff,
      errPct: errPct,
      pts: pts
    });
    state.score += pts;

    renderResult(state.results[state.results.length - 1]);
    updateProgress(state.round + 1);
    showScreen('result');
  }

  function renderResult(r) {
    el.pointsBadge.textContent = '+' + r.pts + ' ' + plural(r.pts, 'балл', 'балла', 'баллов');
    el.pointsBadge.className = 'points-badge' + (r.pts === 10 ? ' p10' : (r.pts === 0 ? ' p0' : ''));
    el.pointsSub.textContent = 'Ошибка: ' + fmtPct(r.errPct) + ' от реальной цены';

    el.resultPhoto.src = r.lot.photos[0];
    el.resultPhoto.alt = r.lot.desc;

    el.realPrice.textContent = fmt(r.lot.price);
    el.guessPrice.textContent = fmt(r.guess);

    el.diffPrice.textContent = fmtSigned(r.diff);
    if (r.diff > 0) {
      el.diffPrice.className = 'compare-value over';
      el.diffHint.textContent = 'Ты оценил выше: переплата составила бы ' + fmt(r.diff);
    } else if (r.diff < 0) {
      el.diffPrice.className = 'compare-value under';
      el.diffHint.textContent = 'Ты оценил ниже реальной цены на ' + fmt(-r.diff);
    } else {
      el.diffPrice.className = 'compare-value exact';
      el.diffHint.textContent = 'Идеально! Цена угадана в точку.';
    }

    el.btnAvito.href = r.lot.url;
    el.btnNext.textContent = (state.round + 1 < ROUNDS) ? 'Следующая квартира' : 'К результатам';
  }

  function nextRound() {
    state.round++;
    if (state.round >= ROUNDS) {
      renderFinal();
      showScreen('final');
    } else {
      renderRound();
      showScreen('game');
    }
  }

  /* ---------- Финал ---------- */

  var PERSONAS = {
    greedy: {
      emoji: '🧑‍🎓',
      title: 'Жадный студент',
      text: 'Твои оценки почти всегда ниже реальных цен. Республика Коми умеет удивлять: даже за большую квартиру здесь просят меньше ста тысяч.'
    },
    adequate: {
      emoji: '🏠',
      title: 'Адекватный квартирант',
      text: 'Твои оценки в среднем совпадают с реальными ценами объявлений. Такому квартиранту можно доверить депозит.'
    },
    spendthrift: {
      emoji: '💸',
      title: 'Транжира',
      text: 'Ты готов был переплатить почти за каждую квартиру. Хорошая новость: рынок Коми был бы для тебя приятным сюрпризом.'
    }
  };

  function renderFinal() {
    el.finalScore.textContent = state.score + ' / ' + (ROUNDS * 10);
    el.finalScoreSub.textContent = 'за ' + ROUNDS + ' раундов';

    /* Амплуа — по среднему знаковому отклонению оценки от реальной цены */
    var biasSum = 0;
    var errSum = 0;
    var exact = 0;
    var overpaySum = 0;
    state.results.forEach(function (r) {
      biasSum += (r.guess - r.lot.price) / r.lot.price;
      errSum += r.errPct;
      if (r.errPct <= 5) exact++;
      overpaySum += r.diff;
    });
    var avgBias = biasSum / state.results.length * 100;
    var avgErr = errSum / state.results.length;

    var p;
    if (avgBias <= -10) p = PERSONAS.greedy;
    else if (avgBias >= 10) p = PERSONAS.spendthrift;
    else p = PERSONAS.adequate;

    el.personaEmoji.textContent = p.emoji;
    el.personaTitle.textContent = p.title;
    el.personaText.textContent = p.text;

    el.finalStats.innerHTML =
      statBox(fmtPct(avgErr), 'средняя ошибка') +
      statBox(exact + ' из ' + ROUNDS, 'точных попаданий (≤5%)');

    var op = el.finalOverpay;
    if (overpaySum > 0) {
      op.className = 'final-overpay over';
      op.textContent = 'Если бы ты покупал по своим оценкам, переплата составила бы ' + fmt(overpaySum);
    } else if (overpaySum < 0) {
      op.className = 'final-overpay under';
      op.textContent = 'Твои оценки ниже рынка: экономия составила бы ' + fmt(-overpaySum);
    } else {
      op.className = 'final-overpay under';
      op.textContent = 'Твои оценки сошлись с ценами в копейку!';
    }

    /* Список по раундам */
    el.roundsList.innerHTML = '';
    state.results.forEach(function (r, i) {
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="round-idx">' + (i + 1) + '</span>' +
        '<span class="round-info"><b>' + fmt(r.guess) + '</b> → <b>' + fmt(r.lot.price) +
        '</b><br>' + r.lot.desc + '</span>' +
        '<span class="round-pts">+' + r.pts + '</span>';
      el.roundsList.appendChild(li);
    });

    /* Рекорд */
    var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    if (state.score > best) {
      localStorage.setItem(BEST_KEY, String(state.score));
      el.finalScoreSub.textContent = 'Новый рекорд! 🎉';
    } else if (best > 0) {
      el.finalScoreSub.textContent = 'Твой рекорд: ' + best + ' балл' + plural(best, '', 'а', 'ов');
    }
  }

  function statBox(num, cap) {
    return '<div class="stat-box"><div class="stat-num">' + num + '</div><div class="stat-cap">' + cap + '</div></div>';
  }

  /* ---------- Стартовый экран ---------- */

  function renderBest() {
    var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    if (best > 0) {
      el.bestScore.hidden = false;
      el.bestScore.textContent = '🏆 Лучший результат: ' + best + ' балл' + plural(best, '', 'а', 'ов');
    } else {
      el.bestScore.hidden = true;
    }
  }

  /* ---------- События ---------- */

  el.btnStart.addEventListener('click', startGame);
  el.btnGuess.addEventListener('click', submitGuess);
  el.btnNext.addEventListener('click', nextRound);
  el.btnRestart.addEventListener('click', startGame);
  el.btnHome.addEventListener('click', function () {
    renderBest();
    showScreen('start');
  });

  renderBest();
  showScreen('start');
})();
