import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { BookOpen, ArrowRight, User, Mail, Lock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Auth = () => {
    const navigate = useNavigate();
    const { setUser } = useContext(SocketContext);
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'student'
    });
    const [loading, setLoading] = useState(false);

    const { name, email, password, role } = formData;

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
        setLoading(true);
        const url = isLogin
            ? 'http://localhost:5001/api/auth/login'
            : 'http://localhost:5001/api/auth/register';

        try {
            const body = isLogin ? { email, password } : { name, email, password, role };
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
                navigate('/dashboard');
            } else {
                toast.error(data.msg || 'Authentication failed');
            }
        } catch (err) {
            console.error(err);
            toast.error('Server error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-6xl h-[600px] glass-panel rounded-3xl overflow-hidden flex shadow-2xl relative">

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[rgb(var(--color-primary))] to-transparent opacity-50"></div>

                {/* Left Side - Hero / Info */}
                <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-black/20 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--color-primary))]/20 to-[rgb(var(--color-secondary))]/20 z-0"></div>
                    <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[rgb(var(--color-secondary))] rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-pulse"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                                <BookOpen size={32} className="text-[rgb(var(--color-accent))]" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">Virtual Classroom</span>
                        </div>

                        <h1 className="text-5xl font-bold leading-tight mb-6">
                            Start your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))]">
                                learning journey
                            </span>
                        </h1>
                        <p className="text-lg text-gray-300 max-w-md leading-relaxed">
                            Connect, collaborate, and learn in a seamless virtual environment designed for modern education.
                        </p>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-[rgb(var(--color-primary))]" />
                            <span>Real-time Video</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-[rgb(var(--color-primary))]" />
                            <span>Instant Messaging</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-[rgb(var(--color-primary))]" />
                            <span>Easy Sharing</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-[rgb(var(--color-primary))]" />
                            <span>Secure Access</span>
                        </div>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center relative">
                    <div className="max-w-md mx-auto w-full">
                        <h2 className="text-3xl font-bold mb-2 text-white">{isLogin ? 'Sign In' : 'Create Account'}</h2>
                        <p className="text-gray-400 mb-8">
                            {isLogin ? 'Enter your details to access your account' : 'Get started with your free account today'}
                        </p>

                        <form onSubmit={onSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 ml-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-gray-500" size={18} />
                                        <input
                                            type="text"
                                            name="name"
                                            value={name}
                                            onChange={onChange}
                                            placeholder="John Doe"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
                                    <input
                                        type="email"
                                        name="email"
                                        value={email}
                                        onChange={onChange}
                                        placeholder="john@example.com"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                                    <input
                                        type="password"
                                        name="password"
                                        value={password}
                                        onChange={onChange}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                        required
                                        minLength="6"
                                    />
                                </div>
                            </div>

                            {!isLogin && (
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    {['student', 'teacher'].map((r) => (
                                        <label key={r} className={`cursor-pointer border rounded-xl p-3 flex items-center justify-center gap-2 transition-all ${role === r
                                                ? 'bg-[rgb(var(--color-primary))]/20 border-[rgb(var(--color-primary))] text-white'
                                                : 'border-white/10 text-gray-400 hover:bg-white/5'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="role"
                                                value={r}
                                                checked={role === r}
                                                onChange={onChange}
                                                className="hidden"
                                            />
                                            <span className="capitalize font-medium">{r}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-6 py-3.5 rounded-xl btn-primary font-semibold flex items-center justify-center gap-2 group"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        {isLogin ? 'Sign In' : 'Sign Up'}
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-gray-400 text-sm">
                                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                                <button
                                    onClick={() => {
                                        setIsLogin(!isLogin);
                                        setFormData({ name: '', email: '', password: '', role: 'student' });
                                    }}
                                    className="text-[rgb(var(--color-secondary))] hover:text-white font-medium transition-colors ml-1"
                                >
                                    {isLogin ? 'Register now' : 'Sign In'}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auth;
