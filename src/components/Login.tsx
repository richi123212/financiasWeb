import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  User,
  Sparkles,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Código fijo de 5 dígitos requerido para que solo personas conocidas puedan registrarse
export const CODIGO_REGISTRO_SECRETO = '89284';
const CODIGOS_AUTORIZADOS_5_DIGITOS = ['89284'];

interface LoginProps {
  onLoginSuccess: (user: { id: string; email: string; nombre?: string }) => void;
  onEnterDemoMode?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigoAcceso, setCodigoAcceso] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSupabaseConfigured) {
      setErrorMsg('Error de configuración del servidor.');
      return;
    }

    try {
      setLoading(true);

      if (isSignUp) {
        const cleanCode = codigoAcceso.trim();

        // 1. Validar que tenga exactamente 5 números
        if (cleanCode.length !== 5 || !/^\d{5}$/.test(cleanCode)) {
          setErrorMsg('El código de seguridad debe tener exactamente 5 números.');
          setLoading(false);
          return;
        }

        // 2. Validar que coincida con el código de seguridad autorizado
        if (!CODIGOS_AUTORIZADOS_5_DIGITOS.includes(cleanCode)) {
          setErrorMsg('Código de acceso no autorizado. Solo personas conocidas pueden registrarse.');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              nombre: nombre.trim() || email.split('@')[0],
            },
          },
        });

        if (error) {
          if (error.message.includes('rate limit')) {
            throw new Error('Límite de envíos alcanzado temporalmente. Si ya te registraste, inicia sesión directamente.');
          }
          throw error;
        }

        if (data.user) {
          if (data.session) {
            onLoginSuccess({
              id: data.user.id,
              email: data.user.email || '',
              nombre: nombre.trim() || undefined,
            });
          } else {
            setSuccessMsg('¡Cuenta creada con éxito! Ya puedes iniciar sesión con tu correo y contraseña.');
            setIsSignUp(false);
            setPassword('');
            setCodigoAcceso('');
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) throw error;
        if (data.user) {
          onLoginSuccess({
            id: data.user.id,
            email: data.user.email || '',
            nombre: data.user.user_metadata?.nombre || undefined,
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error durante la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B0F19] text-white">
      {/* Fondo con resplandores sutiles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo y Encabezado: ahora dice Portal */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 shadow-xl shadow-emerald-500/20 mb-4 border border-emerald-400/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-['Plus_Jakarta_Sans']">
            Por<span className="text-emerald-400">tal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Acceso Privado Personal
          </p>
        </div>

        {/* Tarjeta Principal de Autenticación */}
        <div className="bg-[#161F30]/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Campo Nombre (solo en Registro) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nombre o Apodo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Tu nombre (ej. Carlos)"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Campo Correo Electrónico */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Campo Código de Seguridad Fijo de 5 dígitos (solo en Registro) */}
            {isSignUp && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Código de Seguridad (5 números) *
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Solo Conocidos
                  </span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={5}
                    required
                    placeholder="5 dígitos de acceso"
                    value={codigoAcceso}
                    onChange={(e) => setCodigoAcceso(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm tracking-widest font-mono font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Código de 5 números de autorización personal.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-2 cursor-pointer"
            >
              <span>{loading ? 'Procesando...' : isSignUp ? 'Registrar Cuenta' : 'Iniciar Sesión'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Alternar entre Iniciar Sesión y Registro con código */}
          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              {isSignUp
                ? '¿Ya tienes cuenta? Inicia sesión aquí'
                : '¿Eres conocido y quieres registrarte? Usa tu código de 5 números'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
