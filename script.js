// ===================== CONFIG =====================
const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";
const CHECK_INTERVAL = 60000; // 60 giây

// Admin cố định theo yêu cầu
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

let checkIntervalId = null;
let countdownIntervalId = null;

// ===================== UTILITY FUNCTIONS =====================
function formatMoney(amount) {
  return parseFloat(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN');
}

function generateRandomNote(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getStatusText(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'Chờ xử lý';
    case 'completed': return 'Đã duyệt';
    case 'approved': return 'Đã xác nhận';
    case 'rejected': return 'Đã từ chối';
    default: return status || 'Unknown';
  }
}

// ===================== PAYMENT NOTE MANAGEMENT =====================
function getOrCreatePaymentNote() {
  const stored = JSON.parse(localStorage.getItem("paymentNoteData") || "null");
  const now = Date.now();

  if (stored && now < stored.expireAt) {
    return stored.note;
  }

  const newNote = generateRandomNote();
  const expireAt = now + 5 * 60 * 1000; // 5 phút
  localStorage.setItem("paymentNoteData", JSON.stringify({
    note: newNote,
    expireAt
  }));
  return newNote;
}

function getRemainingTime() {
  const stored = JSON.parse(localStorage.getItem("paymentNoteData") || "null");
  if (!stored) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((stored.expireAt - now) / 1000));
}

// ===================== TRANSACTION HANDLING =====================
async function recordPendingTransaction(username, amount, note) {
  try {
    // Kiểm tra trùng note trước khi tạo
    const checkResponse = await fetch(`${SHEET_URL}/search?note=${note}`);
    const existing = await checkResponse.json();
    if (existing && existing.length > 0) {
      console.log("Note đã tồn tại:", note);
      return { success: false, message: "Note đã tồn tại" };
    }

    const pendingData = {
      data: {
        username: username,
        amount: parseFloat(amount),
        note: note,
        status: "pending",
        date: new Date().toISOString(),
        processed: "false",
        admin_approved: "false"
      }
    };

    const response = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingData)
    });

    if (!response.ok) {
      throw new Error("Failed to record transaction");
    }
    return { success: true };
  } catch (error) {
    console.error("Lỗi khi ghi giao dịch:", error);
    throw error;
  }
}

async function checkPaymentStatus(note, amount) {
  try {
    const response = await fetch(`${SHEET_URL}/search?note=${note}&sort_by=date&order=desc`);
    const transactions = await response.json();

    if (!transactions || transactions.length === 0) {
      // Không tìm thấy
      return false;
    }

    const txn = transactions[0];
    // Validate transaction
    if (!txn.note || !txn.amount || !txn.status) {
      console.error("Giao dịch thiếu thông tin bắt buộc");
      return false;
    }

    if (txn.note !== note || parseFloat(txn.amount) !== parseFloat(amount)) {
      console.log("Note hoặc số tiền không khớp");
      return false;
    }

    const status = (txn.status || '').toUpperCase();
    if (status === "COMPLETED" || status === "APPROVED") {
      return {
        ...txn,
        adminConfirmed: (txn.admin_approved === "true")
      };
    }

    return false;
  } catch (error) {
    console.error("Lỗi khi kiểm tra giao dịch:", error);
    return false;
  }
}

