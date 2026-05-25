import * as Crypto from 'expo-crypto';

export type UserProfile = {
  dataNascimento: string;
  email: string;
  id: number;
  nome: string;
  profissao: string;
  sobrenome: string;
  usuario: string;
};

export type CreateUserInput = {
  dataNascimento: string;
  email: string;
  nome: string;
  profissao: string;
  senha: string;
  sobrenome: string;
  usuario: string;
};

type StoredUser = UserProfile & {
  senhaHash: string;
};

const STORAGE_KEY = '@comparaja:web-users';

function normalizeText(value: string) {
  return value.trim();
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

function readUsers() {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is StoredUser => Boolean(item && typeof item === 'object')) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }
}

function toUserProfile(user: StoredUser): UserProfile {
  return {
    dataNascimento: user.dataNascimento,
    email: user.email,
    id: user.id,
    nome: user.nome,
    profissao: user.profissao,
    sobrenome: user.sobrenome,
    usuario: user.usuario,
  };
}

async function hashPassword(email: string, password: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${normalizeEmail(email)}:${password}`,
  );
}

export async function createUser(input: CreateUserInput) {
  const users = readUsers();
  const email = normalizeEmail(input.email);
  const usuario = normalizeText(input.usuario);
  const alreadyExists = users.some(
    user => user.usuario.toLowerCase() === usuario.toLowerCase() || user.email.toLowerCase() === email,
  );

  if (alreadyExists) {
    throw new Error('Usuario ou email ja cadastrado.');
  }

  const storedUser: StoredUser = {
    dataNascimento: normalizeText(input.dataNascimento),
    email,
    id: Date.now(),
    nome: normalizeText(input.nome),
    profissao: normalizeText(input.profissao),
    senhaHash: await hashPassword(email, input.senha),
    sobrenome: normalizeText(input.sobrenome),
    usuario,
  };

  writeUsers([...users, storedUser]);

  return toUserProfile(storedUser);
}

export async function authenticateUser(identifier: string, password: string) {
  const normalizedIdentifier = normalizeText(identifier).toLowerCase();
  const user = readUsers().find(
    item => item.usuario.toLowerCase() === normalizedIdentifier || item.email.toLowerCase() === normalizedIdentifier,
  );

  if (!user) {
    return null;
  }

  const passwordHash = await hashPassword(user.email, password);

  if (passwordHash !== user.senhaHash) {
    return null;
  }

  return toUserProfile(user);
}
