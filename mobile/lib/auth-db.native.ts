import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

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

type UserRow = {
  data_nascimento: string;
  email: string;
  id: number;
  nome: string;
  profissao: string;
  senha_hash: string;
  sobrenome: string;
  usuario: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function normalizeText(value: string) {
  return value.trim();
}

function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

function rowToUser(row: UserRow): UserProfile {
  return {
    dataNascimento: row.data_nascimento,
    email: row.email,
    id: row.id,
    nome: row.nome,
    profissao: row.profissao,
    sobrenome: row.sobrenome,
    usuario: row.usuario,
  };
}

async function hashPassword(email: string, password: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${normalizeEmail(email)}:${password}`,
  );
}

export async function getAuthDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('comparaja-auth.db');
  }

  const db = await databasePromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      sobrenome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      profissao TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export async function createUser(input: CreateUserInput) {
  const db = await getAuthDatabase();
  const email = normalizeEmail(input.email);
  const usuario = normalizeText(input.usuario);
  const passwordHash = await hashPassword(email, input.senha);

  try {
    const result = await db.runAsync(
      `
      INSERT INTO usuarios (
        usuario,
        email,
        nome,
        sobrenome,
        senha_hash,
        data_nascimento,
        profissao
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      usuario,
      email,
      normalizeText(input.nome),
      normalizeText(input.sobrenome),
      passwordHash,
      normalizeText(input.dataNascimento),
      normalizeText(input.profissao),
    );

    return {
      dataNascimento: normalizeText(input.dataNascimento),
      email,
      id: result.lastInsertRowId,
      nome: normalizeText(input.nome),
      profissao: normalizeText(input.profissao),
      sobrenome: normalizeText(input.sobrenome),
      usuario,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.toLowerCase().includes('unique')) {
      throw new Error('Usuario ou email ja cadastrado.');
    }

    throw error;
  }
}

export async function authenticateUser(identifier: string, password: string) {
  const db = await getAuthDatabase();
  const normalizedIdentifier = normalizeText(identifier);
  const row = await db.getFirstAsync<UserRow>(
    `
    SELECT *
    FROM usuarios
    WHERE lower(usuario) = lower(?) OR lower(email) = lower(?)
    LIMIT 1
    `,
    normalizedIdentifier,
    normalizedIdentifier,
  );

  if (!row) {
    return null;
  }

  const passwordHash = await hashPassword(row.email, password);

  if (passwordHash !== row.senha_hash) {
    return null;
  }

  return rowToUser(row);
}
