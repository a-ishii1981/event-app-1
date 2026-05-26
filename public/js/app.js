// タブ切替
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tabId)?.classList.add('active');
  });
});

// 日報コピー
function copyReport() {
  const text = document.getElementById('report-text')?.innerText;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert('コピーしました！');
  });
}
