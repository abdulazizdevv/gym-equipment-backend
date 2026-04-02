import { sign, verify } from 'jsonwebtoken';
import config from 'config';
const secret_key: string = config.get('SECRET_KEY');

export const signToken = (payload: any) =>
  sign(payload, secret_key, { expiresIn: '24h' });

export const verifyToken = (payload: any) => verify(payload, secret_key);
