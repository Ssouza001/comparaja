import express from 'express';
import cors from 'cors';

import PrecoDaHora from 'precodahora-api';

const app = express();
const PORT = process.env.PORT || 3001;

const CIDADES = [
  {
    codigoIBGE: 2933307,
    nome: 'VITÓRIA DA CONQUISTA',
    latitude: -14.8619237,
    longitude: -40.8445346
  },
  {
    codigoIBGE: 2915809,
    nome: 'ITAMBÉ',
    latitude: -15.251599,
    longitude: -40.6239038
  },
  {
    codigoIBGE: 2916401,
    nome: 'ITAPETINGA',
    latitude: -15.2475119,
    longitude: -40.2509918
  }
];

// Cria uma nova instância da lib por requisição para evitar conflito de CSRF/cookies
function criarCliente() {
  return new PrecoDaHora();
}

// Normaliza resposta da lib: retorna { ok, dados, mensagem }
function interpretarResposta(resp) {
  const data = resp?.data;
  if (!data) return { ok: false, dados: [], mensagem: 'Resposta vazia da API.' };
  if (data.codigo === 80 && Array.isArray(data.resultado)) {
    return { ok: true, dados: data.resultado, mensagem: null };
  }
  if (data.codigo === 50) {
    return { ok: true, dados: [], mensagem: 'Nenhum resultado encontrado para esta cidade e período.' };
  }
  return { ok: true, dados: [], mensagem: data.descricao || `Código da API: ${data.codigo}` };
}

// Middleware para JSON
app.use(cors());
app.use(express.json());

// Rota principal de busca
app.get('/produtos', async (req, res) => {
  try {
    const { nome, gtin, cidade } = req.query;
    if (!nome && !gtin) {
      return res.status(400).json({ erro: 'Informe nome ou gtin para busca.' });
    }
    if (!cidade) {
      return res.status(400).json({ erro: 'Informe o código IBGE da cidade.' });
    }
    const cidadeObj = CIDADES.find(c => String(c.codigoIBGE) === String(cidade));
    if (!cidadeObj) {
      return res.status(400).json({ erro: 'Cidade não permitida.' });
    }

    const cliente = criarCliente();
    const resp = await cliente.produto({
      termo: nome || '',
      gtin: gtin ? Number(gtin) : '',
      horas: 72,
      latitude: cidadeObj.latitude,
      longitude: cidadeObj.longitude,
      raio: 15,
      precomax: 0,
      precomin: 0,
      ordenar: 'preco.asc',
      pagina: 1,
      processo: 'carregar',
      totalRegistros: 0,
      totalPaginas: 0,
      pageview: 'lista',
      codmun: cidadeObj.codigoIBGE
    });

    console.log('Produtos API codigo:', resp.data?.codigo, '| total:', resp.data?.resultado?.length);

    const { ok, dados, mensagem } = interpretarResposta(resp);
    res.json(dados.map(produto => ({ ...produto, codigoIBGE: cidadeObj.codigoIBGE, localidade: cidadeObj.nome })));
  } catch (err) {
    const status = err.response?.status;
    const detalhe = err.response?.data?.descricao || err.message;
    console.error('Erro /produtos:', status, detalhe);
    if (status === 429) {
      return res.status(429).json({ erro: 'Limite de requisições atingido. Tente novamente em alguns segundos.' });
    }
    res.status(500).json({ erro: 'Erro ao buscar produtos', detalhe });
  }
});

// Rota de busca de combustíveis por código ANP
app.get('/combustiveis', async (req, res) => {
  try {
    const { anp, cidade } = req.query;
    if (!anp) {
      return res.status(400).json({ erro: 'Informe o código ANP do combustível.' });
    }
    if (!cidade) {
      return res.status(400).json({ erro: 'Informe o código IBGE da cidade.' });
    }
    const cidadeObj = CIDADES.find(c => String(c.codigoIBGE) === String(cidade));
    if (!cidadeObj) {
      return res.status(400).json({ erro: 'Cidade não permitida.' });
    }

    const cliente = criarCliente();
    const resp = await cliente.produto({
      anp: Number(anp),
      horas: 72,
      latitude: cidadeObj.latitude,
      longitude: cidadeObj.longitude,
      raio: 30,
      precomax: 0,
      precomin: 0,
      ordenar: 'preco.asc',
      pagina: 1,
      processo: 'carregar',
      totalRegistros: 0,
      totalPaginas: 0,
      pageview: 'lista',
      codmun: cidadeObj.codigoIBGE
    });

    console.log('Combustível API codigo:', resp.data?.codigo, '| descricao:', resp.data?.descricao, '| total:', resp.data?.resultado?.length);

    const { ok, dados, mensagem } = interpretarResposta(resp);
    res.json({ dados: dados.map(item => ({ ...item, codigoIBGE: cidadeObj.codigoIBGE, localidade: cidadeObj.nome })), mensagem });
  } catch (err) {
    const status = err.response?.status;
    const detalhe = err.response?.data?.descricao || err.message;
    console.error('Erro /combustiveis:', status, detalhe);
    if (status === 429) {
      return res.status(429).json({ erro: 'Limite de requisições atingido. Tente novamente em alguns segundos.' });
    }
    res.status(500).json({ erro: 'Erro ao buscar combustíveis', detalhe });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
