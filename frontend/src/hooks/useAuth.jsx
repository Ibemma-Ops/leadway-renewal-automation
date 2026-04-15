import { createContext, useContext, useState, useEffect, useRef } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mras_user"));
    } catch {
      return null;
    }
  });

  const timeoutRef = useRef(null);

  const clearInactivityTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const logout = () => {
    clearInactivityTimer();
    localStorage.removeItem("mras_token");
    localStorage.removeItem("mras_user");
    setUser(null);
    window.location.href = "/login";
  };

  const resetInactivityTimer = () => {
    clearInactivityTimer();

    if (!localStorage.getItem("mras_token")) return;

    timeoutRef.current = setTimeout(() => {
      alert("You have been logged out after 1 hour of inactivity.");
      logout();
    }, INACTIVITY_LIMIT);
  };

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    localStorage.setItem("mras_token", data.access_token);
    localStorage.setItem("mras_user", JSON.stringify(data.user));
    setUser(data.user);
    resetInactivityTimer();
    return data.user;
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    if (user) {
      resetInactivityTimer();
      events.forEach((event) => window.addEventListener(event, handleActivity));
    }

    return () => {
      clearInactivityTimer();
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
