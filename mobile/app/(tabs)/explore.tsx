import { Picker } from '@react-native-picker/picker';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const cidades = [
  { label: 'Vitória da Conquista', value: '2933307' },
  { label: 'Itambé', value: '2915809' },
  { label: 'Itapetinga', value: '2916401' },
];

const combustiveis = [
  { label: '⛽ Gasolina Comum', value: '500' },
  { label: '⛽ Gasolina Aditivada', value: '502' },
  { label: '🌿 Etanol', value: '503' },
  { label: '🚛 Diesel S10', value: '504' },
  { label: '🚛 Diesel Comum', value: '505' },
  { label: '💨 GNV', value: '506' },
];

function getApiBaseUrl() {
  if (Platform.OS === 'web') return 'http://localhost:3001';
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';
  const resolvedHost = hostUri.split(':')[0];
  if (resolvedHost) return `http://${resolvedHost}:3001`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://localhost:3001';
}

const API_BASE_URL = getApiBaseUrl();

export default function CombustiveiScreen() {
  const [cidade, setCidade] = useState(cidades[0].value);
  const [combustivel, setCombustivel] = useState(combustiveis[0].value);
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const pesquisar = async () => {
    setCarregando(true);
    setErro('');
    setAviso('');
    setResultados([]);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const url = `${API_BASE_URL}/combustiveis?anp=${combustivel}&cidade=${cidade}`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setErro(data.erro || data.mensagem || data.descricao || 'Erro desconhecido');
      } else if (Array.isArray(data)) {
        setResultados(data);
        if (data.length === 0) {
          setAviso('Nenhum resultado encontrado para esta cidade e período.');
        }
      } else if (data?.erro) {
        setErro(data.erro);
      } else {
        const codigo = Number(data?.codigo);
        const lista = Array.isArray(data?.dados) ? data.dados : [];
        const mensagem = data?.mensagem || data?.descricao || '';

        setResultados(lista);

        if (codigo === 50) {
          setAviso(mensagem || 'Nenhum resultado encontrado para esta cidade e período.');
        } else if (lista.length === 0 && mensagem) {
          setAviso(mensagem);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setErro('A requisição demorou demais. Tente novamente.');
      } else {
        setErro(`Servidor indisponível em ${API_BASE_URL}. Verifique se o backend está rodando.`);
      }
    } finally {
      clearTimeout(timeoutId);
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Combustíveis</Text>
      <Text style={styles.subtitulo}>Comparar preços de combustíveis por cidade</Text>

      <Text style={styles.label}>Combustível</Text>
      <View style={styles.pickerBox}>
        <Picker selectedValue={combustivel} onValueChange={setCombustivel}>
          {combustiveis.map(c => (
            <Picker.Item key={c.value} label={c.label} value={c.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Cidade</Text>
      <View style={styles.pickerBox}>
        <Picker selectedValue={cidade} onValueChange={setCidade}>
          {cidades.map(c => (
            <Picker.Item key={c.value} label={c.label} value={c.value} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.botao} onPress={pesquisar} disabled={carregando}>
        <Text style={styles.botaoTexto}>{carregando ? 'Buscando...' : 'Buscar preços'}</Text>
      </TouchableOpacity>

      {carregando && <ActivityIndicator size="large" color="#e67e22" style={{ marginTop: 16 }} />}

      <FlatList
        data={resultados}
        keyExtractor={(item, idx) => `${item.produto?.gtin || item.estabelecimento?.cnpj || idx}`}
        renderItem={({ item }) => {
          const p = item.produto;
          const e = item.estabelecimento;
          return (
            <View style={styles.item}>
              <Text style={styles.nomeCombustivel}>{p?.descricao}</Text>
              <Text style={styles.preco}>R$ {p?.precoUnitario?.toFixed(3)}</Text>
              <Text style={styles.intervalo}>Atualizado {p?.intervalo}</Text>
              <View style={styles.divider} />
              <Text style={styles.estab}>{e?.nomeEstabelecimento}</Text>
              <Text style={styles.detalhe}>{e?.endLogradouro}, {e?.endNumero} — {e?.bairro}</Text>
              <Text style={styles.detalhe}>{e?.municipio}/{e?.uf}</Text>
              {e?.telefone ? <Text style={styles.detalhe}>Tel: {e.telefone}</Text> : null}
              <Text style={styles.distancia}>📍 {e?.distancia?.toFixed(2)} km</Text>
            </View>
          );
        }}
        ListEmptyComponent={!carregando && !erro ? <Text style={styles.vazio}>{aviso || 'Nenhum resultado. Tente outro combustível ou cidade.'}</Text> : null}
      />
      {erro && !carregando ? (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>⚠️ {erro}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#e67e22', textAlign: 'center', marginBottom: 4 },
  subtitulo: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4, marginTop: 8 },
  pickerBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 8 },
  botao: { backgroundColor: '#e67e22', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  botaoTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  item: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#ddd', backgroundColor: '#fffaf5', marginBottom: 6, borderRadius: 8 },
  nomeCombustivel: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 2 },
  preco: { fontSize: 24, fontWeight: 'bold', color: '#e67e22', marginBottom: 2 },
  intervalo: { fontSize: 12, color: '#888', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#ffe0b2', marginVertical: 8 },
  estab: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  detalhe: { fontSize: 12, color: '#666', marginTop: 1 },
  distancia: { fontSize: 13, color: '#e67e22', marginTop: 6 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 32 },
  aviso: { backgroundColor: '#fff8e1', borderRadius: 8, padding: 14, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#e67e22' },
  avisoTexto: { color: '#7a4f00', fontSize: 13, lineHeight: 20 },
  erro: { color: 'red', marginBottom: 8, textAlign: 'center' },
});

