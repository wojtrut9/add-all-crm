import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET || "add-all-crm-secret-key-2026";

export function generateToken(user: { id: number; username: string; imie: string; rola: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, imie: user.imie, rola: user.rola },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Brak autoryzacji" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Nieprawidlowy token" });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user?.rola !== "admin") {
    return res.status(403).json({ message: "Brak uprawnien" });
  }
  next();
}
