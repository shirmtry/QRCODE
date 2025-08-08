// ===================== CONFIG =====================
const SHEET_URL = "https://sheetdb.io/api/v1/j9sqry5cgir1c";
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY";
const CHECK_INTERVAL = 60000; // 60 giây
let checkIntervalId = null;
let countdownIntervalId = null;

// ===================== UTILITY FUNCTIONS =====================
function formatMoney(amount) {
  return parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function generateRandomNote(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ===================== PAYMENT NOTE MANAGEMENT =====================
function getOrCreatePaymentNote() {
  const stored = JSON.parse(localStorage.getItem("paymentNoteData"));
  const now = Date.now();

  if (stored && now < stored.expireAt) {
    return stored.note;
  }

  const newNote = generateRandomNote();
  const expireAt = now + 5 * 60 * 1000;
  localStorage.setItem("paymentNoteData", JSON.stringify({
    note: newNote,
    expireAt
  }));
  return newNote;
}

function getRemainingTime() {
  const stored = JSON.parse(localStorage.getItem("paymentNoteData"));
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
      return;
    }

    const pendingData = {
      data: {
        username: username,
        amount: parseFloat(amount),
        note: note,
        status: "pending",
        date: new Date().toISOString(),
        processed: "false"
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
      console.log("Không tìm thấy giao dịch với note:", note);
      return false;
    }

    const txn = transactions[0];
    console.log("Giao dịch tìm thấy:", txn);

    // Validate transaction
    if (!txn.note || !txn.amount || !txn.status) {
      console.error("Giao dịch thiếu thông tin bắt buộc");
      return false;
    }

    if (txn.note !== note || parseFloat(txn.amount) !== parseFloat(amount)) {
      console.log("Note hoặc số tiền không khớp");
      return false;
    }

    const status = txn.status.toUpperCase();
    if (status === "COMPLETED" || status === "C") {
      return {
        ...txn,
        adminConfirmed: status === "C"
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
    const userRes = await fetch(`${SHEET_URL}/search?username=${username}`);
    const users = await userRes.json();
    
    if (!users || users.length === 0) {
      console.error("Không tìm thấy user");
      return { success: false };
    }

    const user = users[0];
    const currentBalance = parseFloat(user.balance || 0);
    const newBalance = currentBalance + parseFloat(amount);

    // Update both user and transaction atomically
    const [userUpdate, txnUpdate] = await Promise.all([
      fetch(`${SHEET_URL}/id/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            balance: newBalance,
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
            status: adminConfirmed ? "completed" : "completed"
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

// ===================== QR GENERATION =====================
function generateQR() {
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
  document.getElementById("qr-result").innerHTML = `
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
    const response = await fetch(`${SHEET_URL}/search?username=${username}`);
    const users = await response.json();
    const balanceElement = document.getElementById("user-balance");
    
    if (users?.length > 0 && balanceElement) {
      balanceElement.textContent = formatMoney(users[0].balance || 0) + " VND";
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật hiển thị số dư:", error);
  }
}

// ===================== USER AUTHENTICATION =====================
async function registerUser() {
  const username = document.getElementById("register-username")?.value;
  const password = document.getElementById("register-password")?.value;

  if (!username || !password) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }

  try {
    const users = await (await fetch(`${SHEET_URL}/search?username=${username}`)).json();
    if (users?.length > 0) {
      alert("Tên đăng nhập đã tồn tại!");
      return;
    }

    const ip = await (await fetch("https://api.ipify.org?format=json")).json().then(data => data.ip).catch(() => "unknown");
    
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

async function loginUser() {
  const username = document.getElementById("login-username")?.value;
  const password = document.getElementById("login-password")?.value;

  if (!username || !password) {
    alert("Vui lòng nhập đầy đủ thông tin");
    return;
  }

  try {
    const users = await (await fetch(`${SHEET_URL}/search?username=${username}&password=${password}`)).json();
    if (users?.length === 0) {
      alert("Sai thông tin đăng nhập!");
      return;
    }

    localStorage.setItem("username", username);
    alert("Đăng nhập thành công!");
    window.location.href = "deposit.html";
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    alert("Có lỗi xảy ra khi đăng nhập");
  }
}

// ===================== INITIALIZATION =====================
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

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('deposit.html')) {
    handleAutoGenerateQR();
    updateBalanceDisplay();
  }
});
