import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import Constants from 'expo-constants';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const cidades = [
  { label: 'Vitoria da Conquista', value: '2933307' },
  { label: 'Itambe', value: '2915809' },
  { label: 'Itapetinga', value: '2916401' },
];

const quickActions = [
  { icon: 'qr-code-scanner', label: 'Escanear', hint: 'GTIN' },
  { icon: 'local-offer', label: 'Ofertas', hint: 'Hoje' },
  { icon: 'storefront', label: 'Lojas', hint: 'Perto' },
  { icon: 'favorite', label: 'Favoritos', hint: 'Salvos' },
] as const;

const sampleFavorites = [
  { name: 'Arroz Tipo 1', price: 'R$ 25,49', store: 'Mercado Central', trend: '-8%' },
  { name: 'Cafe 500g', price: 'R$ 18,90', store: 'Super Bahia', trend: '-5%' },
  { name: 'Leite integral', price: 'R$ 5,79', store: 'Comercial Sul', trend: '-3%' },
];

const supportedBarcodeTypes: BarcodeType[] = [
  'aztec',
  'ean13',
  'ean8',
  'qr',
  'pdf417',
  'upc_e',
  'datamatrix',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'code128',
  'upc_a',
];

type Produto = {
  codProduto?: string | number;
  descricao?: string;
  desconto?: string | number;
  farmaciaPopular?: boolean;
  gtin?: string | number;
  intervalo?: string;
  ncmGrupo?: string;
  precoUnitario?: number;
  unidade?: string;
};

type Estabelecimento = {
  bairro?: string;
  cep?: string | number;
  cnpj?: string | number;
  distancia?: number;
  endLogradouro?: string;
  endNumero?: string | number;
  municipio?: string;
  nomeEstabelecimento?: string;
  telefone?: string;
  uf?: string;
};

type ProductResult = {
  estabelecimento?: Estabelecimento;
  localidade?: string;
  produto?: Produto;
};

type ApiError = {
  erro?: string;
  mensagem?: string;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCurrency(value: unknown, digits = 2) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'Preco indisponivel';
  }

  return `R$ ${numericValue.toFixed(digits).replace('.', ',')}`;
}

function formatDecimal(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue.toFixed(2).replace('.', ',');
}

