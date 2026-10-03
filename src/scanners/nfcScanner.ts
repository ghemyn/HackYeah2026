type NfcRecord = {
  recordType: string;
  data?: ArrayBuffer | DataView;
  mediaType?: string;
  id?: string;
};

type NfcMessage = {
  records: NfcRecord[];
};

type NfcReaderLike = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  onreading: ((event: { message: NfcMessage; serialNumber?: string }) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
};

export type NfcScanHandlers = {
  // Called with the first non-empty text record, or the tag serial number when there is none.
  onRead: (value: string) => void;
  onReadError: () => void;
};

const getNdefReaderConstructor = () =>
  (window as Window & { NDEFReader?: new () => NfcReaderLike }).NDEFReader;

export const isNfcSupported = (): boolean => Boolean(getNdefReaderConstructor());

const readNfcPayload = (records: NfcRecord[]): string => {
  for (const record of records) {
    if (!record.data) {
      continue;
    }

    const cleaned = new TextDecoder().decode(record.data).trim();

    if (cleaned) {
      return cleaned;
    }
  }

  return "";
};

// Wraps Web NFC (Chrome on Android). Throws from start() when NFC is unavailable or permission is denied.
export class NfcScanner {
  private abortController: AbortController | null = null;

  async start({ onRead, onReadError }: NfcScanHandlers) {
    const NDEFReaderCtor = getNdefReaderConstructor();

    if (!NDEFReaderCtor) {
      throw new Error("Web NFC is not supported in this browser or device. Enable NFC in the phone browser and try again.");
    }

    this.stop();
    const abortController = new AbortController();
    this.abortController = abortController;

    const reader = new NDEFReaderCtor();
    reader.onreading = ({ message, serialNumber }) => {
      onRead(readNfcPayload(message.records) || serialNumber || "");
    };
    reader.onreadingerror = () => onReadError();

    await reader.scan({ signal: abortController.signal });
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
  }
}
