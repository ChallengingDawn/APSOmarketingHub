import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const ISSUER = process.env.TOTP_ISSUER || 'APSOmarketingHub';

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function makeTotp(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function totpUri(secret: string, label: string): string {
  return makeTotp(secret, label).toString();
}

export async function totpQrDataUrl(secret: string, label: string): Promise<string> {
  return QRCode.toDataURL(totpUri(secret, label), { margin: 1, width: 256 });
}

export function verifyTotp(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  const totp = makeTotp(secret, 'verify');
  const delta = totp.validate({ token: String(code).replace(/\s/g, ''), window: 1 });
  return delta !== null;
}
