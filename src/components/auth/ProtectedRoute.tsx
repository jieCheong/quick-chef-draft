// A wrapper component that guards routes requireing authentication
// Three states: loading=true -> render nothing
// user=null -> redirect to /auth
// user exists -> render the page normally

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Props {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
    const {user, loading} = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary
                border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/auth" replace />;
    }
    //logged in
    return <>{children}</>;
}