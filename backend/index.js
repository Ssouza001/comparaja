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

const REGRAS_PRECO_COMBUSTIVEL = {
  GASOLINA: { label: 'Gasolina', min: 7, max: 8 },
  ETANOL: { label: 'Etanol', min: 4, max: 6 },
  DIESEL: { label: 'Diesel', min: 7, max: 8 },
  GNV: { label: 'GNV', min: 4, max: 5 }
};

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

function normalizarNumero(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw ?? '').trim();

  if (!text) {
    return null;
  }

  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function normalizarTexto(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? '').trim();
}

function normalizarCodigoCombustivel(value) {
  return normalizarTexto(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function obterPrecoUnitario(item) {
  const value = item?.produto?.precoUnitario;
  const number = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function filtrarCombustiveisValidos(dados, codigoAnp) {
  const codigo = normalizarCodigoCombustivel(codigoAnp);
  const regra = REGRAS_PRECO_COMBUSTIVEL[codigo];

  if (!regra) {
    return { dados, mensagemFiltro: null, removidos: 0 };
  }

  const filtrados = dados.filter(item => {
    const preco = obterPrecoUnitario(item);
    return preco !== null && preco >= regra.min && preco <= regra.max;
  });
  const removidos = dados.length - filtrados.length;
  const mensagemFiltro = removidos
    ? `${removidos} resultado(s) removido(s): ${regra.label} deve estar entre R$ ${regra.min} e R$ ${regra.max}.`
    : null;

  return { dados: filtrados, mensagemFiltro, removidos };
}

function resolverLocalizacaoBusca({ cidade, latitude, longitude, raio, raioPadrao }) {
  const lat = normalizarNumero(latitude);
  const lng = normalizarNumero(longitude);
  const raioInformado = normalizarNumero(raio);
  const raioBusca = raioInformado && raioInformado > 0 ? Math.min(raioInformado, 50) : raioPadrao;

  if (lat !== null || lng !== null) {
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { erro: 'Informe latitude e longitude validas.' };
    }

    return {
      local: {
        codigoIBGE: '',
        latitude: lat,
        longitude: lng,
        nome: 'SUA LOCALIZACAO',
        raio: raioBusca
      }
    };
  }

  if (!cidade) {
    return { erro: 'Informe cidade ou latitude/longitude para busca.' };
  }

  const cidadeObj = CIDADES.find(c => String(c.codigoIBGE) === String(cidade));

  if (!cidadeObj) {
    return { erro: 'Cidade nao permitida.' };
  }

  return {
    local: {
      codigoIBGE: cidadeObj.codigoIBGE,
      latitude: cidadeObj.latitude,
      longitude: cidadeObj.longitude,
      nome: cidadeObj.nome,
      raio: raioBusca
    }
  };
}

// Middleware para JSON
app.use(cors());
app.use(express.json());

// Rota principal de busca
app.get('/produtos', async (req, res) => {
  try {
    const { nome, gtin, cidade, latitude, longitude, raio } = req.query;
    if (!nome && !gtin) {
      return res.status(400).json({ erro: 'Informe nome ou gtin para busca.' });
    }
    if (!cidade && !latitude && !longitude) {
      return res.status(400).json({ erro: 'Informe o código IBGE da cidade.' });
    }
    const cidadeObj = CIDADES.find(c => String(c.codigoIBGE) === String(cidade));
    if (!cidadeObj && !latitude && !longitude) {
      return res.status(400).json({ erro: 'Cidade não permitida.' });
    }

    const localizacao = resolverLocalizacaoBusca({ cidade, latitude, longitude, raio, raioPadrao: 15 });

    if (localizacao.erro) {
      return res.status(400).json({ erro: localizacao.erro });
    }

    const local = localizacao.local;
    const cliente = criarCliente();
    const resp = await cliente.produto({
      termo: nome || '',
      gtin: gtin ? Number(gtin) : '',
      horas: 72,
      latitude: local.latitude,
      longitude: local.longitude,
      raio: local.raio,
      precomax: 0,
      precomin: 0,
      ordenar: 'preco.asc',
      pagina: 1,
      processo: 'carregar',
      totalRegistros: 0,
      totalPaginas: 0,
      pageview: 'lista',
      codmun: local.codigoIBGE
    });

    console.log('Produtos API codigo:', resp.data?.codigo, '| total:', resp.data?.resultado?.length);

    const { ok, dados, mensagem } = interpretarResposta(resp);
    res.json(dados.map(produto => ({ ...produto, codigoIBGE: local.codigoIBGE, localidade: local.nome })));
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
    const { anp, cidade, latitude, longitude, raio } = req.query;
    const codigoAnp = normalizarTexto(anp);
    if (!codigoAnp) {
      return res.status(400).json({ erro: 'Informe o código ANP do combustível.' });
    }
    if (!cidade && !latitude && !longitude) {
      return res.status(400).json({ erro: 'Informe o código IBGE da cidade.' });
    }
    const cidadeObj = CIDADES.find(c => String(c.codigoIBGE) === String(cidade));
    if (!cidadeObj && !latitude && !longitude) {
      return res.status(400).json({ erro: 'Cidade não permitida.' });
    }

    const localizacao = resolverLocalizacaoBusca({ cidade, latitude, longitude, raio, raioPadrao: 30 });

    if (localizacao.erro) {
      return res.status(400).json({ erro: localizacao.erro });
    }

    const local = localizacao.local;
    const regraPreco = REGRAS_PRECO_COMBUSTIVEL[normalizarCodigoCombustivel(codigoAnp)];
    const cliente = criarCliente();
    const resp = await cliente.produto({
      anp: codigoAnp,
      horas: 72,
      latitude: local.latitude,
      longitude: local.longitude,
      raio: local.raio,
      precomax: regraPreco?.max || 0,
      precomin: regraPreco?.min || 0,
      ordenar: 'preco.asc',
      pagina: 1,
      processo: 'carregar',
      totalRegistros: 0,
      totalPaginas: 0,
      pageview: 'lista',
      codmun: local.codigoIBGE
    });

    console.log('Combustível API codigo:', resp.data?.codigo, '| descricao:', resp.data?.descricao, '| total:', resp.data?.resultado?.length);

    const { ok, dados, mensagem } = interpretarResposta(resp);
    const filtro = filtrarCombustiveisValidos(dados, codigoAnp);
    const mensagemFinal = filtro.mensagemFiltro || mensagem;

    res.json({
      dados: filtro.dados.map(item => ({ ...item, codigoIBGE: local.codigoIBGE, localidade: local.nome })),
      mensagem: mensagemFinal,
      removidosPorFiltro: filtro.removidos
    });
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
