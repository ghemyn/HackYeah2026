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
  write: (message: string, options?: { signal?: AbortSignal }) => Promise<void>;
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

const NFC_UNSUPPORTED_MESSAGE =
  "Web NFC is not supported on this device. It only works in Chrome on Android; use the QR code instead.";

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
      throw new Error(NFC_UNSUPPORTED_MESSAGE);
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

// Writes `text` as a single NDEF text record to the next tag held near the phone.
export const writeNfcText = async (text: string): Promise<void> => {
  const NDEFReaderCtor = getNdefReaderConstructor();

  if (!NDEFReaderCtor) {
    throw new Error(NFC_UNSUPPORTED_MESSAGE);
  }

  await new NDEFReaderCtor().write(text);
};