async function updateUserBalance(username, amount, transactionId, adminConfirmed = false) {
  try {
    // Verify transaction
    const txnRes = await fetch(`${SHEET_URL}/id/${transactionId}`);
    const transaction = await txnRes.json();

    if (!transaction) {
      console.error("Không tìm thấy giao dịch");
      return { success: false };
    }

    if (transaction.processed === "true") {
      console.log("Giao dịch đã xử lý");
      return { success: true, alreadyProcessed: true };
    }

    // Get user data
    const userRes = await fetch(`${SHEET_URL}/search?username=${encodeURIComponent(username)}`);
    const users = await userRes.json();

    if (!users || users.length === 0) {
      console.error("Không tìm thấy user");
      return { success: false };
    }

    const user = users[0];
    const currentBalance = parseFloat(user.balance || 0);
    const newBalance = currentBalance + parseFloat(amount);
    const newTotalNap = parseFloat(user.total_nap || 0) + parseFloat(amount);

    // Update both user and transaction
    const [userUpdate, txnUpdate] = await Promise.all([
      fetch(`${SHEET_URL}/id/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            balance: newBalance,
            total_nap: newTotalNap,
            last_payment: new Date().toISOString()
          }
        })
      }),
      fetch(`${SHEET_URL}/id/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            processed: "true",
            status: adminConfirmed ? "approved" : "completed",
            admin_approved: adminConfirmed ? "true" : "false",
            processed_date: new Date().toISOString()
          }
        })
      })
    ]);

    if (!userUpdate.ok || !txnUpdate.ok) {
      console.error("Lỗi khi cập nhật");
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error("Lỗi khi cập nhật số dư:", error);
    return { success: false };
  }
}

// ===================== ADMIN FUNCTIONS =====================
async function loadTransactions(status) {
  try {
    let url = `${SHEET_URL}/search?status=${status}&sort_by=date&order=desc`;

    const response = await fetch(url);
    const transactions = await response.json();

    const tbody = document.getElementById(`${status}-transactions`);
    if (!tbody) return;

    tbody.innerHTML = '';

    transactions.forEach(txn => {
      const row = document.createElement('tr');

      if (status === 'pending') {
        row.innerHTML = `
          <td>${txn.id || ''}</td>
          <td>${txn.username || ''}</td>
          <td>${formatMoney(txn.amount || 0)} VND</td>
          <td>${txn.note || ''}</td>
          <td>${formatDateTime(txn.date)}</td>
          <td>${txn.ip || ''}</td>
          <td class="status-${status}">${getStatusText(txn.status)}</td>
          <td>
            <button class="action-btn btn-approve" data-id="${txn.id}">Duyệt</button>
            <button class="action-btn btn-reject" data-id="${txn.id}">Từ chối</button>
            <button class="action-btn btn-delete" data-id="${txn.id}">Xóa</button>
          </td>
        `;
      }
      else if (status === 'completed' || status === 'approved') {
        row.innerHTML = `
          <td>${txn.id || ''}</td>
          <td>${txn.username || ''}</td>
          <td>${formatMoney(txn.amount || 0)} VND</td>
          <td>${txn.note || ''}</td>
          <td>${formatDateTime(txn.date)}</td>
          <td>${formatDateTime(txn.processed_date)}</td>
          <td>${formatMoney(txn.total_nap || 0)} VND</td>
          <td>${formatMoney(txn.balance || 0)} VND</td>
          <td class="status-${status}">${getStatusText(txn.status)}</td>
          <td>
            <button class="action-btn btn-delete" data-id="${txn.id}">Xóa</button>
          </td>
        `;
      }
      else if (status === 'rejected') {
        row.innerHTML = `
          <td>${txn.id || ''}</td>
          <td>${txn.username || ''}</td>
          <td>${formatMoney(txn.amount || 0)} VND</td>
          <td>${txn.note || ''}</td>
          <td>${formatDateTime(txn.date)}</td>
          <td>${formatDateTime(txn.processed_date)}</td>
          <td class="status-${status}">${getStatusText(txn.status)}</td>
          <td>
            <button class="action-btn btn-delete" data-id="${txn.id}">Xóa</button>
          </td>
        `;
      }

      tbody.appendChild(row);
    });

    // Thêm sự kiện cho các nút
    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', approveTransaction);
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', rejectTransaction);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', deleteTransaction);
    });

  } catch (error) {
    console.error(`Lỗi khi tải giao dịch ${status}:`, error);
    alert('Có lỗi xảy ra khi tải dữ liệu');
  }
}

