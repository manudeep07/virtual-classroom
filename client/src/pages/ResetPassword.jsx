import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return toast.error('Passwords do not match');
        }

        setLoading(true);
        try {
            const res = await fetch(`http://localhost:5001/api/auth/reset-password/${token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();

            if (res.ok) {
                toast.success('Password updated successfully!');
                navigate('/auth');
            } else {
                toast.error(data.msg || 'Failed to reset password');
            }
        } catch (err) {
            console.error(err);
            toast.error('Server error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md glass-panel rounded-3xl p-8 relative overflow-hidden">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[rgb(var(--color-primary))] to-transparent opacity-50"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[rgb(var(--color-primary))]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[rgb(var(--color-primary))]">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
                    <p className="text-gray-400">Enter your new password below</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 ml-1">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-12 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                required
                                minLength="6"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-400 ml-1">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-10 pr-12 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                required
                                minLength="6"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 py-3.5 rounded-xl btn-primary font-semibold flex items-center justify-center gap-2 group"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                            <>
                                Update Password
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
