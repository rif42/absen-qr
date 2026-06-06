const QR_PREFIX = "absenqr:v1:";
const PERSON_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseQrPayload(qrPayload: string): { role: "student" | "mentor"; personId: string } | null {
  if (!qrPayload.startsWith(QR_PREFIX)) {
    return null;
  }

  const parts = qrPayload.slice(QR_PREFIX.length).split(":");

  if (parts.length !== 2) {
    return null;
  }

  const [role, personId] = parts;

  if (role !== "student" && role !== "mentor") {
    return null;
  }

  if (!PERSON_ID_PATTERN.test(personId)) {
    return null;
  }

  return { role, personId };
}
