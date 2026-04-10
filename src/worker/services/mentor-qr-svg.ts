import QRCode from "qrcode-svg";

export function renderMentorQrSvg(qrPayload: string): string {
  return new QRCode({
    content: qrPayload,
    padding: 2,
    width: 256,
    height: 256,
    color: "#0f172a",
    background: "#ffffff",
    ecl: "M",
    join: true,
    pretty: false,
    xmlDeclaration: false,
    container: "svg-viewbox"
  }).svg();
}
