import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { authenticateUser, createUser } from '@/lib/auth-db';

type AuthMode = 'signin' | 'signup';

type SignupForm = {
  dataNascimento: string;
  email: string;
  nome: string;
  profissao: string;
  senha: string;
  sobrenome: string;
  usuario: string;
};

const initialSignupForm: SignupForm = {
  dataNascimento: '',
  email: '',
  nome: '',
  profissao: '',
  senha: '',
  sobrenome: '',
  usuario: '',
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidBirthDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [signinIdentifier, setSigninIdentifier] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [feedback, setFeedback] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);

  const updateSignupField = (field: keyof SignupForm, value: string) => {
    setSignupForm(prev => ({ ...prev, [field]: value }));
  };

  const showFeedback = (message: string, kind: 'error' | 'success' = 'error') => {
    setFeedback(message);
    setFeedbackKind(kind);
  };

  const handleSignin = async () => {
    const identifier = signinIdentifier.trim();

    if (!identifier || !signinPassword) {
      showFeedback('Informe usuario ou email e senha.');
      return;
    }

    setLoading(true);
    setFeedback('');

    try {
      const user = await authenticateUser(identifier, signinPassword);

      if (!user) {
        showFeedback('Usuario, email ou senha invalidos.');
        return;
      }

      showFeedback(`Bem-vindo, ${user.nome}.`, 'success');
      router.replace('/');
    } catch {
      showFeedback('Nao foi possivel entrar agora.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const fields = Object.values(signupForm).map(value => value.trim());

    if (fields.some(value => !value)) {
      showFeedback('Preencha todos os dados do cadastro.');
      return;
    }

    if (!isValidEmail(signupForm.email)) {
      showFeedback('Informe um email valido.');
      return;
    }

    if (!isValidBirthDate(signupForm.dataNascimento)) {
      showFeedback('Use a data de nascimento no formato AAAA-MM-DD.');
      return;
    }

    if (signupForm.senha.length < 6) {
      showFeedback('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setFeedback('');

    try {
      const user = await createUser(signupForm);
      setSigninIdentifier(user.usuario);
      setSigninPassword('');
      setSignupForm(initialSignupForm);
      setMode('signin');
      showFeedback('Cadastro criado. Entre com sua senha.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel criar o cadastro.';
      showFeedback(message);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = ({
    autoCapitalize = 'sentences',
    keyboardType = 'default',
    label,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    value,
  }: {
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    keyboardType?: 'default' | 'email-address' | 'numbers-and-punctuation';
    label: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    secureTextEntry?: boolean;
    value: string;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA6B2"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>CJ</Text>
            </View>
            <Text style={styles.logo}>ComparaJa</Text>
            <Text style={styles.subtitle}>Acesse sua conta de compras e combustiveis</Text>
          </View>

          <View style={styles.authPanel}>
            <View style={styles.modeRow}>
              <TouchableOpacity
                onPress={() => {
                  setMode('signin');
                  setFeedback('');
                }}
                style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}>
                <MaterialIcons name="login" size={17} color={mode === 'signin' ? '#FFFFFF' : '#65727E'} />
                <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Entrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setMode('signup');
                  setFeedback('');
                }}
                style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}>
                <MaterialIcons name="person-add" size={17} color={mode === 'signup' ? '#FFFFFF' : '#65727E'} />
                <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Criar conta</Text>
              </TouchableOpacity>
            </View>

            {feedback ? (
              <View style={[styles.feedback, feedbackKind === 'success' && styles.feedbackSuccess]}>
                <MaterialIcons
                  name={feedbackKind === 'success' ? 'check-circle' : 'error-outline'}
                  size={18}
                  color={feedbackKind === 'success' ? '#0B8F61' : '#B33A32'}
                />
                <Text style={[styles.feedbackText, feedbackKind === 'success' && styles.feedbackTextSuccess]}>{feedback}</Text>
              </View>
            ) : null}

            {mode === 'signin' ? (
              <View>
                {renderInput({
                  autoCapitalize: 'none',
                  label: 'Usuario ou email',
                  onChangeText: setSigninIdentifier,
                  placeholder: 'usuario ou email',
                  value: signinIdentifier,
                })}
                {renderInput({
                  label: 'Senha',
                  onChangeText: setSigninPassword,
                  placeholder: 'sua senha',
                  secureTextEntry: true,
                  value: signinPassword,
                })}
                <TouchableOpacity disabled={loading} onPress={handleSignin} style={[styles.primaryButton, loading && styles.buttonDisabled]}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Entrar no app</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.twoColumn}>
                  {renderInput({
                    label: 'Nome',
                    onChangeText: value => updateSignupField('nome', value),
                    placeholder: 'Nome',
                    value: signupForm.nome,
                  })}
                  {renderInput({
                    label: 'Sobrenome',
                    onChangeText: value => updateSignupField('sobrenome', value),
                    placeholder: 'Sobrenome',
                    value: signupForm.sobrenome,
                  })}
                </View>
                {renderInput({
                  autoCapitalize: 'none',
                  label: 'Usuario',
                  onChangeText: value => updateSignupField('usuario', value),
                  placeholder: 'usuario',
                  value: signupForm.usuario,
                })}
                {renderInput({
                  autoCapitalize: 'none',
                  keyboardType: 'email-address',
                  label: 'Email',
                  onChangeText: value => updateSignupField('email', value),
                  placeholder: 'email@exemplo.com',
                  value: signupForm.email,
                })}
                {renderInput({
                  label: 'Senha',
                  onChangeText: value => updateSignupField('senha', value),
                  placeholder: 'minimo 6 caracteres',
                  secureTextEntry: true,
                  value: signupForm.senha,
                })}
                <View style={styles.twoColumn}>
                  {renderInput({
                    keyboardType: 'numbers-and-punctuation',
                    label: 'Nascimento',
                    onChangeText: value => updateSignupField('dataNascimento', value),
                    placeholder: 'AAAA-MM-DD',
                    value: signupForm.dataNascimento,
                  })}
                  {renderInput({
                    label: 'Profissao',
                    onChangeText: value => updateSignupField('profissao', value),
                    placeholder: 'Profissao',
                    value: signupForm.profissao,
                  })}
                </View>
                <TouchableOpacity disabled={loading} onPress={handleSignup} style={[styles.primaryButton, loading && styles.buttonDisabled]}>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="save" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Salvar cadastro</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: '#0A1525',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  android: {
    elevation: 4,
  },
  default: {
    boxShadow: '0 14px 32px rgba(10, 21, 37, 0.10)',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F5F7FA',
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#0DBB7C',
    borderRadius: 20,
    height: 54,
    justifyContent: 'center',
    marginBottom: 10,
    width: 54,
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  logo: {
    color: '#101820',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#73808C',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  authPanel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EBF0',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    ...shadow,
  },
  modeRow: {
    backgroundColor: '#F1F4F7',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    padding: 4,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
  },
  modeButtonActive: {
    backgroundColor: '#071126',
  },
  modeText: {
    color: '#65727E',
    fontSize: 12,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  fieldGroup: {
    flex: 1,
    marginBottom: 10,
  },
  inputLabel: {
    color: '#5F6C78',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderColor: '#E0E7ED',
    borderRadius: 10,
    borderWidth: 1,
    color: '#101820',
    fontSize: 13,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  twoColumn: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: Platform.OS === 'web' ? 10 : 0,
  },
  feedback: {
    alignItems: 'center',
    backgroundColor: '#FFF1F0',
    borderColor: '#FFD2CD',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 10,
  },
  feedbackSuccess: {
    backgroundColor: '#EAFBF4',
    borderColor: '#C5F1DE',
  },
  feedbackText: {
    color: '#A8322A',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  feedbackTextSuccess: {
    color: '#0B8F61',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0DBB7C',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 46,
  },
  buttonDisabled: {
    opacity: 0.68,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
