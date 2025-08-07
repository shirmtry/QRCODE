function generateQR() {
  const amount = document.getElementById("amount").value;
  const qrContainer = document.getElementById("qrcode");

  qrContainer.innerHTML = ""; // clear cũ

  if (!amount || amount <= 0) {
    alert("Vui lòng nhập số tiền hợp lệ!");
    return;
  }

  const content = `STK: 43146717\nNgân hàng: ACB\nSố tiền: ${amount} VND`;

  QRCode.toCanvas(document.createElement("canvas"), content, function (err, canvas) {
    if (err) console.error(err);
    else qrContainer.appendChild(canvas);
  });
}