async function approveTransaction(e) {
  const transactionId = e.target.getAttribute('data-id');
  if (!confirm('Xác nhận duyệt giao dịch này?')) return;

  try {
    // 1. Lấy thông tin giao dịch
    const txnRes = await fetch(`${SHEET_URL}/id/${transactionId}`);
    const transaction = await txnRes.json();

    if (!transaction) {
      alert('Không tìm thấy giao dịch');
      return;
    }

    // 2. Cập nhật thông tin user và giao dịch
    const { success } = await updateUserBalance(
      transaction.username,
      transaction.amount,
      transactionId,
      true // adminConfirmed
    );

    if (success) {
      alert('Đã duyệt giao dịch thành công!');
      loadTransactions('pending');
      loadTransactions('completed');
    } else {
      alert('Lỗi khi cập nhật dữ liệu');
    }
  } catch (error) {
    console.error('Lỗi khi duyệt giao dịch:', error);
    alert('Có lỗi xảy ra khi duyệt giao dịch');
  }
}

async function rejectTransaction(e) {
  const transactionId = e.target.getAttribute('data-id');
  if (!confirm('Xác nhận từ chối giao dịch này?')) return;

  try {
    const response = await fetch(`${SHEET_URL}/id/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          status: "rejected",
          processed: "true",
          processed_date: new Date().toISOString()
        }
      })
    });

    if (response.ok) {
      alert('Đã từ chối giao dịch');
      loadTransactions('pending');
      loadTransactions('rejected');
    } else {
      alert('Lỗi khi từ chối giao dịch');
    }
  } catch (error) {
    console.error('Lỗi khi từ chối giao dịch:', error);
    alert('Có lỗi xảy ra khi từ chối giao dịch');
  }
}

async function deleteTransaction(e) {
  const transactionId = e.target.getAttribute('data-id');
  if (!confirm('Xác nhận xóa vĩnh viễn giao dịch này?')) return;

  try {
    const response = await fetch(`${SHEET_URL}/id/${transactionId}`, {
      method: "DELETE"
    });

    if (response.ok) {
      alert('Đã xóa giao dịch');
      const activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');
      loadTransactions(activeTab);
    } else {
      alert('Lỗi khi xóa giao dịch');
    }
  } catch (error) {
    console.error('Lỗi khi xóa giao dịch:', error);
    alert('Có lỗi xảy ra khi xóa giao dịch');
  }
}

// ===================== AUTHENTICATION (ADMIN + USER) =====================
// Admin login (cố định): hàm này có thể được gọi từ trang login admin form
function adminLogin() {
  const username = (document.getElementById('admin-username')?.value || '').trim();
  const password = (document.getElementById('admin-password')?.value || '').trim();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    localStorage.setItem('role', 'admin');
    localStorage.setItem('adminLoggedIn', 'true');
    // optional: set admin username for display
    localStorage.setItem('username', ADMIN_USERNAME);
    window.location.href = 'manage.html';
  } else {
    alert('Sai thông tin đăng nhập admin');
  }
}

// User register
async function registerUser() {
  const username = (document.getElementById("register-username")?.value || '').trim();
  const password = (document.getElementById("register-password")?.value || '').trim();

  if (!username || !password) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }

  // Chặn username "admin"
  if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
    alert("Tên đăng nhập này không được sử dụng");
    return;
  }

  try {
    const users = await (await fetch(`${SHEET_URL}/search?username=${encodeURIComponent(username)}`)).json();
    if (users?.length > 0) {
      alert("Tên đăng nhập đã tồn tại!");
      return;
    }

    const ip = await fetch("https://api.ipify.org?format=json").then(r => r.json()).then(d => d.ip).catch(() => "unknown");

    const response = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          username,
          password,
          ip,
          balance: 0,
          total_nap: 0
        }
      })
    });

    if (response.ok) {
      alert("Đăng ký thành công!");
      showLogin();
    } else {
      throw new Error("Đăng ký thất bại");
    }
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    alert("Có lỗi xảy ra khi đăng ký");
  }
}

// User login (kết hợp kiểm tra admin ở đây)
async function loginUser() {
  const username = (document.getElementById("login-username")?.value || '').trim();
  const password = (document.getElementById("login-password")?.value || '').trim();

  if (!username || !password) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }

  // Nếu đúng tài khoản admin cố định -> đăng nhập admin
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    localStorage.setItem('role', 'admin');
    localStorage.setItem('adminLoggedIn', 'true');
    localStorage.setItem('username', ADMIN_USERNAME);
    window.location.href = 'manage.html';
    return;
  }

  try {
    const users = await (await fetch(`${SHEET_URL}/search?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)).json();
    if (users?.length === 0) {
      alert("Sai thông tin đăng nhập!");
      return;
    }

    // login user
    localStorage.setItem("username", username);
    localStorage.setItem("role", "user");
    alert("Đăng nhập thành công!");
    window.location.href = "deposit.html";
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    alert("Có lỗi xảy ra khi đăng nhập");
  }
}

