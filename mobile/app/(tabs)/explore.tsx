import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const cidades = [
  { label: 'Vitoria da Conquista', value: '2933307' },
  { label: 'Itambe', value: '2915809' },
  { label: 'Itapetinga', value: '2916401' },
];

const combustiveis = [
  { label: 'Gasolina', value: 'GASOLINA', short: 'Gasolina' },
  { label: 'Etanol', value: 'ETANOL', short: 'Etanol' },
  { label: 'Diesel', value: 'DIESEL', short: 'Diesel' },
  { label: 'GNV', value: 'GNV', short: 'GNV' },
];

const recentFuelSearches = ['Gasolina', 'Etanol', 'Diesel'];

type Produto = {
  descricao?: string;
  gtin?: string | number;
  intervalo?: string;
  precoUnitario?: number;
  unidade?: string;
};

type Estabelecimento = {
  bairro?: string;
  cnpj?: string | number;
  distancia?: number;
  endLogradouro?: string;
  endNumero?: string | number;
  municipio?: string;
  nomeEstabelecimento?: string;
  telefone?: string;
  uf?: string;
};

type FuelResult = {
  estabelecimento?: Estabelecimento;
  produto?: Produto;
};

type ApiError = {
  codigo?: number;
  dados?: FuelResult[];
  descricao?: string;
  erro?: string;
  mensagem?: string;
};

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

function formatCurrency(value: unknown, digits = 2) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'R$ --';
  }

  return `R$ ${numericValue.toFixed(digits).replace('.', ',')}`;
}

function selectedFuelLabel(value: string) {
  return combustiveis.find(item => item.value === value)?.label || 'Combustivel';
}

const API_BASE_URL = getApiBaseUrl();

