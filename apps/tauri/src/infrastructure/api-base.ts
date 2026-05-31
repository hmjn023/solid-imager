const isDev = import.meta.env.DEV;

export const API_BASE = isDev
	? window.location.origin
	: import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";
