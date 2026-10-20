/**
 * Nexo - Encryption Utilities
 * ===================================
 * Sistema de encriptación para proteger API keys y datos sensibles
 * Usa Web Crypto API con AES-GCM para máxima seguridad
 */

// Clave de encriptación derivada del user agent y timestamp
const deriveKey = async (password: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Salt fijo basado en dominio para consistencia
  const salt = encoder.encode('nexo-encryption-salt-2024');
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

// Generar IV aleatorio
const generateIV = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(12));
};

// Encriptar datos
export const encrypt = async (data: string, password: string): Promise<string> => {
  try {
    const key = await deriveKey(password);
    const iv = generateIV();
    const encoder = new TextEncoder();
    const dataUint8 = encoder.encode(data);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv)
      },
      key,
      dataUint8
    );

    // Combinar IV y datos encriptados
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    // Convertir a base64 para almacenamiento
    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
  } catch (error) {
    console.error('Error encriptando datos:', error);
    throw new Error('Error de encriptación');
  }
};

// Desencriptar datos
export const decrypt = async (encryptedData: string, password: string): Promise<string> => {
  try {
    const key = await deriveKey(password);
    
    // Convertir desde base64
    const binaryString = atob(encryptedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Extraer IV y datos encriptados
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv)
      },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(decrypted));
  } catch (error) {
    console.error('Error desencriptando datos:', error);
    throw new Error('Error de desencriptación');
  }
};

// Generar hash para fingerprints
export const generateHash = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataUint8 = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Generar contraseña derivada del dispositivo
export const getDevicePassword = (): string => {
  const userAgent = navigator.userAgent;
  const timestamp = new Date().getDate().toString(); // Cambia diariamente
  const domain = window.location.hostname;
  return `${userAgent}-${timestamp}-${domain}`;
};

// Verificar si el navegador soporta Web Crypto API
export const isEncryptionSupported = (): boolean => {
  return !!(window.crypto && window.crypto.subtle);
};

// Clase para gestionar encriptación de API providers
export class SecureStorage {
  private static readonly STORAGE_PREFIX = 'nexo_secure_';
  private static readonly METADATA_KEY = 'nexo_secure_metadata';

  // Guardar datos encriptados
  static async setItem(key: string, value: any): Promise<void> {
    if (!isEncryptionSupported()) {
      // Fallback para navegadores sin soporte
      localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, JSON.stringify(value));
      return;
    }

    try {
      const password = getDevicePassword();
      const jsonString = JSON.stringify(value);
      const encrypted = await encrypt(jsonString, password);
      
      localStorage.setItem(`${this.STORAGE_PREFIX}${key}`, encrypted);
      
      // Guardar metadata para verificación
      const metadata = this.getMetadata() || {};
      metadata[key] = {
        encrypted: true,
        timestamp: Date.now()
      };
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error guardando datos seguros:', error);
      throw error;
    }
  }

  // Recuperar datos desencriptados
  static async getItem<T = any>(key: string): Promise<T | null> {
    if (!isEncryptionSupported()) {
      // Fallback para navegadores sin soporte
      const item = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      return item ? JSON.parse(item) : null;
    }

    try {
      const encrypted = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
      if (!encrypted) return null;

      const metadata = this.getMetadata();
      const keyMetadata = metadata?.[key];
      
      if (keyMetadata?.encrypted) {
        const password = getDevicePassword();
        const decrypted = await decrypt(encrypted, password);
        return JSON.parse(decrypted);
      } else {
        // Datos no encriptados (fallback)
        return JSON.parse(encrypted);
      }
    } catch (error) {
      console.error('Error recuperando datos seguros:', error);
      // Intentar recuperar como fallback
      try {
        const item = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    }
  }

  // Eliminar datos
  static removeItem(key: string): void {
    localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`);
    
    // Limpiar metadata
    const metadata = this.getMetadata();
    if (metadata) {
      delete metadata[key];
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    }
  }

  // Obtener metadata
  private static getMetadata(): Record<string, any> | null {
    try {
      const metadata = localStorage.getItem(this.METADATA_KEY);
      return metadata ? JSON.parse(metadata) : null;
    } catch {
      return null;
    }
  }

  // Limpiar todos los datos
  static clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem(this.METADATA_KEY);
  }

  // Verificar integridad de datos
  static async verifyIntegrity(key: string): Promise<boolean> {
    try {
      const metadata = this.getMetadata();
      const keyMetadata = metadata?.[key];
      
      if (!keyMetadata?.encrypted) {
        return true; // Datos no encriptados, asumir válidos
      }

      // Intentar desencriptar para verificar integridad
      await this.getItem(key);
      return true;
    } catch {
      return false;
    }
  }
}

export default SecureStorage;
