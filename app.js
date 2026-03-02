  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;
  let currentSlide = 0;
  let navigating = false;

  // Section boundaries (built dynamically)
  const sections = [
    { start: 0, end: 0, label: 'Group Retirement 101' },
    { start: 0, end: 0, label: 'Sales & Set-Up' },
    { start: 0, end: 0, label: 'Post-Implementation' }
  ];

  function buildSectionMap() {
    const map = [[], [], []];
    slides.forEach((s, i) => {
      const sec = parseInt(s.dataset.section);
      map[sec].push(i);
    });
    for (let i = 0; i < 3; i++) {
      if (map[i].length > 0) {
        sections[i].start = map[i][0];
        sections[i].end = map[i][map[i].length - 1];
      }
    }
  }
  buildSectionMap();

  function goToSlide(index, direction) {
    if (index < 0 || index >= totalSlides || index === currentSlide || navigating) return;
    navigating = true;
    const dir = direction || (index > currentSlide ? 'forward' : 'back');

    // Hide current slide immediately
    slides[currentSlide].classList.remove('active');
    slides[currentSlide].style.display = 'none';
    slides[currentSlide].style.animation = 'none';

    // Show new slide
    currentSlide = index;
    slides[currentSlide].style.display = 'flex';
    slides[currentSlide].style.animation = 'none';

    // Force reflow
    void slides[currentSlide].offsetWidth;

    // Apply animation based on direction
    slides[currentSlide].style.animation = dir === 'forward'
      ? 'slideIn 0.35s ease forwards'
      : 'slideInReverse 0.35s ease forwards';
    slides[currentSlide].classList.add('active');

    updateUI();

    setTimeout(() => { navigating = false; }, 350);
  }

  function nextSlide() { goToSlide(currentSlide + 1, 'forward'); }
  function prevSlide() { goToSlide(currentSlide - 1, 'back'); }

  function goToSection(secIndex) {
    goToSlide(sections[secIndex].start, secIndex > getCurrentSection() ? 'forward' : 'back');
  }

  function getCurrentSection() {
    return parseInt(slides[currentSlide].dataset.section);
  }

  function updateUI() {
    document.getElementById('slideCounter').textContent = `${currentSlide + 1} / ${totalSlides}`;
    const pct = ((currentSlide + 1) / totalSlides) * 100;
    document.getElementById('progressFill').style.width = pct + '%';

    const tabs = document.querySelectorAll('.section-tab');
    const curSec = getCurrentSection();
    tabs.forEach((t, i) => t.classList.toggle('active', i === curSec));

    document.getElementById('prevBtn').disabled = currentSlide === 0;
    document.getElementById('nextBtn').disabled = currentSlide === totalSlides - 1;

    slides[currentSlide].scrollTop = 0;
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
    switch (e.key) {
      case 'ArrowRight': case ' ': e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft': e.preventDefault(); prevSlide(); break;
      case '1': goToSection(0); break;
      case '2': goToSection(1); break;
      case '3': goToSection(2); break;
    }
  });

  // Touch/swipe support
  let touchStartX = 0;
  document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 100) {
      if (dx < 0) nextSlide(); else prevSlide();
    }
  });

  // ─── Calculator Logic (monthly compounding + separate AUA/Revenue charts) ───
  function updateCalculator() {
    const calcPlansEl = document.getElementById('calcPlans');
    if (!calcPlansEl) return; // Exit silently if calculator not yet loaded

    const plans = parseInt(calcPlansEl.value) || 0;
    const emps = parseInt(document.getElementById('calcEmps').value) || 0;
    const contrib = parseFloat(document.getElementById('calcContrib').value) || 0;
    const cfComm = parseFloat(document.getElementById('calcCFComm').value) || 0;
    const auaComm = parseFloat(document.getElementById('calcAUAComm').value) || 0;
    const bulkAUA = parseFloat(document.getElementById('calcBulkAUA').value) || 0;
    const bulkComp = parseFloat(document.getElementById('calcBulkComp').value) || 0;
    const bulkPct = (parseFloat(document.getElementById('calcBulkPct').value) || 0) / 100;
    const annualReturn = (parseFloat(document.getElementById('calcReturn').value) || 0) / 100;
    const monthlyReturn = Math.pow(1 + annualReturn, 1/12) - 1;

    const years = 10;
    let data = [];
    let totalAUA = 0;
    let totalPlans = 0;
    let cumulativeBulkRev = 0;

    for (let y = 1; y <= years; y++) {
      // Split new plans into bulk transfers and startups
      const newPlans = plans;
      const bulkPlans = Math.round(newPlans * bulkPct);
      const startupPlans = newPlans - bulkPlans;
      const newMembers = newPlans * emps;
      totalPlans += newPlans;
      const totalMembers = totalPlans * emps;

      // Bulk transfer AUA (one-time, at start of year)
      const yearBulkAUA = bulkPlans * bulkAUA;
      totalAUA += yearBulkAUA;

      // One-time bulk transfer compensation
      const yearBulkRev = yearBulkAUA * (bulkComp / 100);
      cumulativeBulkRev += yearBulkRev;

      // Monthly compounding: each month, grow existing AUA then add contributions
      const monthlyContrib = (totalMembers * contrib) / 12;
      for (let m = 0; m < 12; m++) {
        totalAUA = totalAUA * (1 + monthlyReturn);
        totalAUA += monthlyContrib;
      }

      // Revenue calculations (based on year-end AUA)
      const annualContribs = totalMembers * contrib;
      const cashflowRev = annualContribs * (cfComm / 100);
      const auaRev = totalAUA * (auaComm / 100);
      const totalRev = cashflowRev + auaRev + yearBulkRev;

      data.push({
        year: y,
        aum: totalAUA,
        cashflowRev,
        auaRev,
        bulkRev: yearBulkRev,
        totalRev,
        plans: totalPlans,
        members: totalMembers
      });
    }

    const y10 = data[years - 1];

    // Render AUA chart (separate)
    const maxAUA = data[years - 1].aum;
    let auaHTML = '';
    data.forEach(d => {
      const pct = maxAUA > 0 ? (d.aum / maxAUA) * 100 : 0;
      auaHTML += `
        <div class="chart-bar-row">
          <div class="chart-bar-year">Year ${d.year}</div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill-aum" style="width: ${pct}%; height: 100%; border-radius: 4px;"></div>
          </div>
          <div class="chart-bar-value" style="width: 100px;">
            <span class="aum-val">${formatCurrency(d.aum)}</span>
          </div>
        </div>`;
    });
    auaHTML += '<div style="font-size: 12px; color: var(--cw-cloud-d3); margin-top: 12px;">' +
      y10.plans + ' plans \u00b7 ' + y10.members.toLocaleString() + ' members by Year 10</div>';
    document.getElementById('chartBarsAUA').innerHTML = auaHTML;

    // Render Revenue chart (stacked: cashflow + AUA-based + bulk)
    const maxRev = Math.max(...data.map(d => d.totalRev));
    let revHTML = '';
    data.forEach(d => {
      const totalPct = maxRev > 0 ? (d.totalRev / maxRev) * 100 : 0;
      const cfShare = d.totalRev > 0 ? (d.cashflowRev / d.totalRev) * 100 : 0;
      const auaShare = d.totalRev > 0 ? (d.auaRev / d.totalRev) * 100 : 0;
      const bulkShare = d.totalRev > 0 ? (d.bulkRev / d.totalRev) * 100 : 0;
      revHTML += `
        <div class="chart-bar-row">
          <div class="chart-bar-year">Year ${d.year}</div>
          <div class="chart-bar-track">
            <div style="position:absolute;top:0;left:0;height:100%;width:${totalPct}%;display:flex;border-radius:4px;overflow:hidden;">
              <div style="width:${cfShare}%;background:var(--cw-pistachio);"></div>
              <div style="width:${auaShare}%;background:var(--cw-sand);"></div>
              <div style="width:${bulkShare}%;background:var(--cw-lilac);"></div>
            </div>
          </div>
          <div class="chart-bar-value" style="width: 100px;">
            <span style="color:var(--cw-pistachio);">${formatCurrency(d.totalRev)}/yr</span>
          </div>
        </div>`;
    });
    revHTML += '<div style="font-size: 12px; color: var(--cw-cloud-d3); margin-top: 12px;">' +
      'CF: ' + formatCurrency(y10.cashflowRev) + ' + AUA: ' + formatCurrency(y10.auaRev) + ' + Bulk: ' + formatCurrency(y10.bulkRev) + '</div>';
    document.getElementById('chartBarsRev').innerHTML = revHTML;
  }

  function formatCurrency(val) {
    if (val >= 1000000000) return '$' + (val / 1000000000).toFixed(1) + 'B';
    if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
    return '$' + val.toFixed(0);
  }

  function toggleCalcInputs() {
    const el = document.getElementById('calcCollapsible');
    const icon = document.getElementById('calcToggleIcon');
    el.classList.toggle('collapsed');
    icon.classList.toggle('collapsed');
  }

  // Init: hide all non-active slides, then run calculator
  slides.forEach((s, i) => {
    if (i !== 0) { s.style.display = 'none'; }
  });
  updateCalculator();
  updateUI();