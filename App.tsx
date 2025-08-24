import React, { useState, useEffect } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_API_KEY } from './config';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import ProductManagementScreen from './components/ProductManagementScreen';
import { initializeGapiClient } from './services/api';

const App: React.FC = () => {
  const [isConfigValid] = useState(
    GOOGLE_CLIENT_ID !== 'AQUI_VA_TU_CLIENT_ID_DE_APLICACION_WEB.apps.googleusercontent.com' &&
    GOOGLE_API_KEY !== 'AQUI_VA_TU_API_KEY'
  );
  const [isGapiInitialized, setIsGapiInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const initGapi = async () => {
      try {
        await initializeGapiClient();
        setIsGapiInitialized(true);
      } catch (initError: any) {
        console.error("GAPI Initialization Error:", initError);
        let detailedMessage: string;
        const technicalDetails = initError.originalError || {};
        const techDetailsString = JSON.stringify(technicalDetails, null, 2);
        
        if (initError && initError.message === 'GAPI_INIT_FAILED') {
            const specificApiError = technicalDetails && technicalDetails.message ? 
                `<div class="my-4 p-4 bg-red-100 border-2 border-red-500 rounded-lg">
                    <p class="font-bold text-lg text-red-800">¡Atención! Causa del Error:</p>
                    <p class="mt-2 font-mono text-md text-red-700 bg-red-50 p-2 rounded">${technicalDetails.message}</p>
                    ${technicalDetails.code ? `<p class="mt-1 text-sm text-red-600">Código de error de Google: ${technicalDetails.code}</p>` : ''}
                </div>`
                : '';

            detailedMessage = `
                <p class="font-bold text-lg text-red-700">Error Crítico de Configuración de Google</p>
                ${specificApiError}
                <p class="mt-2">La aplicación no puede conectar con los servicios de Google. El mensaje de arriba puede ser la causa exacta. Abajo tienes una guía para solucionarlo.</p>
                
                <div class="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                    <h3 class="font-bold text-yellow-800">✅ Paso 1: Causa Más Común - Autorizar la URL</h3>
                    <p class="text-sm text-yellow-700 mt-1">Google necesita saber que esta URL exacta tiene permiso para usar tu Clave de API.</p>
                    <ol class="list-decimal list-inside text-sm mt-2 space-y-1 text-slate-700">
                        <li>Ve a la <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-semibold">página de Credenciales</a> de Google Cloud.</li>
                        <li>Busca tu <strong>Clave de API</strong> en la lista y haz clic en su nombre para editarla.</li>
                        <li>En la sección "Restricciones de la aplicación", asegúrate de que esté seleccionada la opción <strong>\"Sitios web\"</strong>.</li>
                        <li>En "Restricciones de sitios web", haz clic en <strong>\"AÑADIR\"</strong>.</li>
                        <li>Pega la siguiente URL <strong>exactamente</strong> como se muestra:</li>
                    </ol>
                    <code class="block w-full bg-slate-200 text-red-600 font-mono p-2 rounded text-xs mt-2 text-center break-all">${window.location.origin}</code>
                    <p class="text-xs text-slate-600 mt-2">Guarda los cambios y recarga esta página. Esto resuelve el problema el 90% de las veces.</p>
                </div>
    
                <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 class="font-bold text-blue-800">🕵️‍♀️ Pasos de Depuración Avanzada</h3>
                    <p class="text-sm text-blue-700 mt-1">Si el Paso 1 no funcionó, el problema puede ser uno de los siguientes:</p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-2 text-slate-700">
                        <li>
                            <strong>API de Google Sheets Habilitada:</strong> Ve a la <a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">página de la API de Sheets</a> y asegúrate de que el botón diga <strong>\"ADMINISTRAR\"</strong> (lo que significa que está habilitada). Si dice \"HABILITAR\", haz clic en él. La activación puede tardar unos minutos.
                        </li>
                        <li>
                            <strong>Verificar la Clave de API:</strong> Copia y pega de nuevo tu Clave de API en el archivo <code>config.ts</code>. Un solo caracter incorrecto causará este error.
                        </li>
                         <li>
                            <strong>Facturación Habilitada:</strong> Algunos proyectos de Google Cloud requieren una <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">cuenta de facturación</a> activa para usar APIs, incluso si están dentro del nivel gratuito. Verifica que tu proyecto tenga una asociada.
                        </li>
                        <li>
                            <strong>Mismo Proyecto:</strong> Asegúrate de que la Clave de API, el ID de Cliente y la API de Sheets que habilitaste pertenezcan <strong>todos al mismo proyecto</strong> de Google Cloud. Es un error común tener varios proyectos y confundirlos.
                        </li>
                    </ul>
                </div>

                <p class="mt-4 text-xs font-semibold">Detalles Técnicos (para depuración avanzada):</p>
                <pre class="mt-1 bg-slate-200 p-2 rounded text-xs text-left overflow-auto max-h-24">${techDetailsString}</pre>
            `;
        } else {
            detailedMessage = `
                <p class="font-bold">Error de Conexión</p>
                <p class="mt-2">${initError.message || 'Ocurrió un error inesperado al intentar conectar con Google.'}</p>
                <pre class="mt-1 bg-slate-200 p-2 rounded text-xs text-left overflow-auto max-h-24">${techDetailsString}</pre>
            `;
        }
        setError(detailedMessage);
      } finally {
        setIsLoading(false);
      }
    };
    if (isConfigValid) {
      initGapi();
    } else {
      setIsLoading(false);
    }
  }, [isConfigValid]);

  if (!isConfigValid) {
    return <ConfigErrorScreen />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Cargando...</p>
          <p className="text-sm text-slate-500">Inicializando la conexión con Google...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="max-w-4xl w-full mx-auto p-6 lg:p-8 bg-white rounded-xl shadow-2xl">
                <div dangerouslySetInnerHTML={{ __html: error }} />
            </div>
        </div>
    );
  }
  
  if (!isGapiInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-700">Error</p>
          <p className="text-sm text-slate-500">No se pudo inicializar la API de Google. Revisa la consola para más detalles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-800">
      <main className="overflow-y-auto p-6 lg:p-8">
        <ProductManagementScreen />
      </main>
    </div>
  );
};

export default App;