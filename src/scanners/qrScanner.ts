import { Html5Qrcode } from "html5-qrcode";

const SCAN_CONFIG = {
  fps: 10,
  qrbox: { width: 260, height: 260 },
  aspectRatio: 1,
};

// The library sometimes rejects with plain strings.
const toError = (cause: unknown, fallback: string): Error =>
  cause instanceof Error ? cause : new Error(typeof cause === "string" && cause ? cause : fallback);

// Camera-only QR scanner rendered into the element with the given ID, without any camera picker or
// image-file option (a photo of a QR code must not count as a check-in).
// Uses the back camera; if no camera can be identified as the back one, it uses the first camera.
export class QrScanner {
  private scanner: Html5Qrcode | null = null;
  // Lets stop() cancel a start() that is still waiting for the camera.
  private session = 0;

  constructor(private readonly elementId: string) {}

  async start(onDecoded: (text: string) => void): Promise<void> {
    await this.stop();
    const session = ++this.session;
    const scanner = new Html5Qrcode(this.elementId, { verbose: false });
    this.scanner = scanner;

    const ignoreScanErrors = () => {
      // Expected while the camera keeps looking for a valid QR code.
    };
    const begin = (camera: string | MediaTrackConstraints) =>
      scanner.start(camera, SCAN_CONFIG, onDecoded, ignoreScanErrors);

    try {
      try {
        // Only succeeds if the device reports a back ("environment") camera.
        await begin({ facingMode: { exact: "environment" } });
      } catch {
        if (session !== this.session) {
          return;
        }

        const cameras = await Html5Qrcode.getCameras();

        if (cameras.length === 0) {
          throw new Error("No camera was found on this device.");
        }

        if (session !== this.session) {
          return;
        }

        await begin(cameras[0].id);
      }
    } catch (cause) {
      if (session === this.session) {
        await this.stop();
        throw toError(cause, "The camera could not be opened. Allow camera access and try again.");
      }

      return;
    }

    // stop() was called while the camera was starting.
    if (session !== this.session) {
      await this.release(scanner);
    }
  }

  async stop(): Promise<void> {
    this.session++;
    const scanner = this.scanner;
    this.scanner = null;

    if (scanner) {
      await this.release(scanner);
    }
  }

  private async release(scanner: Html5Qrcode): Promise<void> {
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch {
      // Already stopped or never started.
    }

    const element = document.getElementById(this.elementId);

    if (element) {
      element.innerHTML = "";
    }
  }
}