function formatCnpj(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length !== 14) {
    return String(value ?? 'Nao informado');
  }

  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function getInitials(value?: string) {
  const words = (value || 'Produto').trim().split(/\s+/).slice(0, 2);
  return words.map(word => word[0]).join('').toUpperCase();
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
  const [produtos, setProdutos] = useState<ProductResult[]>([]);
  const [erro, setErro] = useState('');
  const [historico, setHistorico] = useState(['Arroz tipo 1', 'Cafe 500g', 'Leite integral']);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerLockedRef = useRef(false);

  const resetScannerLock = () => {
    scannerLockedRef.current = false;
    setScannerLocked(false);
  };

  const pesquisar = async () => {
    const termo = busca.trim();

    if (!termo || carregando) {
      return;
    }

    setCarregando(true);
    setErro('');
    setProdutos([]);
    setHistorico(prev => [termo, ...prev.filter(item => item !== termo)].slice(0, 4));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const tipo = termo.match(/^\d+$/) ? 'gtin' : 'nome';
      const url = `${API_BASE_URL}/produtos?${tipo}=${encodeURIComponent(termo)}&cidade=${cidade}`;
      await sleep(300);
      const resp = await fetch(url, { signal: controller.signal });
      const data = (await resp.json()) as ProductResult[] | ApiError;

      if (resp.ok && Array.isArray(data)) {
        setProdutos(data);
      } else {
        const apiError = data as ApiError;
        setErro(apiError.erro || apiError.mensagem || 'Nao foi possivel carregar os produtos.');
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setErro('A busca demorou demais. Tente novamente.');
      } else {
        setErro(`Erro de conexao com ${API_BASE_URL}`);
      }
    } finally {
      clearTimeout(timeoutId);
      setCarregando(false);
    }
  };

  const abrirScanner = async () => {
    setScannerError('');
    resetScannerLock();

    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission.granted) {
      setScannerError('Permita o acesso a camera para ler codigos de barras.');
      return;
    }

    setScannerVisible(true);
  };

  const fecharScanner = () => {
    setScannerVisible(false);
    resetScannerLock();
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    const codigo = data.trim();

    if (scannerLockedRef.current || !codigo) {
      return;
    }

    scannerLockedRef.current = true;
    setScannerLocked(true);
    setBusca(codigo);
    setErro('');
    setProdutos([]);
    setScannerVisible(false);
  };

  const renderScanner = () => (
    <Modal animationType="slide" onRequestClose={fecharScanner} visible={scannerVisible}>
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View>
            <Text style={styles.scannerTitle}>Leitor de codigo</Text>
            <Text style={styles.scannerSubtitle}>EAN, UPC, QR, Code 128 e outros padroes</Text>
          </View>
          <TouchableOpacity accessibilityLabel="Fechar leitor" onPress={fecharScanner} style={styles.closeButton}>
            <MaterialIcons name="close" size={22} color="#101820" />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraShell}>
          <CameraView
            active={scannerVisible}
            barcodeScannerSettings={{ barcodeTypes: supportedBarcodeTypes }}
            facing="back"
            onBarcodeScanned={scannerLocked ? undefined : handleBarcodeScanned}
            style={styles.camera}
          />
          <View pointerEvents="none" style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
          </View>
        </View>

        <View style={styles.scannerFooter}>
          <MaterialIcons name="center-focus-strong" size={20} color="#0DBB7C" />
          <Text style={styles.scannerFooterText}>Centralize o codigo na area marcada</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.logo}>ComparaJa</Text>
            <Text style={styles.heroSubtitle}>Preco justo perto de voce</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CJ</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#8A96A3" />
          <TextInput
            autoCapitalize="none"
            onChangeText={setBusca}
            onSubmitEditing={pesquisar}
            placeholder="Buscar produto ou codigo de barras..."
            placeholderTextColor="#8A96A3"
            returnKeyType="search"
            style={styles.searchInput}
            value={busca}
          />
          <TouchableOpacity
            accessibilityLabel="Pesquisar produto"
            disabled={!busca.trim() || carregando}
            onPress={pesquisar}
            style={[styles.searchButton, (!busca.trim() || carregando) && styles.searchButtonDisabled]}>
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.quickGrid}>
        {quickActions.map(action => (
          <Pressable
            key={action.label}
            onPress={() => {
              if (action.label === 'Escanear') {
                abrirScanner();
                return;
              }

              if (action.label === 'Ofertas') {
                setBusca('arroz');
              }
            }}
            style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
            <View style={styles.quickIcon}>
              <MaterialIcons name={action.icon} size={18} color="#0DBB7C" />
            </View>
            <Text style={styles.quickLabel}>{action.label}</Text>
            <Text style={styles.quickHint}>{action.hint}</Text>
          </Pressable>
        ))}
      </View>

      {scannerError ? (
        <View style={styles.alert}>
          <MaterialIcons name="photo-camera" size={18} color="#D9534F" />
          <Text style={styles.alertText}>{scannerError}</Text>
        </View>
      ) : null}

      <View style={styles.selectorCard}>
        <View style={styles.selectorHeader}>
          <Text style={styles.sectionTitle}>Cidade da busca</Text>
          <Text style={styles.sectionLink}>Atualizar</Text>
        </View>
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

      {historico.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.selectorHeader}>
            <Text style={styles.sectionTitle}>Buscas recentes</Text>
            <Text style={styles.sectionLink}>{produtos.length ? `${produtos.length} ofertas` : 'ver'}</Text>
          </View>
          {historico.map(item => (
            <TouchableOpacity
              key={item}
              onPress={() => setBusca(item)}
              style={styles.historyRow}>
              <View style={styles.historyIcon}>
                <MaterialIcons name="history" size={17} color="#7A8794" />
              </View>
              <Text style={styles.historyText}>{item}</Text>
              <MaterialIcons name="chevron-right" size={22} color="#BBC3CA" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.resultHeading}>
        <Text style={styles.sectionTitle}>
          {produtos.length ? 'Melhores precos encontrados' : 'Favoritos monitorados'}
        </Text>
        <Text style={styles.sectionLink}>{produtos.length ? 'ordenado por preco' : 'salvos'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderScanner()}
      <FlatList
        contentContainerStyle={styles.content}
        data={produtos}
        keyExtractor={(item, idx) => {
          const productId = item.produto?.gtin || item.produto?.codProduto || 'sem-produto';
          const storeId = item.estabelecimento?.cnpj || 'sem-cnpj';
          return `${productId}-${storeId}-${idx}`;
        }}
        ListEmptyComponent={
          carregando ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#0DBB7C" size="large" />
              <Text style={styles.loadingText}>Consultando precos proximos...</Text>
            </View>
          ) : (
            <View style={styles.favoriteGrid}>
              {sampleFavorites.map(item => (
                <View key={item.name} style={styles.favoriteCard}>
                  <View style={styles.favoriteImage}>
                    <Text style={styles.favoriteInitial}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={styles.favoriteBody}>
                    <Text numberOfLines={1} style={styles.favoriteName}>{item.name}</Text>
                    <Text style={styles.favoriteStore}>{item.store}</Text>
                    <Text style={styles.favoritePrice}>{item.price}</Text>
                  </View>
                  <View style={styles.trendPill}>
                    <Text style={styles.trendText}>{item.trend}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        }
        ListHeaderComponent={renderHeader()}
        renderItem={({ item }) => {
          const p = item.produto;
          const e = item.estabelecimento;
          const descontoFormatado = formatDecimal(p?.desconto);
          const hasDiscount = descontoFormatado && Number(p?.desconto) > 0;

          return (
            <View style={styles.resultCard}>
              <View style={styles.productImage}>
                <Text style={styles.productInitial}>{getInitials(p?.descricao)}</Text>
              </View>

              <View style={styles.resultBody}>
                <View style={styles.resultTop}>
                  <Text numberOfLines={2} style={styles.productName}>{p?.descricao || 'Produto sem nome'}</Text>
                  <TouchableOpacity accessibilityLabel="Salvar favorito" style={styles.favoriteButton}>
                    <MaterialIcons name="favorite-border" size={18} color="#0DBB7C" />
                  </TouchableOpacity>
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{formatCurrency(p?.precoUnitario)}</Text>
                  {p?.unidade ? <Text style={styles.unit}>/{p.unidade}</Text> : null}
                  {hasDiscount ? <Text style={styles.discount}>-{descontoFormatado}</Text> : null}
                </View>

                <View style={styles.metaRow}>
                  {p?.ncmGrupo ? <Text numberOfLines={1} style={styles.metaPill}>{p.ncmGrupo}</Text> : null}
                  {p?.farmaciaPopular ? <Text style={styles.metaPill}>Popular</Text> : null}
                  {p?.intervalo ? <Text style={styles.metaText}>{p.intervalo}</Text> : null}
                </View>

                <View style={styles.storeBlock}>
                  <View style={styles.storeHeader}>
                    <MaterialIcons name="storefront" size={16} color="#0DBB7C" />
                    <Text numberOfLines={1} style={styles.storeName}>{e?.nomeEstabelecimento || 'Estabelecimento'}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.storeAddress}>
                    {e?.endLogradouro || 'Endereco nao informado'}, {e?.endNumero || 's/n'} - {e?.bairro || e?.municipio || 'bairro'}
                  </Text>
                  <View style={styles.storeFooter}>
                    <Text style={styles.storeDetail}>{e?.distancia?.toFixed(2) || '--'} km</Text>
                    <Text style={styles.storeDetail}>CNPJ {formatCnpj(e?.cnpj)}</Text>
                  </View>
                </View>
              </View>
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
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarText: {
    color: '#0DBB7C',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    flexDirection: 'row',
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 6,
  },
  searchInput: {
    color: '#101820',
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 46,
    paddingHorizontal: 8,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#071126',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 38,
  },
  searchButtonDisabled: {
    backgroundColor: '#A8B3BD',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  quickCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 78,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.72,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: '#EAFBF4',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    marginBottom: 7,
    width: 30,
  },
  quickLabel: {
    color: '#1B2733',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickHint: {
    color: '#93A0AA',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  selectorCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#101820',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionLink: {
    color: '#0DBB7C',
    fontSize: 11,
    fontWeight: '800',
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
  historyRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 50,
    paddingHorizontal: 10,
  },
  historyIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F4F7',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    marginRight: 10,
    width: 30,
  },
  historyText: {
    color: '#223040',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  resultHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 12,
  },
  favoriteGrid: {
    gap: 10,
  },
  favoriteCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 88,
    padding: 10,
    ...shadow,
  },
  favoriteImage: {
    alignItems: 'center',
    backgroundColor: '#E9F9F3',
    borderRadius: 12,
    height: 58,
    justifyContent: 'center',
    marginRight: 12,
    width: 58,
  },
  favoriteInitial: {
    color: '#0B9F6B',
    fontSize: 16,
    fontWeight: '900',
  },
  favoriteBody: {
    flex: 1,
  },
  favoriteName: {
    color: '#172331',
    fontSize: 14,
    fontWeight: '800',
  },
  favoriteStore: {
    color: '#89949F',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  favoritePrice: {
    color: '#0DBB7C',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
  },
  trendPill: {
    backgroundColor: '#EAFBF4',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  trendText: {
    color: '#0B9F6B',
    fontSize: 11,
    fontWeight: '900',
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
  resultCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EDF1',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 10,
    ...shadow,
  },
  productImage: {
    alignItems: 'center',
    backgroundColor: '#EAFBF4',
    borderRadius: 12,
    height: 58,
    justifyContent: 'center',
    marginRight: 10,
    width: 58,
  },
  productInitial: {
    color: '#0B9F6B',
    fontSize: 16,
    fontWeight: '900',
  },
  resultBody: {
    flex: 1,
  },
  resultTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  productName: {
    color: '#111B26',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: '#F4F7F9',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  priceRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 7,
  },
  price: {
    color: '#0DBB7C',
    fontSize: 18,
    fontWeight: '900',
  },
  unit: {
    color: '#8B96A1',
    fontSize: 11,
    fontWeight: '700',
  },
  discount: {
    backgroundColor: '#FFF0EE',
    borderRadius: 999,
    color: '#E15A4D',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  metaPill: {
    backgroundColor: '#F1F5F8',
    borderRadius: 999,
    color: '#5A6773',
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 120,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  metaText: {
    color: '#95A0AA',
    fontSize: 10,
    fontWeight: '700',
  },
  storeBlock: {
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    marginTop: 10,
    padding: 9,
  },
  storeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  storeName: {
    color: '#172331',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  storeAddress: {
    color: '#7A8794',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 5,
  },
  storeFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  storeDetail: {
    color: '#5B6875',
    fontSize: 10,
    fontWeight: '800',
  },
  scannerScreen: {
    backgroundColor: '#101820',
    flex: 1,
  },
  scannerHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scannerTitle: {
    color: '#101820',
    fontSize: 18,
    fontWeight: '900',
  },
  scannerSubtitle: {
    color: '#6F7C88',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#F1F4F7',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  cameraShell: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    borderColor: '#0DBB7C',
    borderRadius: 16,
    borderWidth: 3,
    height: 190,
    maxWidth: '82%',
    width: 320,
  },
  scannerFooter: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 68,
    paddingHorizontal: 16,
  },
  scannerFooterText: {
    color: '#172331',
    fontSize: 13,
    fontWeight: '800',
  },
});
