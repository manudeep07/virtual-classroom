import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';

const NotificationBell = ({ notifications = [], onClear, onOpen }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (newState && onOpen) {
            onOpen();
        }
    };

    const hasUnread = notifications.some(n => !n.read);
    const hasNotifications = notifications.length > 0;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors text-[rgb(var(--text-secondary))] hover:text-white"
            >
                <Bell size={20} />
                {hasUnread && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-[rgb(var(--bg-dark))]"></span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 glass-panel rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <h3 className="font-bold text-sm text-white">Notifications</h3>
                        {hasNotifications && (
                            <button
                                onClick={onClear}
                                className="text-xs text-[rgb(var(--color-primary))] hover:underline"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-[rgb(var(--text-secondary))] text-sm italic">
                                No new notifications
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {notifications.map((notif, index) => (
                                    <div key={index} className={`p-3 hover:bg-white/5 transition-colors flex gap-3 ${!notif.read ? 'bg-white/5' : ''}`}>
                                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notif.type === 'announcement' ? 'bg-[rgb(var(--color-accent))]' :
                                                notif.type === 'assignment' ? 'bg-[rgb(var(--color-primary))]' :
                                                    'bg-[rgb(var(--color-secondary))]'
                                            }`}></div>
                                        <div>
                                            <p className="text-sm text-white font-medium leading-snug">{notif.message}</p>
                                            <p className="text-xs text-[rgb(var(--text-secondary))] mt-1">{notif.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
