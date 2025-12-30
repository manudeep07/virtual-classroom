import React from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Room from './pages/Room';

import ClassroomView from './pages/ClassroomView';

function App() {
  return (
    <Router>
      <SocketProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/classrooms/:id" element={<ClassroomView />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/" element={<Navigate to="/auth" replace />} />
        </Routes>
      </SocketProvider>
    </Router>
  );
}

export default App;
