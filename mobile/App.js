import { useState } from 'react';
import { ActivityIndicator, Button, FlatList, Picker, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';


const cidades = [
  { label: 'Vitória da Conquista', value: '2933307' },
  { label: 'Itambé', value: '2915809' },
  { label: 'Itapetinga', value: '2916401' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function App() {
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
      const url = `http://10.0.2.2:3001/produtos?${tipo}=${encodeURIComponent(busca)}&cidade=${cidade}`;
      await sleep(300);
      const resp = await fetch(url, { signal: controller.signal });
      const data = await resp.json();
      if (resp.ok) {
        setProdutos(data);
      } else {
        setErro(data.erro || 'Erro desconhecido');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setErro('A busca demorou demais. Tente novamente.');
      } else {
        setErro('Erro de conexão');
      }
    } finally {
      clearTimeout(timeoutId);
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Produtos</Text>
      <View style={styles.boxBusca}>
        <TextInput
          style={styles.input}
          placeholder="Buscar por nome ou GTIN"
          value={busca}
          onChangeText={setBusca}
        />
      </View>
      <View style={styles.boxBusca}>
        <Picker
          selectedValue={cidade}
          style={{ flex: 1, height: 40 }}
          onValueChange={setCidade}
        >
          {cidades.map(c => (
            <Picker.Item key={c.value} label={c.label} value={c.value} />
          ))}
        </Picker>
        <Button title="Pesquisar" onPress={pesquisar} disabled={!busca || carregando} />
      </View>
      {carregando && <ActivityIndicator size="large" color="#007bff" />}
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
      <FlatList
        data={produtos}
        keyExtractor={item => (item.produto?.gtin || item.produto?.codProduto || Math.random().toString())}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.nome}>{item.produto?.descricao}</Text>
            <Text style={styles.preco}>R$ {item.produto?.precoUnitario?.toFixed(2)}</Text>
            <Text style={styles.cidade}>{item.localidade}</Text>
            <Text style={styles.estab}>{item.estabelecimento?.nomeEstabelecimento}</Text>
            <Text style={styles.bairro}>{item.estabelecimento?.bairro}</Text>
          </View>
        )}
        ListEmptyComponent={!carregando && !erro ? <Text>Nenhum produto encontrado.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  titulo: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#007bff', textAlign: 'center' },
  boxBusca: { flexDirection: 'row', marginBottom: 16 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginRight: 8 },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  nome: { fontSize: 18, fontWeight: 'bold' },
  preco: { fontSize: 16, color: '#28a745' },
  cidade: { fontSize: 14, color: '#555' },
  estab: { fontSize: 14, color: '#007bff' },
  bairro: { fontSize: 13, color: '#888' },
  erro: { color: 'red', marginBottom: 8, textAlign: 'center' },
});