// ===================== QR GENERATION =====================
function generateQR() {
  // Chỉ user mới được tạo QR
  if (localStorage.getItem('role') !== 'user') {
    alert('Vui lòng đăng nhập tài khoản user để tạo QR');
    window.location.href = 'login.html';
    return;
  }

  const amountInput = document.getElementById("amount");
  const amount = amountInput ? amountInput.value : null;
  const username = localStorage.getItem("username");

  if (!username) {
    alert("Bạn chưa đăng nhập!");
    return;
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ.");
    return;
  }

  // Clear any existing intervals
  if (checkIntervalId) clearInterval(checkIntervalId);
  if (countdownIntervalId) clearInterval(countdownIntervalId);

  const paymentNote = getOrCreatePaymentNote();
  const remainingSeconds = getRemainingTime();

  // Record transaction
  recordPendingTransaction(username, amount, paymentNote)
    .catch(error => {
      console.error("Lỗi khi ghi giao dịch:", error);
      alert("Có lỗi xảy ra khi tạo giao dịch");
      return;
    });

  // Generate QR image
  const encodedName = encodeURIComponent(ACCOUNT_NAME);
  const imageUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NUMBER}-compact.png?amount=${amount}&addInfo=${paymentNote}&accountName=${encodedName}`;

  // Display QR info
  const qrResultEl = document.getElementById("qr-result");
  if (qrResultEl) {
    qrResultEl.innerHTML = `
      <div class="qr-container">
        <p><strong>Mã QR VietQR:</strong></p>
        <img src="${imageUrl}" alt="VietQR Code" class="qr-image">
        <div class="qr-info">
          <p><strong>Nội dung CK:</strong> <span class="note">${paymentNote}</span></p>
          <p><strong>Người nhận:</strong> ${ACCOUNT_NAME}</p>
          <p><strong>Số tiền:</strong> ${formatMoney(amount)} VND</p>
          <p id="countdown-timer" class="countdown">⏳ Thời gian còn lại: ${formatTime(remainingSeconds)}</p>
          <p id="payment-status" class="status">⏳ Đang chờ thanh toán...</p>
        </div>
        <button id="stop-checking" class="stop-btn">Dừng kiểm tra</button>
      </div>
    `;
  }

  // Countdown timer
  let timeLeft = remainingSeconds;
  countdownIntervalId = setInterval(() => {
    timeLeft--;
    const timerElement = document.getElementById("countdown-timer");
    if (timerElement) {
      timerElement.textContent = `⏳ Thời gian còn lại: ${formatTime(timeLeft)}`;
    }

    if (timeLeft <= 0) {
      clearInterval(countdownIntervalId);
      clearInterval(checkIntervalId);
      localStorage.removeItem("paymentNoteData");
      const statusElement = document.getElementById("payment-status");
      if (statusElement) {
        statusElement.innerHTML = "❌ Mã đã hết hạn! Tạo mã mới để tiếp tục.";
      }
    }
  }, 1000);

  // Payment checking
  checkIntervalId = setInterval(async () => {
    try {
      const transaction = await checkPaymentStatus(paymentNote, amount);
      if (!transaction) return;

      const { success, alreadyProcessed } = await updateUserBalance(
        username,
        amount,
        transaction.id,
        transaction.adminConfirmed
      );

      const statusElement = document.getElementById("payment-status");
      if (!statusElement) return;

      if (success) {
        clearInterval(checkIntervalId);
        clearInterval(countdownIntervalId);
        localStorage.removeItem("paymentNoteData");

        if (alreadyProcessed) {
          statusElement.innerHTML = 'ℹ️ Giao dịch đã được xử lý trước đó.';
        } else {
          const message = transaction.adminConfirmed
            ? '✅ Admin đã xác nhận thanh toán! Tiền đã được cộng vào tài khoản.'
            : '✅ Thanh toán thành công! Tiền đã được cộng vào tài khoản.';
          statusElement.innerHTML = message;
        }

        await updateBalanceDisplay();
      } else {
        statusElement.innerHTML = '⚠️ Đã xảy ra lỗi khi cập nhật số dư. Vui lòng liên hệ admin.';
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra thanh toán:", error);
    }
  }, CHECK_INTERVAL);

  // Stop button event
  document.getElementById("stop-checking")?.addEventListener("click", () => {
    clearInterval(checkIntervalId);
    clearInterval(countdownIntervalId);
    const statusElement = document.getElementById("payment-status");
    if (statusElement) {
      statusElement.innerHTML = '❌ Đã dừng kiểm tra. Nếu đã chuyển tiền, vui lòng liên hệ admin.';
    }
  });
}

// ===================== BALANCE MANAGEMENT =====================
async function updateBalanceDisplay() {
  const username = localStorage.getItem("username");
  if (!username) return;

  try {
    const response = await fetch(`${SHEET_URL}/search?username=${encodeURIComponent(username)}`);
    const users = await response.json();
    const balanceElement = document.getElementById("user-balance");

    if (users?.length > 0 && balanceElement) {
      balanceElement.textContent = formatMoney(users[0].balance || 0) + " VND";
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật hiển thị số dư:", error);
  }
}

// ===================== UI HELPERS =====================
function handleAutoGenerateQR() {
  const urlParams = new URLSearchParams(window.location.search);
  const amount = urlParams.get('amount');
  const amountInput = document.getElementById('amount');

  if (amount && amountInput) {
    amountInput.value = amount;
    generateQR();
  }
}

function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-form").style.display = "none";
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
}

// ===================== ADMIN PAGE INIT =====================
function initAdminPage() {
  // Check role == admin
  if (localStorage.getItem('role') !== 'admin' && localStorage.getItem('adminLoggedIn') !== 'true') {
    window.location.href = 'login.html';
    return;
  }

  // Load transactions for all tabs
  loadTransactions('pending');
  loadTransactions('completed');
  loadTransactions('rejected');

  // Set active tab default
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  const firstTab = document.querySelector('.tab-button[data-tab="pending"]');
  if (firstTab) {
    firstTab.classList.add('active');
    document.getElementById('pending-tab')?.classList.add('active');
  }

  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function () {
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

      this.classList.add('active');
      const tabId = this.getAttribute('data-tab') + '-tab';
      document.getElementById(tabId).classList.add('active');
      loadTransactions(this.getAttribute('data-tab'));
    });
  });

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('role');
    // optional: keep username? we'll remove
    localStorage.removeItem('username');
    window.location.href = 'login.html';
  });
}

// ===================== PAGE LOAD HANDLER =====================
document.addEventListener('DOMContentLoaded', function () {
  // If on deposit page: require user role
  if (window.location.pathname.includes('deposit.html')) {
    if (localStorage.getItem('role') !== 'user') {
      // if not user, redirect to login
      window.location.href = 'login.html';
      return;
    }
    handleAutoGenerateQR();
    updateBalanceDisplay();
  }
  else if (window.location.pathname.includes('manage.html')) {
    initAdminPage();
  }
});

// ===================== GLOBAL EXPORTS =====================
window.generateQR = generateQR;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.showLogin = showLogin;
window.showRegister = showRegister;
window.adminLogin = adminLogin;
