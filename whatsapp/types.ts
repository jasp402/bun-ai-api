export interface WhatsAppRuntimeState {
  enabled: boolean;
  sessionName: string;
  sessionRoot: string;
  tokenPath: string;
  profilePath: string;
  status: string;
  connectionState: string | null;
  qrCode: string | null;
  asciiQR: string | null;
  qrAttempts: number;
  botWid: string | null;
  connected: boolean;
  lastError: string | null;
  lastMessageAt: string | null;
}

export interface WhatsAppRecentSender {
  timestamp: string;
  senderId: string;
  from: string;
  author: string | null;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  preview: string;
}
