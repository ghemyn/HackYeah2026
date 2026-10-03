import { Html5QrcodeScanType, Html5QrcodeScanner } from "html5-qrcode";

// Renders a camera QR scanner into the element with the given ID and reports each decoded text.
export class QrScanner {
  private scanner: Html5QrcodeScanner | null = null;

  constructor(private readonly elementId: string) {}

  start(onDecoded: (text: string) => void) {
    this.stop();

    this.scanner = new Html5QrcodeScanner(
      this.elementId,
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1,
        // Camera only: scanning an image file would let anyone check in from a photo of the QR code.
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      },
      false,
    );

    this.scanner.render(onDecoded, () => {
      // Ignore scan errors while the camera keeps looking for a valid QR code.
    });
  }

  stop() {
    if (!this.scanner) {
      return;
    }

    this.scanner.clear().catch(() => undefined);
    this.scanner = null;

    const element = document.getElementById(this.elementId);
    if (element) {
      element.innerHTML = "";
    }
  }
}
