declare module 'qr-code-styling' {
  interface QRCodeStylingOptions {
    width?: number;
    height?: number;
    data?: string;
    margin?: number;
    qrOptions?: {
      typeNumber?: number;
      mode?: string;
      errorCorrectionLevel?: string;
    };
    imageOptions?: {
      hideBackgroundDots?: boolean;
      imageSize?: number;
      margin?: number;
      crossOrigin?: string;
    };
    dotsOptions?: {
      color?: string;
      type?: string;
    };
    backgroundOptions?: {
      color?: string;
    };
    image?: string;
    type?: string;
  }

  class QRCodeStyling {
    constructor(options: QRCodeStylingOptions);
    append(element: HTMLElement): void;
    update(options: Partial<QRCodeStylingOptions>): void;
  }

  export default QRCodeStyling;
} 