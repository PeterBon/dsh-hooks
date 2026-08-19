/**
 * Minimal declaration for the `qrcode` package (no bundled types). Only the
 * two functions dsh-hooks uses are declared: `toDataURL` (web QR rendering)
 * and `toString` (terminal QR in the CLI, which itself is untyped JS).
 */
declare module 'qrcode' {
  export interface QRCodeRenderOptions {
    width?: number
    margin?: number
    type?: string
    small?: boolean
    [key: string]: unknown
  }

  const QRCode: {
    toDataURL(text: string, options?: QRCodeRenderOptions): Promise<string>
    toString(
      text: string,
      options?: QRCodeRenderOptions,
      callback?: (error: Error | null, qr: string) => void,
    ): void
  }
  export default QRCode
}
