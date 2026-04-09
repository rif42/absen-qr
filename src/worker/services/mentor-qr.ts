const MENTOR_QR_PREFIX = "absenqr:v1:mentor:";
const PERSON_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseMentorQrPayload(qrPayload: string): { mentorId: string } | null {
  if (!qrPayload.startsWith(MENTOR_QR_PREFIX)) {
    return null;
  }

  const mentorId = qrPayload.slice(MENTOR_QR_PREFIX.length);

  if (!PERSON_ID_PATTERN.test(mentorId)) {
    return null;
  }

  return { mentorId };
}
