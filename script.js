// Thông tin cố định
const BANK_CODE = "ACB";
const ACCOUNT_NUMBER = "43146717";
const ACCOUNT_NAME = "DINH TAN HUY"; // IN HOA, KHÔNG DẤU

function generateRandomNote(length = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateQR() {
  const amount = document.getElementById("amount").value;

  if (!amount || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ.");
    return;
  }

  const note = generateRandomNote();
  const encodedName = encodeURIComponent(ACCOUNT_NAME);
  const imageUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NUMBER}-compact.png?amount=${amount}&addInfo=${note}&accountName=${encodedName}`;

  document.getElementById("qr-result").innerHTML = `
    <p><strong>Mã QR VietQR:</strong></p>
    <img src="${imageUrl}" alt="VietQR Code" />
    <p><strong>Nội dung CK:</strong> ${note}</p>
    <p><strong>Người nhận:</strong> ${ACCOUNT_NAME}</p>
    <p style="color: green; font-weight: bold;">✅ Đã tạo mã chuyển khoản thành công!</p>
  `;
}
