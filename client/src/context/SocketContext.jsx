import React, { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

const socket = io('http://localhost:5001');

const SocketProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to socket server:', socket.id);
        });
    }, []);

    return (
        <SocketContext.Provider value={{ socket, user, setUser }}>
            {children}
        </SocketContext.Provider>
    );
};

export { SocketContext, SocketProvider };
