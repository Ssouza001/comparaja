import { Picker } from '@react-native-picker/picker';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import { ActivityIndicator, Button, FlatList, Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

const cidades = [
  { label: 'Vitória da Conquista', value: '2933307' },
  { label: 'Itambé', value: '2915809' },
  { label: 'Itapetinga', value: '2916401' },
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDecimal(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue.toFixed(2).replace('.', ',');
}

function getApiBaseUrl() {
  if (Platform.OS === 'web') {
    return 'http://localhost:3001';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    '';

  const resolvedHost = hostUri.split(':')[0];

  if (resolvedHost) {
    return `http://${resolvedHost}:3001`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
}

const API_BASE_URL = getApiBaseUrl();

export default function HomeScreen() {
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState(cidades[0].value);
  const [carregando, setCarregando] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState('');

  const pesquisar = async () => {
    setCarregando(true);
    setErro('');
    setProdutos([]);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const tipo = busca.match(/^\d+$/) ? 'gtin' : 'nome';
      const url = `${API_BASE_URL}/produtos?${tipo}=${encodeURIComponent(busca)}&cidade=${cidade}`;
      await sleep(300);
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json();
      if (resp.ok) {
        setProdutos(data);
      } else {
        setErro(data.erro || 'Erro desconhecido');
      }
    } catch (e: any) {
      if (e instanceof Error && e.name === 'AbortError') {
        setErro('A busca demorou demais. Tente novamente.');
      } else {
        setErro(`Erro de conexão com ${API_BASE_URL}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Produtos</Text>
      <Text style={styles.subtitulo}>Conectado em {API_BASE_URL}</Text>
      <View style={styles.boxBusca}>
        <TextInput
          style={styles.input}
          placeholder="Buscar por nome ou GTIN"
          value={busca}
          onChangeText={setBusca}
        />
      </View>
      <View style={styles.filtrosContainer}>
        <Text style={styles.label}>Cidade</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={cidade}
            style={styles.picker}
            onValueChange={setCidade}
          >
            {cidades.map(c => (
              <Picker.Item key={c.value} label={c.label} value={c.value} />
            ))}
          </Picker>
        </View>
        <View style={styles.botaoBox}>
          <Button title="Pesquisar" onPress={pesquisar} disabled={!busca || carregando} />
        </View>
      </View>
      {carregando && <ActivityIndicator size="large" color="#007bff" />}
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      <FlatList
        data={produtos}
        keyExtractor={(item, idx) => {
          const productId = item.produto?.gtin || item.produto?.codProduto || 'sem-produto';
          const storeId = item.estabelecimento?.cnpj || 'sem-cnpj';
          return `${productId}-${storeId}-${idx}`;
        }}
        renderItem={({ item }) => {
          const p = item.produto;
          const e = item.estabelecimento;
          const descontoFormatado = formatDecimal(p?.desconto);

          return (
            <View style={styles.item}>
              {/* Produto */}
              <Text style={styles.nome}>{p?.descricao}</Text>
              <View style={styles.row}>
                <Text style={styles.preco}>R$ {p?.precoUnitario?.toFixed(2)}</Text>
                {descontoFormatado && Number(p?.desconto) > 0 ? (
                  <Text style={styles.desconto}> (-{descontoFormatado})</Text>
                ) : null}
                <Text style={styles.unidade}> / {p?.unidade}</Text>
              </View>
              {p?.ncmGrupo ? <Text style={styles.tag}>Categoria: {p.ncmGrupo}</Text> : null}
              <Text style={styles.tag}>GTIN: {p?.gtin}</Text>
              {p?.farmaciaPopular ? <Text style={styles.tag}>✅ Farmácia Popular</Text> : null}
              <Text style={styles.tag}>Atualizado: {p?.intervalo}</Text>

              {/* Divisor */}
              <View style={styles.divider} />

              {/* Estabelecimento */}
              <Text style={styles.estab}>{e?.nomeEstabelecimento}</Text>
              <Text style={styles.detalhe}>
                {e?.endLogradouro}, {e?.endNumero} — {e?.bairro}
              </Text>
              <Text style={styles.detalhe}>
                {e?.municipio}/{e?.uf} — CEP: {e?.cep}
              </Text>
              {e?.telefone ? <Text style={styles.detalhe}>Tel: {e.telefone}</Text> : null}
              <Text style={styles.detalhe}>CNPJ: {String(e?.cnpj).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</Text>
              <Text style={styles.detalhe}>Distância: {e?.distancia?.toFixed(2)} km</Text>
              <Text style={styles.cidade}>{item.localidade}</Text>
            </View>
          );
        }}
        ListEmptyComponent={!carregando && !erro ? <Text style={styles.vazio}>Nenhum produto encontrado.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#007bff', textAlign: 'center' },
  subtitulo: { fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'center' },
  boxBusca: { flexDirection: 'row', marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginRight: 8 },
  filtrosContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  pickerBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },
  picker: { width: '100%', height: 56 },
  botaoBox: { marginTop: 12 },
  item: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#ddd', backgroundColor: '#fafafa', marginBottom: 6, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  nome: { fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  preco: { fontSize: 20, fontWeight: 'bold', color: '#28a745' },
  desconto: { fontSize: 14, color: '#e74c3c' },
  unidade: { fontSize: 13, color: '#888' },
  tag: { fontSize: 12, color: '#555', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 8 },
  estab: { fontSize: 15, fontWeight: 'bold', color: '#007bff', marginBottom: 2 },
  detalhe: { fontSize: 12, color: '#555', marginTop: 1 },
  cidade: { fontSize: 13, fontWeight: 'bold', color: '#333', marginTop: 6 },
  vazio: { textAlign: 'center', color: '#888', marginTop: 32 },
  erro: { color: 'red', marginBottom: 8, textAlign: 'center' },
});