export default function CombustiveiScreen() {
  const [cidade, setCidade] = useState(cidades[0].value);
  const [combustivel, setCombustivel] = useState(combustiveis[0].value);
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState<FuelResult[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const pesquisar = async () => {
    if (carregando) {
      return;
    }

    setCarregando(true);
    setErro('');
    setAviso('');
    setResultados([]);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const params = new URLSearchParams({ anp: combustivel, cidade });
      const url = `${API_BASE_URL}/combustiveis?${params.toString()}`;
      const resp = await fetch(url, { signal: controller.signal });
      const data = (await resp.json().catch(() => ({}))) as FuelResult[] | ApiError;

      if (!resp.ok) {
        const apiError = data as ApiError;
        setErro(apiError.erro || apiError.mensagem || apiError.descricao || 'Erro desconhecido');
      } else if (Array.isArray(data)) {
        setResultados(data);
        if (data.length === 0) {
          setAviso('Nenhum resultado encontrado para esta cidade e periodo.');
        }
      } else if (data.erro) {
        setErro(data.erro);
      } else {
        const codigo = Number(data.codigo);
        const lista = Array.isArray(data.dados) ? data.dados : [];
        const mensagem = data.mensagem || data.descricao || '';

        setResultados(lista);

        if (codigo === 50) {
          setAviso(mensagem || 'Nenhum resultado encontrado para esta cidade e periodo.');
        } else if (lista.length === 0 && mensagem) {
          setAviso(mensagem);
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setErro('A requisicao demorou demais. Tente novamente.');
      } else {
        setErro(`Servidor indisponivel em ${API_BASE_URL}. Verifique se o backend esta rodando.`);
      }
    } finally {
      clearTimeout(timeoutId);
      setCarregando(false);
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.logo}>Fuel Radar</Text>
            <Text style={styles.heroSubtitle}>Compare o litro antes de abastecer</Text>
          </View>
          <View style={styles.heroIcon}>
            <MaterialIcons name="local-gas-station" size={22} color="#0DBB7C" />
          </View>
        </View>

        <View style={styles.heroMetric}>
          <View>
            <Text style={styles.metricLabel}>Consulta ativa</Text>
            <Text style={styles.metricValue}>{selectedFuelLabel(combustivel)}</Text>
          </View>
          <TouchableOpacity
            disabled={carregando}
            onPress={pesquisar}
            style={[styles.scanButton, carregando && styles.scanButtonDisabled]}>
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="search" size={16} color="#FFFFFF" />
                <Text style={styles.scanButtonText}>Buscar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.segmentRow}>
        {combustiveis.slice(0, 4).map(item => {
          const active = item.value === combustivel;

          return (
            <Pressable
              key={item.value}
              onPress={() => setCombustivel(item.value)}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.short}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Filtros de preco</Text>
          <Text style={styles.sectionLink}>ANP online</Text>
        </View>

        <Text style={styles.inputLabel}>Combustivel</Text>
        <View style={styles.pickerShell}>
          <Picker selectedValue={combustivel} style={styles.picker} onValueChange={setCombustivel}>
            {combustiveis.map(c => (
              <Picker.Item key={c.value} label={c.label} value={c.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.inputLabel}>Cidade</Text>
        <View style={styles.pickerShell}>
          <Picker selectedValue={cidade} style={styles.picker} onValueChange={setCidade}>
            {cidades.map(c => (
              <Picker.Item key={c.value} label={c.label} value={c.value} />
            ))}
          </Picker>
        </View>
      </View>

      {erro ? (
        <View style={styles.alert}>
          <MaterialIcons name="error-outline" size={18} color="#D9534F" />
          <Text style={styles.alertText}>{erro}</Text>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>
            {resultados.length ? 'Postos encontrados' : 'Historico de busca'}
          </Text>
          <Text style={styles.sectionLink}>{resultados.length ? `${resultados.length} locais` : 'recentes'}</Text>
        </View>

        {!resultados.length && !carregando ? (
          <View style={styles.historyWrap}>
            {recentFuelSearches.map(item => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  const found = combustiveis.find(fuel => fuel.label === item);
                  if (found) setCombustivel(found.value);
                }}
                style={styles.historyChip}>
                <MaterialIcons name="history" size={15} color="#0DBB7C" />
                <Text style={styles.historyChipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {aviso && !carregando ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="travel-explore" size={28} color="#0DBB7C" />
            <Text style={styles.emptyTitle}>Sem postos nessa consulta</Text>
            <Text style={styles.emptyText}>{aviso}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={resultados}
        keyExtractor={(item, idx) => `${item.produto?.gtin || item.estabelecimento?.cnpj || idx}`}
        ListEmptyComponent={
          carregando ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#0DBB7C" size="large" />
              <Text style={styles.loadingText}>Buscando postos e precos...</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.alertPanel}>
            <View style={styles.alertIcon}>
              <MaterialIcons name="notifications-active" size={18} color="#071126" />
            </View>
            <View style={styles.alertBody}>
              <Text style={styles.alertPanelTitle}>Alerta de queda</Text>
              <Text style={styles.alertPanelText}>Acompanhe o combustivel selecionado e veja rapidamente onde economizar.</Text>
            </View>
            <TouchableOpacity style={styles.alertPanelButton}>
              <Text style={styles.alertPanelButtonText}>Ativar</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => {
          const p = item.produto;
          const e = item.estabelecimento;

          return (
            <View style={styles.stationCard}>
              <View style={styles.stationTop}>
                <View style={styles.stationBadge}>
                  <MaterialIcons name="local-gas-station" size={20} color="#0DBB7C" />
                </View>
                <View style={styles.stationInfo}>
                  <Text numberOfLines={1} style={styles.stationName}>{e?.nomeEstabelecimento || 'Posto sem nome'}</Text>
                  <Text numberOfLines={1} style={styles.stationAddress}>
                    {e?.endLogradouro || 'Endereco nao informado'}, {e?.endNumero || 's/n'}
                  </Text>
                </View>
                <View style={styles.pricePill}>
                  <Text style={styles.stationPrice}>{formatCurrency(p?.precoUnitario)}</Text>
                </View>
              </View>

              <View style={styles.stationDivider} />

              <View style={styles.stationDetails}>
                <View style={styles.detailItem}>
                  <MaterialIcons name="place" size={15} color="#7A8794" />
                  <Text style={styles.detailText}>{e?.distancia?.toFixed(2) || '--'} km</Text>
                </View>
                <View style={styles.detailItem}>
                  <MaterialIcons name="schedule" size={15} color="#7A8794" />
                  <Text style={styles.detailText}>{p?.intervalo || 'Atualizacao recente'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <MaterialIcons name="location-city" size={15} color="#7A8794" />
                  <Text style={styles.detailText}>{e?.municipio || 'Cidade'}{e?.uf ? `/${e.uf}` : ''}</Text>
                </View>
              </View>

              {e?.telefone ? <Text style={styles.phoneText}>Telefone: {e.telefone}</Text> : null}
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: '#0A1525',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  android: {
    elevation: 3,
  },
  default: {
    boxShadow: '0 10px 28px rgba(10, 21, 37, 0.08)',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 16,
    paddingBottom: 112,
  },
  hero: {
    backgroundColor: '#0DBB7C',
    borderRadius: 14,
    padding: 14,
    ...shadow,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroMetric: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 10,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
    fontWeight: '700',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  scanButton: {
    alignItems: 'center',
    backgroundColor: '#071126',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  scanButtonDisabled: {
    opacity: 0.72,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E9EE',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentActive: {
    backgroundColor: '#071126',
    borderColor: '#071126',
  },
  segmentText: {
    color: '#6E7B87',
    fontSize: 11,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  filterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#101820',
    fontSize: 15,
    fontWeight: '900',
  },
  sectionLink: {
    color: '#0DBB7C',
    fontSize: 11,
    fontWeight: '900',
  },
  inputLabel: {
    color: '#5F6C78',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 8,
  },
  pickerShell: {
    backgroundColor: '#F6F8FA',
    borderColor: '#E1E7EC',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 60,
    overflow: 'hidden',
  },
  picker: {
    color: '#182230',
    fontSize: 14,
    height: 60,
    width: '100%',
  },
  alert: {
    alignItems: 'center',
    backgroundColor: '#FFF1F0',
    borderColor: '#FFD2CD',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  alertText: {
    color: '#A8322A',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  sectionBlock: {
    marginTop: 18,
  },
  historyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  historyChipText: {
    color: '#263443',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    padding: 20,
  },
  emptyTitle: {
    color: '#101820',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    color: '#7A8794',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: '#5E6B77',
    fontSize: 13,
    fontWeight: '700',
  },
  stationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
    ...shadow,
  },
  stationTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stationBadge: {
    alignItems: 'center',
    backgroundColor: '#EAFBF4',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    marginRight: 10,
    width: 42,
  },
  stationInfo: {
    flex: 1,
    minWidth: 0,
  },
  stationName: {
    color: '#111B26',
    fontSize: 14,
    fontWeight: '900',
  },
  stationAddress: {
    color: '#84909B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  pricePill: {
    alignItems: 'center',
    backgroundColor: '#EAFBF4',
    borderRadius: 12,
    marginLeft: 8,
    minWidth: 82,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stationPrice: {
    color: '#0B9F6B',
    fontSize: 14,
    fontWeight: '900',
  },
  stationDivider: {
    backgroundColor: '#EEF2F5',
    height: 1,
    marginVertical: 10,
  },
  stationDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailText: {
    color: '#64717D',
    fontSize: 10,
    fontWeight: '800',
  },
  phoneText: {
    color: '#64717D',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },
  alertPanel: {
    alignItems: 'center',
    backgroundColor: '#0DBB7C',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    padding: 12,
  },
  alertIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  alertBody: {
    flex: 1,
  },
  alertPanelTitle: {
    color: '#071126',
    fontSize: 13,
    fontWeight: '900',
  },
  alertPanelText: {
    color: 'rgba(7,17,38,0.70)',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 2,
  },
  alertPanelButton: {
    backgroundColor: '#071126',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  alertPanelButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
