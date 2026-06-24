export function showModal({ title = '', content = '', onClose } = {}) {
  let overlay = document.getElementById('modal-overlay');

  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h2 class="modal-title">${title}</h2>
      <div class="modal-body">${content}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal(onClose);
  });

  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  return overlay.querySelector('.modal-body');
}

export function hideModal(onClose) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }, 300);
}

export function showConfirm({
  title = '确认',
  message = '',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    overlay.innerHTML = `
      <div class="confirm-box">
        <h3 class="confirm-title">${title}</h3>
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost confirm-cancel">${cancelText}</button>
          <button class="btn btn-danger confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    const close = (result) => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(result);
    };

    overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
      if (typeof onCancel === 'function') onCancel();
      close(false);
    });

    overlay.querySelector('.confirm-ok').addEventListener('click', () => {
      if (typeof onConfirm === 'function') onConfirm();
      close(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
  });
}
