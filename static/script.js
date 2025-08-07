document.getElementById("qr-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const response = await fetch("/generate-qr", {
        method: "POST",
        body: formData
    });

    if (response.ok) {
        const blob = await response.blob();
        const qrUrl = URL.createObjectURL(blob);
        document.getElementById("qr-image").src = qrUrl;
        document.getElementById("qr-container").style.display = "block";

        startCountdown(300); // 5 phút = 300 giây
    }
});

function startCountdown(seconds) {
    let timer = seconds;
    const display = document.getElementById("timer");
    const qrImage = document.getElementById("qr-image");

    const countdown = setInterval(() => {
        if (timer <= 0) {
            clearInterval(countdown);
            display.textContent = "0";
            qrImage.src = "";
            alert("Mã QR đã hết hạn! Vui lòng tạo lại.");
        } else {
            display.textContent = timer;
            timer--;
        }
    }, 1000);
}
