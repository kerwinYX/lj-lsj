const EDGE_THRESHOLD = 24;
const SWIPE_MIN_DISTANCE = 80;
const SWIPE_MAX_Y_DEVIATION = 80;

export function initSwipeBack(canGoBackFn) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let indicator = null;

  function createIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.className = 'swipe-back-indicator';
    indicator.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';
    document.body.appendChild(indicator);
    return indicator;
  }

  function showIndicator(progress) {
    if (!indicator) createIndicator();
    const clampedProgress = Math.min(progress, 1);
    const translateX = -44 + clampedProgress * 54;
    const scale = 0.6 + clampedProgress * 0.4;
    const opacity = clampedProgress;
    indicator.style.transform = `translateY(-50%) translateX(${translateX}px) scale(${scale})`;
    indicator.style.opacity = opacity;
    indicator.classList.add('active');

    if (clampedProgress >= 1) {
      indicator.classList.add('ready');
    } else {
      indicator.classList.remove('ready');
    }
  }

  function hideIndicator() {
    if (indicator) {
      indicator.classList.remove('active', 'ready');
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-50%) translateX(-44px) scale(0.6)';
    }
  }

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (touch.clientX <= EDGE_THRESHOLD && canGoBackFn()) {
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);

    if (dy > SWIPE_MAX_Y_DEVIATION) {
      tracking = false;
      hideIndicator();
      return;
    }

    if (dx > 10) {
      const progress = Math.min(dx / SWIPE_MIN_DISTANCE, 1.2);
      showIndicator(progress);
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);

    hideIndicator();

    if (dx >= SWIPE_MIN_DISTANCE && dy < SWIPE_MAX_Y_DEVIATION) {
      history.back();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    tracking = false;
    hideIndicator();
  }, { passive: true });
}
