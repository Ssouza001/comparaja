# Preço da Hora - Backend

API Node.js com Express para servir dados do Preço da Hora filtrando apenas para as cidades:
- Vitória da Conquista (2933307)
- Itambé (2915809)
- Itapetinga (2916401)

## Rotas

### GET /produtos
Busca produtos por nome ou GTIN.

**Parâmetros (query):**
- `nome` (string, opcional)
- `gtin` (string, opcional)

**Exemplo:**
```
/produtos?nome=arroz
/produtos?gtin=7891234567890
```

**Resposta:**
Lista de produtos encontrados nas cidades permitidas.

---

## Como rodar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor:
   ```bash
   npm start
   ```

O servidor ficará disponível em http://localhost:3001
